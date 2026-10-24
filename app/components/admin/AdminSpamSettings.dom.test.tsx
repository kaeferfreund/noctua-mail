import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import AdminSpamSettings from "./AdminSpamSettings";
import SpamTabContent from "../account-settings/tabs/SpamTabContent";

afterEach(cleanup);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

describe("spam settings", () => {
  it("admin: shows the effective config and saves enabled, model and threshold", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let effective = { enabled: false, provider: "anthropic", model: "claude-haiku-5-5", threshold: 0.85, modelUnavailable: "missing-key" as const };
    const apiFetch: AdminFetch = async (input, init) => {
      calls.push({ url: String(input), init });
      if (init?.method === "PUT") effective = { ...effective, ...JSON.parse(String(init.body)), model: "claude-haiku-5-5" };
      return response({ ok: true, settings: {}, effective });
    };
    const page = render(<Theme><AdminSpamSettings apiFetch={apiFetch} /></Theme>);
    expect(await page.findByText("Provider: anthropic")).toBeTruthy();
    expect(page.getByText(/no API key \(ANTHROPIC_API_KEY\)/)).toBeTruthy();
    fireEvent.click(page.getByLabelText("Spam detection enabled"));
    fireEvent.change(page.getByLabelText(/Threshold/), { target: { value: "0,9" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await page.findByText("Saved.");
    const put = calls.find(call => call.init?.method === "PUT")!;
    expect(put.url).toBe("/api/admin/spam-settings");
    expect(JSON.parse(String(put.init?.body))).toEqual({ enabled: true, model: null, threshold: 0.9 });
  });

  it("mailbox: loads auto-move and saves an empty threshold as the global default", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const apiFetch: AdminFetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return response({ ok: true, settings: init?.method === "PUT" ? JSON.parse(String(init.body)) : { threshold: 0.95 }, globalThreshold: 0.85, enabled: false });
    };
    const page = render(<Theme><SpamTabContent accountId="synthetic mailbox" apiFetch={apiFetch} /></Theme>);
    expect(await page.findByText("Spam detection is switched off in the administration.")).toBeTruthy();
    const threshold = page.getByLabelText(/Own threshold/) as HTMLInputElement;
    expect(threshold.value).toBe("0.95");
    fireEvent.click(page.getByRole("switch"));
    fireEvent.change(threshold, { target: { value: "" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(page.getByText("Saved.")).toBeTruthy());
    const put = calls.find(call => call.init?.method === "PUT")!;
    expect(put.url).toBe("/api/admin/accounts/synthetic%20mailbox/spam-settings");
    expect(JSON.parse(String(put.init?.body))).toEqual({ autoMove: true, threshold: null });
  });
});
