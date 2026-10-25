import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { SPAM_RESCAN_EVENT, type SpamRescanItem, type SpamRescanJob, type SpamRescanPreview } from "@/lib/mail/spam/rescanTypes";
import AdminSpamRescan from "./AdminSpamRescan";

afterEach(cleanup);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const DAY = 24 * 60 * 60_000;
const preview = (period: SpamRescanPreview["period"]): SpamRescanPreview => period === "30d"
  ? { period, inboxRows: 120, unchecked: 40, modelLimit: 40, modelBlocked: null, hasJunkFolder: true }
  : { period, inboxRows: 9800, unchecked: 5200, modelLimit: 2000, modelBlocked: null, hasJunkFolder: true };
const job = (overrides: Partial<SpamRescanJob> = {}): SpamRescanJob => ({
  id: "job-1", accountId: "acc-a", status: "ready", period: "30d", withModel: true, modelLimit: 40, phase: null, processed: 0, total: 0,
  counts: { inboxRows: 120, serverFlagged: 5, serverFlagSelected: 2, modelChecked: 40, modelCalls: 31, classifierMarked: 1, items: 3 },
  error: null, createdByUserId: "admin", createdAt: Date.UTC(2026, 9, 25, 9, 30), updatedAt: 1, finishedAt: 1, ...overrides
});
const item = (id: string, overrides: Partial<SpamRescanItem> = {}): SpamRescanItem => ({
  id, from: `Gewinnspiel <${id}@lottery.example.test>`, subject: `Gewinn ${id}`, date: "", dateValue: Date.UTC(2026, 9, 20) - Number(id.slice(1)) * DAY,
  stage: "server-flag", reasons: [], score: 9.4, moveStatus: null, ...overrides
});

function mount(apiFetch: AdminFetch) {
  return render(<I18nTestProvider locale="de"><Theme><AdminSpamRescan apiFetch={apiFetch}
    mailboxes={[{ accountId: "acc-a", email: "team@example.test" }, { accountId: "acc-b", email: "praxis@example.test" }]} /></Theme></I18nTestProvider>);
}

