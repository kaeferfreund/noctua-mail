// Runs only under `bun run test:dom` (preloads happy-dom before component load).
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import type { Attachment } from "@/lib/data";
import { emulateSingleWindowApp } from "@/lib/testFixtures/displayMode";
import AttachmentsList from "./AttachmentsList";

afterEach(cleanup);

const pdf: Attachment = {
  id: "att-a-1-0",
  filename: "report.pdf",
  contentType: "application/pdf",
  size: 5_499_904, // 5.5 MB in decimal units
  inline: false,
  url: "/api/accounts/a/messages/m/attachments/att-a-1-0"
};

const inlineImage: Attachment = {
  id: "att-a-1-1",
  filename: "sig.png",
  contentType: "image/png",
  size: 3072,
  inline: true,
  url: "/api/accounts/a/messages/m/attachments/att-a-1-1"
};

// htmlBody must be non-empty for an inline image to count as body-rendered
// (and thus hidden from the main list / eligible for the removal section).
const htmlBody = "<p>hi</p>";

describe("AttachmentsList", () => {
  it("renders attachment sizes in human-readable form", () => {
    const { getByText } = render(<AttachmentsList attachments={[pdf]} htmlBody={htmlBody} />);
    expect(getByText(/report\.pdf/)).toBeTruthy();
    expect(getByText(/5\.5 MB/)).toBeTruthy();
    expect(getByText("pdf").getAttribute("aria-hidden")).toBe("true");
  });

  it("omits the 'Images in message' section when removal is disabled", () => {
    const { queryByText } = render(
      <AttachmentsList attachments={[pdf, inlineImage]} htmlBody={htmlBody} />
    );
    // Inline image is hidden from the main list and there is no removal section.
    expect(queryByText("Images in message")).toBeNull();
    expect(queryByText(/sig\.png/)).toBeNull();
  });

  it("shows inline images as a removable section only when onRemove is provided", () => {
    const { getByText, getByLabelText } = render(
      <AttachmentsList attachments={[pdf, inlineImage]} htmlBody={htmlBody} onRemove={() => {}} />
    );
    expect(getByText("Images in message")).toBeTruthy();
    expect(getByText(/sig\.png/)).toBeTruthy();
    // Remove control distinguishes image vs attachment and names the file.
    expect(getByLabelText("Remove image: sig.png")).toBeTruthy();
    expect(getByLabelText("Remove attachment: report.pdf")).toBeTruthy();
  });

  it("keeps unknown extensions, filename, download and remove actions", () => {
    const removed: string[] = [];
    const { getByText, getByLabelText, container } = render(
      <AttachmentsList
        attachments={[{ ...pdf, filename: "sample.CUSTOM", contentType: "application/octet-stream" }]}
        onRemove={(id) => removed.push(id)}
      />
    );
    expect(getByText("custom")).toBeTruthy();
    expect(getByText(/sample.CUSTOM/)).toBeTruthy();
    expect(container.querySelector(".attachment-icon svg")?.getAttribute("aria-hidden")).toBe("true");
    const download = getByLabelText("Download attachment", { selector: ".attachment-preview" });
    expect(download.getAttribute("href")).toBe(`${pdf.url}?download=1`);
    expect(download.getAttribute("download")).toBe("sample.CUSTOM");
    fireEvent.click(getByLabelText("Remove attachment: sample.CUSTOM"));
    expect(removed).toEqual([pdf.id]);
  });

  it("preserves loading, error and retry states for extensionless files", () => {
    const retried: string[] = [];
    const attachment = { ...pdf, filename: "README", contentType: "application/octet-stream" };
    const { getByText, getByLabelText, getByRole, rerender } = render(
      <AttachmentsList attachments={[{ ...attachment, loadStatus: "loading" }]} />
    );
    expect(getByText("file")).toBeTruthy();
    expect(getByLabelText("Loading attachment")).toBeTruthy();
    expect(getByText(/Loading…/)).toBeTruthy();
    rerender(
      <AttachmentsList
        attachments={[{ ...attachment, loadStatus: "error" }]}
        onRetryLoad={(id) => retried.push(id)}
      />
    );
    expect(getByRole("alert").textContent).toContain("Failed to load");
    fireEvent.click(getByLabelText("Retry loading attachment: README"));
    expect(retried).toEqual([pdf.id]);
  });

  it("previews a browser-only HTML attachment as plain text, not as an app-origin document", async () => {
    const blobs: Blob[] = [];
    const opened: string[] = [];
    const createObjectURL = URL.createObjectURL;
    const open = window.open;
    URL.createObjectURL = (blob: Blob) => { blobs.push(blob); return "blob:synthetic-preview"; };
    window.open = ((url?: string | URL) => { opened.push(String(url)); return null; }) as typeof window.open;
    try {
      const html = '<form method="post" action="/api/x"><button>Synthetic</button></form>';
      const { getByLabelText } = render(<AttachmentsList attachments={[{
        id: "att-local", filename: "draft.html", contentType: "text/html", size: html.length, inline: false,
        dataUrl: `data:text/html;base64,${Buffer.from(html).toString("base64")}`
      }]} />);
      fireEvent.click(getByLabelText("Preview attachment", { selector: ".attachment-link" }));
      for (let attempt = 0; attempt < 50 && opened.length === 0; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
      expect(opened).toEqual(["blob:synthetic-preview"]);
      expect(blobs.map((blob) => blob.type)).toEqual(["text/plain;charset=utf-8"]);
      expect(await blobs[0].text()).toBe(html);
    } finally {
      URL.createObjectURL = createObjectURL;
      window.open = open;
    }
  });
});

describe("AttachmentsList in a home-screen app", () => {
  // A window opened from an iOS home-screen app has no way back to the app.
  let restore = () => {};
  const opened: string[] = [];
  const open = window.open;
  afterEach(() => {
    restore();
    window.open = open;
    opened.length = 0;
  });
  const setup = () => {
    restore = emulateSingleWindowApp();
    window.open = ((url?: string | URL) => { opened.push(String(url)); return null; }) as typeof window.open;
  };
  const image: Attachment = { ...pdf, id: "att-a-1-2", filename: "photo.png", contentType: "image/png", url: "/api/accounts/a/messages/m/attachments/att-a-1-2" };
  const previewFrame = () => document.querySelector<HTMLIFrameElement>("[data-in-app-preview] iframe");

  it("previews inside the app, sandboxed like the preview shell, with a reachable close button", async () => {
    setup();
    const { getByLabelText, findByRole, queryByRole } = render(<AttachmentsList attachments={[image]} />);
    await act(async () => { fireEvent.click(getByLabelText("Preview attachment", { selector: ".attachment-link" })); });
    const dialog = await findByRole("dialog", { name: "photo.png" });
    expect(opened).toEqual([]);
    expect(previewFrame()?.getAttribute("src")).toBe(image.url!);
    expect(previewFrame()?.getAttribute("sandbox")).toBe("");
    expect(previewFrame()?.getAttribute("referrerpolicy")).toBe("no-referrer");
    // The phone frame (MobileFrames fullscreenSheet) places this close as a 44px target below the
    // status bar; tests/browser/ui/qa-pwa-preview.spec.ts measures it.
    const close = dialog.querySelector<HTMLButtonElement>(':scope > [data-slot="sheet-close"]')!;
    expect(close.textContent).toBe("Close");
    // Focus starts outside the frame, so Escape reaches the app.
    expect(document.activeElement).toBe(close);
    await act(async () => { fireEvent.click(close); });
    expect(queryByRole("dialog")).toBeNull();
  });

  it("frames a PDF without a sandbox, as the preview shell does, and closes on Escape", async () => {
    setup();
    const { getByLabelText, findByRole, queryByRole } = render(<AttachmentsList attachments={[pdf]} />);
    await act(async () => { fireEvent.click(getByLabelText("Preview attachment", { selector: ".attachment-link" })); });
    const dialog = await findByRole("dialog", { name: "report.pdf" });
    expect(previewFrame()?.hasAttribute("sandbox")).toBe(false);
    await act(async () => { fireEvent.keyDown(dialog, { key: "Escape" }); });
    expect(queryByRole("dialog")).toBeNull();
    expect(opened).toEqual([]);
  });

  it("shows a browser-only attachment as a sandboxed text blob and releases it on close", async () => {
    setup();
    const blobs: Blob[] = [];
    const revoked: string[] = [];
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = (blob: Blob) => { blobs.push(blob); return "blob:synthetic-in-app"; };
    URL.revokeObjectURL = (url: string) => { revoked.push(url); };
    try {
      const html = "<p>Synthetic</p>";
      const { getByLabelText, findByRole, getByRole } = render(<AttachmentsList attachments={[{
        id: "att-local", filename: "draft.html", contentType: "text/html", size: html.length, inline: false,
        dataUrl: `data:text/html;base64,${Buffer.from(html).toString("base64")}`
      }]} />);
      await act(async () => { fireEvent.click(getByLabelText("Preview attachment", { selector: ".attachment-link" })); });
      await findByRole("dialog", { name: "draft.html" });
      expect(blobs.map((blob) => blob.type)).toEqual(["text/plain;charset=utf-8"]);
      expect(previewFrame()?.getAttribute("src")).toBe("blob:synthetic-in-app");
      expect(previewFrame()?.getAttribute("sandbox")).toBe("");
      await act(async () => { fireEvent.click(getByRole("button", { name: "Close" })); });
      expect(revoked).toEqual(["blob:synthetic-in-app"]);
      expect(opened).toEqual([]);
    } finally {
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    }
  });
});
