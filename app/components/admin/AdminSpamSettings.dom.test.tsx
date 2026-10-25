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
      return response({ ok: true, settings: {}, effective, trust: [
        { accountId: "a", email: "a@example.test", trustedSkips: 1200, canaryChecks: 24, canaryMismatches: 1 },
        { accountId: "b", email: "b@example.test", trustedSkips: 34, canaryChecks: 1, canaryMismatches: 0 }
      ] });
    };
    const page = render(<Theme><AdminSpamSettings apiFetch={apiFetch} /></Theme>);
    expect(await page.findByText("Provider: anthropic")).toBeTruthy();
    expect(page.getByText("Trusted senders: 1,234 skipped without the model, 25 samples, 1 of them disagreeing")).toBeTruthy();
    expect(page.getByText(/no API key \(ANTHROPIC_API_KEY\)/)).toBeTruthy();
    fireEvent.click(page.getByLabelText("Spam detection enabled"));
    fireEvent.change(page.getByLabelText(/Threshold/), { target: { value: "0,9" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await page.findByText("Saved.");
    const put = calls.find(call => call.init?.method === "PUT")!;
    expect(put.url).toBe("/api/admin/spam-settings");
    expect(JSON.parse(String(put.init?.body))).toEqual({ enabled: true, model: null, threshold: 0.9 });
  });

  it("admin: offers the inbox check only for the admin's own mailboxes", async () => {
    const trust = [{ accountId: "own", email: "own@example.test", trustedSkips: 0, canaryChecks: 0, canaryMismatches: 0 },
      { accountId: "foreign", email: "foreign@example.test", trustedSkips: 0, canaryChecks: 0, canaryMismatches: 0 }];
    const effective = { enabled: true, provider: "anthropic", model: "claude-haiku-5-5", threshold: 0.85, modelUnavailable: null };
    const page = render(<Theme><AdminSpamSettings apiFetch={async () => response({ ok: true, settings: {}, effective, trust,
      rescanMailboxes: [{ accountId: "own", email: "own@example.test" }] })} /></Theme>);
    expect(await page.findByRole("button", { name: "Check the inbox of own@example.test" })).toBeTruthy();
    expect(page.queryByRole("button", { name: "Check the inbox of foreign@example.test" })).toBeNull();
    cleanup();
    const none = render(<Theme><AdminSpamSettings apiFetch={async () => response({ ok: true, settings: {}, effective, trust, rescanMailboxes: [] })} /></Theme>);
    expect(await none.findByText("You are not a member of any mailbox. Only mailboxes you are a member of can be checked.")).toBeTruthy();
    expect(none.queryByRole("button", { name: /^Check the inbox of/ })).toBeNull();
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
    fireEvent.click(page.getByLabelText("Move suspicious messages to the Junk folder automatically"));
    fireEvent.change(threshold, { target: { value: "" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(page.getByText("Saved.")).toBeTruthy());
    const put = calls.find(call => call.init?.method === "PUT")!;
    expect(put.url).toBe("/api/admin/accounts/synthetic%20mailbox/spam-settings");
    expect(JSON.parse(String(put.init?.body))).toEqual({ enabled: true, autoMove: true, threshold: null });
  });

  it("mailbox: a non-numeric or out-of-range threshold shows the field error and saves nothing", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const apiFetch: AdminFetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return response({ ok: true, settings: init?.method === "PUT" ? JSON.parse(String(init.body)) : { threshold: 0.95 }, globalThreshold: 0.85, enabled: true });
    };
    const page = render(<Theme><SpamTabContent accountId="synthetic" apiFetch={apiFetch} /></Theme>);
    const threshold = await page.findByLabelText(/Own threshold/) as HTMLInputElement;
    for (const value of ["abc", "0,3", "1.5"]) {
      fireEvent.change(threshold, { target: { value } });
      fireEvent.click(page.getByRole("button", { name: "Save" }));
      expect((await page.findByRole("alert")).textContent).toBe("Enter a number between 0.5 and 1, or leave the field empty.");
      expect(threshold.getAttribute("aria-invalid")).toBe("true");
      expect(threshold.getAttribute("aria-describedby")).toContain(page.getByRole("alert").id);
    }
    expect(calls.filter(call => call.init?.method === "PUT")).toEqual([]);
    fireEvent.change(threshold, { target: { value: "0,8" } });
    expect(page.queryByRole("alert")).toBeNull();
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await page.findByText("Saved.");
    expect(JSON.parse(String(calls.find(call => call.init?.method === "PUT")!.init?.body))).toEqual({ enabled: true, autoMove: false, threshold: 0.8 });
  });

  it("mailbox: the own switch defaults to on and saves off", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const apiFetch: AdminFetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return response({ ok: true, settings: init?.method === "PUT" ? JSON.parse(String(init.body)) : {}, globalThreshold: 0.85, enabled: true });
    };
    const page = render(<Theme><SpamTabContent accountId="synthetic" apiFetch={apiFetch} /></Theme>);
    const enabled = await page.findByLabelText("Spam detection enabled for this mailbox");
    expect(enabled.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(enabled);
    expect(enabled.getAttribute("aria-checked")).toBe("false");
    expect(page.getByLabelText("Move suspicious messages to the Junk folder automatically").hasAttribute("disabled")).toBe(true);
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(page.getByText("Saved.")).toBeTruthy());
    const put = calls.find(call => call.init?.method === "PUT")!;
    expect(JSON.parse(String(put.init?.body))).toEqual({ enabled: false, autoMove: false, threshold: null });
  });
});
