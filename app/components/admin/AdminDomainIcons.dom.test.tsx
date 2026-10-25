import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, renderHook, waitFor, within } from "@testing-library/react";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { notifyDomainIconsChanged, useDomainIconVersions } from "@/app/hooks/useDomainIconVersions";
import AdminDomainIcons from "./AdminDomainIcons";

afterEach(cleanup);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

type Entry = { domain: string; mailboxes: number; version: string | null; updatedAt: number | null };

function server(initial: Entry[], failUpload?: { status: number; code: string }) {
  let entries = initial;
  const calls: Array<{ url: string; method: string; init?: RequestInit }> = [];
  const apiFetch: AdminFetch = async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method, init });
    const domain = decodeURIComponent(url.split("/").pop() ?? "");
    if (method === "PUT") {
      if (failUpload) return json({ ok: false, code: failUpload.code }, failUpload.status);
      entries = entries.map(entry => entry.domain === domain ? { ...entry, version: "abcdef0123456789", updatedAt: 1 } : entry);
      return json({ ok: true, domain, version: "abcdef0123456789" });
    }
    if (method === "DELETE") {
      entries = entries.map(entry => entry.domain === domain ? { ...entry, version: null, updatedAt: null } : entry);
      return json({ ok: true, domain, removed: true });
    }
    return json({ ok: true, domains: entries });
  };
  return { apiFetch, calls };
}

const brand: Entry = { domain: "brand.example.test", mailboxes: 4, version: null, updatedAt: null };
const custom: Entry = { domain: "custom.example.test", mailboxes: 1, version: "0123456789abcdef", updatedAt: 1 };

function chooseFile(page: ReturnType<typeof render>, file: File) {
  const input = page.getByTestId("domain-icon-file") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("admin domain icons", () => {
  it("lists the domains with their current icon and uploads an image as raw bytes", async () => {
    const { apiFetch, calls } = server([brand, custom]);
    const page = render(<Theme><AdminDomainIcons apiFetch={apiFetch} /></Theme>);
    const row = (domain: string) => page.container.querySelector<HTMLElement>(`[data-domain="${domain}"]`)!;
    await page.findByText("brand.example.test");
    expect(within(row("brand.example.test")).getByText("Favicon · 4 mailboxes")).toBeTruthy();
    expect(within(row("custom.example.test")).getByText("Custom image · 1 mailbox")).toBeTruthy();
    expect(within(row("custom.example.test")).getByRole("img", { name: "Icon for custom.example.test" }).getAttribute("src"))
      .toBe("/api/admin/domain-icons/custom.example.test?v=0123456789abcdef");
    // Nothing to reset while the favicon is shown.
    expect((page.getByRole("button", { name: "Reset image for brand.example.test" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(page.getByRole("button", { name: "Upload image for brand.example.test" }));
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", { type: "image/png" });
    chooseFile(page, file);
    expect(await page.findByText("The image for brand.example.test is saved.")).toBeTruthy();
    const put = calls.find(call => call.method === "PUT")!;
    expect(put.url).toBe("/api/admin/domain-icons/brand.example.test");
    expect(new Headers(put.init?.headers).get("content-type")).toBe("application/octet-stream");
    expect(put.init?.body).toBe(file);
    await waitFor(() => expect(within(row("brand.example.test")).getByText("Custom image · 4 mailboxes")).toBeTruthy());
    expect(within(row("brand.example.test")).getByRole("img").getAttribute("src")).toBe("/api/admin/domain-icons/brand.example.test?v=abcdef0123456789");

    fireEvent.click(page.getByRole("button", { name: "Reset image for brand.example.test" }));
    expect(await page.findByText("brand.example.test shows its favicon again.")).toBeTruthy();
    expect(calls.filter(call => call.method === "DELETE").map(call => call.url)).toEqual(["/api/admin/domain-icons/brand.example.test"]);
  });

  it("refuses an oversize file before sending it and shows server rejections in plain words", async () => {
    const { apiFetch, calls } = server([brand], { status: 415, code: "unsupported_format" });
    const page = render(<Theme><AdminDomainIcons apiFetch={apiFetch} /></Theme>);
    fireEvent.click(await page.findByRole("button", { name: "Upload image for brand.example.test" }));
    chooseFile(page, new File([new Uint8Array(512 * 1024 + 1)], "huge.png", { type: "image/png" }));
    expect((await page.findByRole("alert")).textContent).toBe("The image is larger than 512 KB.");
    expect(calls.some(call => call.method === "PUT")).toBe(false);

    fireEvent.click(page.getByRole("button", { name: "Upload image for brand.example.test" }));
    chooseFile(page, new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    await waitFor(() => expect(page.getByRole("alert").textContent).toBe("Only PNG, JPEG, WEBP or ICO are allowed."));
  });

  it("shows German labels and 44 px phone targets on the action row", async () => {
    const { apiFetch } = server([brand]);
    const page = render(<Theme><AdminDomainIcons apiFetch={apiFetch} /></Theme>, {
      wrapper: ({ children }) => <I18nTestProvider locale="de">{children}</I18nTestProvider>
    });
    expect(await page.findByRole("heading", { name: "Domain-Symbole" })).toBeTruthy();
    const upload = page.getByRole("button", { name: "Bild für brand.example.test hochladen" });
    expect(upload.textContent).toBe("Bild hochladen");
    expect(page.getByText("Favicon · 4 Postfächer")).toBeTruthy();
    expect(upload.parentElement!.className).toContain("max-md:[&_button]:min-h-11");
  });
});

describe("useDomainIconVersions", () => {
  it("loads the versions for the session and reloads them after an admin change", async () => {
    let version = "1111111111111111";
    const urls: string[] = [];
    const apiFetch = async (input: RequestInfo | URL) => { urls.push(String(input)); return json({ ok: true, icons: { "brand.example.test": version } }); };
    const accounts = [{ email: "team@brand.example.test" }];
    const { result } = renderHook(() => useDomainIconVersions({ sessionKey: "user-1", apiFetch, accounts }));
    await waitFor(() => expect(result.current).toEqual({ "brand.example.test": "1111111111111111" }));

    version = "2222222222222222";
    act(() => notifyDomainIconsChanged());
    await waitFor(() => expect(result.current).toEqual({ "brand.example.test": "2222222222222222" }));
    expect(urls).toEqual(["/api/domain-icons", "/api/domain-icons"]);
  });

  it("makes no request without a session", async () => {
    const urls: string[] = [];
    const apiFetch = async (input: RequestInfo | URL) => { urls.push(String(input)); return json({ ok: true, icons: {} }); };
    const { result } = renderHook(() => useDomainIconVersions({ sessionKey: null, apiFetch, accounts: [{ email: "a@example.test" }] }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(result.current).toEqual({});
    expect(urls).toEqual([]);
  });
});
