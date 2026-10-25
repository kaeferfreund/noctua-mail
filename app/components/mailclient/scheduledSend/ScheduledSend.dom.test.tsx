import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { Message } from "@/lib/data";
import type { ScheduledSendView } from "@/lib/scheduledSendView";
import { formatScheduledSendTime } from "@/lib/scheduleSendTime";
import { ScheduledSendBadge, ScheduledSendBar, ScheduledSendProvider, type ScheduledSendControls } from "./ScheduledSend";

afterEach(cleanup);
const sendAt = Date.UTC(2026, 9, 25, 7);
const time = formatScheduledSendTime(sendAt, "de");
const draft = (overrides: Partial<Message> = {}): Message => ({
  id: "imap-synthetic-draft", threadId: "t", accountId: "a", folderId: "a:Drafts", subject: "Synthetic planned", from: "team@example.test",
  to: "recipient@example.test", preview: "", date: "", dateValue: 0, body: "", draft: true, ...overrides
});
const schedule = (overrides: Partial<ScheduledSendView> = {}): ScheduledSendView => ({
  id: "schedule-1", draftId: "imap-synthetic-draft", sendAt, status: "queued", attempts: 0, lastError: null, scheduledByUserId: "u", ...overrides
});

function wrap(node: React.ReactNode, row: ScheduledSendView | null, calls: string[] = []) {
  const controls: ScheduledSendControls = {
    byDraftId: new Map(row ? [[row.draftId, row]] : []),
    unschedule: async (item) => { calls.push(`unschedule:${item.id}`); },
    sendNow: async (message, item) => { calls.push(`send:${message.id}:${item.id}`); }
  };
  return render(<I18nTestProvider locale="de"><Theme><ScheduledSendProvider value={controls}>{node}</ScheduledSendProvider></Theme></I18nTestProvider>);
}

describe("ScheduledSendBadge", () => {
  it("shows „Geplant · <time>“ on the draft only, never on its Sent copy", () => {
    const page = wrap(<><ScheduledSendBadge message={draft()} /><ScheduledSendBadge message={draft({ draft: false, folderId: "a:Sent" })} /></>, schedule());
    const badges = page.container.querySelectorAll("[data-scheduled-send]");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe(`Geplant · ${time}`);
    expect(time).toMatch(/^\d{1,2}\. Okt\., \d{2}:\d{2}$/);
  });

  it("shows a red „Fehlgeschlagen“ with the reason after the last attempt failed", () => {
    const page = wrap(<ScheduledSendBadge message={draft()} />, schedule({ status: "failed", lastError: "smtp_rejected" }));
    const badge = page.container.querySelector('[data-scheduled-send="failed"]')!;
    expect(badge.textContent).toBe("Fehlgeschlagen");
    expect(badge.getAttribute("title")).toBe(`Geplantes Senden für ${time} fehlgeschlagen: Der Mailserver hat die Nachricht abgelehnt.`);
    expect(badge.getAttribute("data-accent-color")).toBe("red");
  });

  it("renders nothing without a schedule or provider", () => {
    expect(wrap(<ScheduledSendBadge message={draft()} />, null).container.querySelector("[data-scheduled-send]")).toBeNull();
    cleanup();
    expect(render(<I18nTestProvider locale="de"><ScheduledSendBadge message={draft()} /></I18nTestProvider>).container.textContent).toBe("");
  });
});

describe("ScheduledSendBar", () => {
  it("offers „Jetzt senden“ and „Planung aufheben“ on an opened scheduled draft", async () => {
    const calls: string[] = [];
    const page = wrap(<ScheduledSendBar message={draft()} />, schedule(), calls);
    expect(page.getByRole("status").textContent).toContain(`Geplant für ${time} — Bearbeiten hebt die Planung auf`);
    fireEvent.click(page.getByRole("button", { name: "Jetzt senden" }));
    await waitFor(() => expect(calls).toEqual(["send:imap-synthetic-draft:schedule-1"]));
    await waitFor(() => expect((page.getByRole("button", { name: "Planung aufheben" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(page.getByRole("button", { name: "Planung aufheben" }));
    await waitFor(() => expect(calls).toEqual(["send:imap-synthetic-draft:schedule-1", "unschedule:schedule-1"]));
  });

  it("has no actions while sending and explains a failure", () => {
    const sending = wrap(<ScheduledSendBar message={draft()} />, schedule({ status: "sending" }));
    expect(sending.getByRole("status").textContent).toBe("Wird gerade gesendet …");
    expect(sending.queryByRole("button")).toBeNull();
    cleanup();
    const failed = wrap(<ScheduledSendBar message={draft()} />, schedule({ status: "failed", lastError: "interrupted" }));
    expect(failed.getByRole("alert").textContent).toContain("Das Senden wurde unterbrochen. Prüfe „Gesendet“, bevor du erneut sendest.");
    expect(failed.getByRole("button", { name: "Jetzt senden" })).toBeTruthy();
  });
});