describe("admin INBOX rescan", () => {
  it("shows the counts per period, defaults the model check by period and starts with the count shown", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let started = false;
    const events: string[] = [];
    const listener = () => events.push("rescan");
    window.addEventListener(SPAM_RESCAN_EVENT, listener);
    const apiFetch: AdminFetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (init?.method === "POST") { started = true; return response({ ok: true, job: job({ status: "running" }) }, 202); }
      const period = (new URL(url, "http://localhost").searchParams.get("period") ?? "30d") as SpamRescanPreview["period"];
      return response({ ok: true, preview: preview(period), job: started ? job({ status: "running", phase: "server-flag", processed: 300, total: 1200 }) : null, items: [] });
    };
    const view = mount(apiFetch);
    fireEvent.click(view.getByRole("button", { name: "Posteingang von team@example.test prüfen" }));
    expect(await view.findByText("120 Mails im Posteingang in diesem Zeitraum")).toBeTruthy();
    const model = view.getByLabelText("Auch Filter-Prüfung mit Modell") as HTMLInputElement;
    expect(model.checked).toBe(true);
    expect(view.getByText(/^Schickt höchstens 40 Mails an das Modell/)).toBeTruthy();

    fireEvent.click(view.getByLabelText("Alles"));
    expect(await view.findByText("9.800 Mails im Posteingang in diesem Zeitraum")).toBeTruthy();
    expect(model.checked).toBe(false);
    fireEvent.click(model);
    expect(view.getByText(/5\.200 Mails sind ungeprüft, pro Durchlauf gehen höchstens 2\.000 an das Modell/)).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Prüfung starten" }));
    expect(await view.findByText("Posteingang wird gelesen (alle Mails, auch außerhalb des Zeitraums, für bekannte Absender)")).toBeTruthy();
    expect(view.getByText("300 von 1.200")).toBeTruthy();
    const post = calls.find((call) => call.init?.method === "POST")!;
    expect(post.url).toBe("/api/admin/accounts/acc-a/spam-rescan");
    expect(JSON.parse(String(post.init?.body))).toEqual({ period: "all", withModel: true, modelLimit: 2000 });
    expect(events).toEqual(["rescan"]);
    window.removeEventListener(SPAM_RESCAN_EVENT, listener);
  });

  it("lists the hits with all selected, moves only the selection and shows the result", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let state: { job: SpamRescanJob; items: SpamRescanItem[] } = {
      job: job(), items: [item("m1"), item("m2"), item("m3", { stage: "classifier", score: 0.93, reasons: ["Gewinnversprechen"] })]
    };
    const apiFetch: AdminFetch = async (input, init) => {
      calls.push({ url: String(input), init });
      if (init?.method === "POST") {
        const ids = JSON.parse(String(init.body)).ids as string[];
        state = { job: job({ counts: { ...state.job.counts, moved: ids.length, gone: 0, changed: 0, errors: 0 } }),
          items: state.items.map((entry) => ids.includes(entry.id) ? { ...entry, moveStatus: "moved" as const } : entry) };
        return response({ ok: true, selected: ids.length }, 202);
      }
      return response({ ok: true, preview: preview("30d"), ...state });
    };
    const view = mount(apiFetch);
    fireEvent.click(view.getByRole("button", { name: "Posteingang von team@example.test prüfen" }));
    const list = await view.findByRole("list", { name: "Treffer" });
    expect(view.getByText(/^Prüfung vom 25\.10\.2026 .*\(Letzte 30 Tage\): 3 Treffer$/)).toBeTruthy();
    expect(view.getByText(/^Vom Server markiert: 5, davon 3 aus Schutzgründen im Posteingang behalten \(z\. B\. bekannter Absender, beantwortet, markiert, jünger als 3 Tage/)).toBeTruthy();
    expect(view.getByText("Filter: 40 geprüft, 31 Modellaufrufe, 1 verdächtig.")).toBeTruthy();
    expect(within(list).getByText("Filter: verdächtig · Sicherheit 93 % · Gewinnversprechen")).toBeTruthy();
    const boxes = within(list).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, true, true]);
    fireEvent.click(within(list).getByLabelText("„Gewinn m2“ auswählen"));
    fireEvent.click(view.getByRole("button", { name: "Ausgewählte verschieben (2)" }));
    expect(await view.findByText("2 verschoben, 0 nicht mehr im Posteingang, 0 geändert und behalten, 0 Fehler.")).toBeTruthy();
    const post = calls.find((call) => call.init?.method === "POST")!;
    expect(post.url).toBe("/api/admin/accounts/acc-a/spam-rescan/move");
    expect(JSON.parse(String(post.init?.body))).toEqual({ jobId: "job-1", ids: ["m1", "m3"] });
    await waitFor(() => expect(within(list).getAllByText("Verschoben")).toHaveLength(2));
    // Moved hits are no longer selectable; the deselected one stays deselected until chosen again.
    expect(within(list).getAllByRole("checkbox")).toHaveLength(1);
    expect((view.getByRole("button", { name: "Ausgewählte verschieben (0)" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports an interrupted scan and a blocked model check", async () => {
    const apiFetch: AdminFetch = async () => response({ ok: true,
      preview: { ...preview("30d"), modelBlocked: "mailbox-off", hasJunkFolder: false },
      job: job({ status: "cancelled", error: "interrupted", counts: { inboxRows: 120 } }), items: [] });
    const view = mount(apiFetch);
    fireEvent.click(view.getByRole("button", { name: "Posteingang von team@example.test prüfen" }));
    expect(await view.findByText("Die Prüfung wurde durch einen Neustart des Dienstes abgebrochen.")).toBeTruthy();
    expect(view.getByText("Keine Treffer. Es gibt nichts zu verschieben.")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Neue Prüfung" }));
    expect(await view.findByText(/Die Spam-Erkennung ist für dieses Postfach ausgeschaltet/)).toBeTruthy();
    expect((view.getByLabelText("Auch Filter-Prüfung mit Modell") as HTMLInputElement).disabled).toBe(true);
    expect(view.getByText(/hat keinen Spam-Ordner/)).toBeTruthy();
  });
});
