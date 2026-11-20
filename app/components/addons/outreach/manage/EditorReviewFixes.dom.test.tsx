import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import type { Campaign, Sequence } from "@/lib/addons/outreach/types";
import { resetOutreachStatusForTests } from "../useOutreachStatus";
import type { OutreachLocation } from "./location";
import OutreachManagePage from "./OutreachManagePage";
import { ACCOUNT_ID, CONTACTS, DRAFT, REPORT, SENT, SEQUENCE, TEMPLATE, json, stubFetch, ManageHarness, type Handler } from "./testFixtures";

afterEach(() => { cleanup(); resetOutreachStatusForTests(); });

const mount = (initial: OutreachLocation, handlers: Handler[] = []) => {
  const stub = stubFetch(handlers);
  const navigations: OutreachLocation[] = [];
  const page = render(<ManageHarness initial={initial} fetchImpl={stub.fetchImpl} onNavigate={location => navigations.push(location)} />);
  return { ...stub, page, navigations };
};

/** A response the test releases by hand, to act while a request is still running. */
function deferred() {
  let release: (response: Response) => void = () => {};
  const promise = new Promise<Response>(resolve => { release = resolve; });
  return { promise, release };
}

const get = (path: string, body: unknown): Handler => call => call.method === "GET" && call.path === path ? json(body) : undefined;
const bodies = (calls: ReturnType<typeof stubFetch>["calls"], method: string, path: string) =>
  calls.filter(call => call.method === method && call.path === path).map(call => call.body as Record<string, unknown>);

/** The welcome sequence as the flow import writes it: four steps that reference a template, no own body. */
const IMPORTED: Sequence = {
  ...SEQUENCE, status: "draft",
  steps: SEQUENCE.steps.map(step => ({ ...step, templateId: TEMPLATE.id, html: "", text: "", enabled: true }))
};

describe("content from a referenced template (M)", () => {
  it("shows the template's body for an imported sequence and lets it go live unchanged", async () => {
    const { page, calls } = mount({ section: "sequences", id: IMPORTED.id }, [
      get(`sequences/${IMPORTED.id}`, { ok: true, sequence: IMPORTED }),
      call => call.path.endsWith("/status") ? json({ ok: true, sequence: { ...IMPORTED, status: "live" } }) : undefined
    ]);
    const goLive = await page.findByRole("button", { name: "Switch live" }) as HTMLButtonElement;
    expect(goLive.disabled).toBe(false);
    expect(page.queryByText(/To switch live, the sequence needs/)).toBeNull();
    // The open first step previews the referenced template instead of "No content yet".
    await waitFor(() => expect((page.getByTitle("Live preview") as HTMLIFrameElement).getAttribute("srcdoc")).toBe(TEMPLATE.html), { timeout: 2000 });
    expect((page.getByLabelText("Template") as HTMLSelectElement).value).toBe(TEMPLATE.id);

    fireEvent.click(goLive);
    fireEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "Switch live" }));
    await waitFor(() => expect(bodies(calls, "POST", `sequences/${IMPORTED.id}/status`)).toEqual([{ status: "live", expectedUpdatedAt: IMPORTED.updatedAt }]));
    // Showing the template is not an edit: nothing is saved before going live.
    expect(calls.some(call => call.method === "PATCH")).toBe(false);
  });

  it("does not list content as missing for a campaign that references a template", async () => {
    const draft: Campaign = { ...DRAFT, templateId: TEMPLATE.id, html: "", text: "" };
    const { page } = mount({ section: "campaigns", id: draft.id }, [get(`campaigns/${draft.id}`, { ok: true, campaign: draft })]);
    const send = await page.findByRole("button", { name: "Send …" }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    expect(page.queryByText(/Still missing before sending/)).toBeNull();
    fireEvent.change(page.getByLabelText("Test to"), { target: { value: "ich@example.test" } });
    expect((page.getByRole("button", { name: "Send test" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("text version of own HTML (K)", () => {
  const TEMPLATE_WITH_TEXT = { ...TEMPLATE, text: "Textfassung der Vorlage" };

  it("drops the template's text version when switching to own HTML", async () => {
    const draft: Campaign = { ...DRAFT, html: "<p>Eigener Inhalt</p>" };
    const { page, calls } = mount({ section: "campaigns", id: draft.id }, [
      get(`campaigns/${draft.id}`, { ok: true, campaign: draft }),
      get(`templates/${TEMPLATE.id}`, { ok: true, template: TEMPLATE_WITH_TEXT })
    ]);
    fireEvent.click(await page.findByLabelText("From template"));
    const select = page.getByLabelText("Template") as HTMLSelectElement;
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBe(2));
    fireEvent.change(select, { target: { value: TEMPLATE.id } });
    await waitFor(() => expect(select.value).toBe(TEMPLATE.id));
    fireEvent.click(page.getByLabelText("Own HTML"));
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(bodies(calls, "PATCH", `campaigns/${DRAFT.id}`).length).toBe(1));
    expect(bodies(calls, "PATCH", `campaigns/${DRAFT.id}`)[0]).toMatchObject({ templateId: null, html: TEMPLATE.html, text: "" });
  });

  it("drops a stored text version when the own HTML is edited", async () => {
    const draft: Campaign = { ...DRAFT, text: "Veraltete Textfassung" };
    const { page, calls } = mount({ section: "campaigns", id: draft.id }, [get(`campaigns/${draft.id}`, { ok: true, campaign: draft })]);
    fireEvent.change(await page.findByLabelText("HTML source"), { target: { value: "<p>Neuer Inhalt</p>" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(bodies(calls, "PATCH", `campaigns/${draft.id}`).length).toBe(1));
    expect(bodies(calls, "PATCH", `campaigns/${draft.id}`)[0]).toMatchObject({ html: "<p>Neuer Inhalt</p>", text: "" });
  });
});

describe("late answers in the content editor (AO)", () => {
  it("drops a template answer that arrives after the user switched to own HTML", async () => {
    const draft: Campaign = { ...DRAFT, html: "<p>Eigener Inhalt</p>" };
    const answer = deferred();
    const { page, calls } = mount({ section: "campaigns", id: draft.id }, [
      get(`campaigns/${draft.id}`, { ok: true, campaign: draft }),
      call => call.method === "GET" && call.path === `templates/${TEMPLATE.id}` ? answer.promise : undefined
    ]);
    fireEvent.click(await page.findByLabelText("From template"));
    const select = page.getByLabelText("Template") as HTMLSelectElement;
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBe(2));
    fireEvent.change(select, { target: { value: TEMPLATE.id } });
    await waitFor(() => expect(calls.some(call => call.path === `templates/${TEMPLATE.id}`)).toBe(true));
    fireEvent.click(page.getByLabelText("Own HTML"));
    await act(async () => { answer.release(json({ ok: true, template: TEMPLATE })); await answer.promise; });
    expect((page.getByLabelText("HTML source") as HTMLTextAreaElement).value).toBe("<p>Eigener Inhalt</p>");
    // Nothing changed, so there is nothing to save.
    expect((page.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides a rendering once another contact is chosen", async () => {
    const { page } = mount({ section: "templates", id: TEMPLATE.id }, [
      call => call.path === "render" ? json({ ok: true, subject: "Neuigkeiten", html: "<p>Hallo zusammen</p>", text: "Hallo zusammen", warnings: [] }) : undefined
    ]);
    fireEvent.click(await page.findByRole("button", { name: "Render with data" }));
    expect(await page.findByTitle("Rendered preview")).toBeTruthy();
    fireEvent.change(page.getByRole("combobox"), { target: { value: "person" } });
    fireEvent.click(await page.findByRole("button", { name: CONTACTS[0].email }, { timeout: 2000 }));
    await waitFor(() => expect(page.queryByTitle("Rendered preview") === null).toBe(true));
    expect(page.getByTitle("Live preview")).toBeTruthy();
  });
});

describe("typing while a save runs (R)", () => {
  it("keeps campaign input typed during the save and leaves it unsaved", async () => {
    const answer = deferred();
    const { page } = mount({ section: "campaigns", id: DRAFT.id }, [call => call.method === "PATCH" ? answer.promise : undefined]);
    const name = await page.findByLabelText("Internal name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Rundbrief Dezember 2026" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    fireEvent.change(page.getByLabelText("Subject"), { target: { value: "Später getippt" } });
    await act(async () => { answer.release(json({ ok: true, campaign: { ...DRAFT, name: "Rundbrief Dezember 2026", updatedAt: DRAFT.updatedAt + 1 } })); await answer.promise; });
    await waitFor(() => expect((page.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    expect((page.getByLabelText("Subject") as HTMLInputElement).value).toBe("Später getippt");
    expect(name.value).toBe("Rundbrief Dezember 2026");
  });

  it("keeps a step typed during the save and stores it with its new id next time", async () => {
    const draft: Sequence = { ...SEQUENCE, status: "draft" };
    const answer = deferred();
    const { page, calls } = mount({ section: "sequences", id: draft.id }, [
      get(`sequences/${draft.id}`, { ok: true, sequence: draft }),
      call => {
        if (call.method !== "PATCH") return undefined;
        if (bodies(calls, "PATCH", `sequences/${draft.id}`).length === 1) return answer.promise;
        return json({ ok: true, sequence: draft });
      }
    ]);
    fireEvent.click(await page.findByRole("button", { name: "Add step" }));
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    const stepNames = () => page.getAllByLabelText("Internal name") as HTMLInputElement[];
    fireEvent.change(stepNames().at(-1)!, { target: { value: "Nachfass" } });
    const stored: Sequence = { ...draft, steps: [...draft.steps, { id: "step-5", position: 4, delayMinutes: 1440, name: "", subject: "", previewText: "", templateId: null, html: "", text: "", enabled: true }] };
    await act(async () => { answer.release(json({ ok: true, sequence: stored })); await answer.promise; });
    expect(stepNames().at(-1)!.value).toBe("Nachfass");
    const save = page.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(bodies(calls, "PATCH", `sequences/${draft.id}`).length).toBe(2));
    const steps = bodies(calls, "PATCH", `sequences/${draft.id}`)[1].steps as Array<{ id?: string; name: string }>;
    expect(steps.at(-1)).toMatchObject({ id: "step-5", name: "Nachfass" });
  });

  it("keeps template input typed during the save", async () => {
    const answer = deferred();
    const { page } = mount({ section: "templates", id: TEMPLATE.id }, [call => call.method === "PATCH" ? answer.promise : undefined]);
    fireEvent.change(await page.findByLabelText("Name"), { target: { value: "Rundbrief neu" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    fireEvent.change(page.getByLabelText("Subject"), { target: { value: "Später getippt" } });
    await act(async () => { answer.release(json({ ok: true, template: { ...TEMPLATE, name: "Rundbrief neu" } })); await answer.promise; });
    expect((page.getByLabelText("Subject") as HTMLInputElement).value).toBe("Später getippt");
    expect(page.getByText("Unsaved changes")).toBeTruthy();
  });
});

describe("campaign report after a refresh (T)", () => {
  it("takes status and actions from the reloaded report", async () => {
    const sending = { ...SENT, status: "sending" as const, finishedAt: null, updatedAt: SENT.startedAt! };
    let reports = 0;
    const { page } = mount({ section: "campaigns", id: SENT.id }, [
      get(`campaigns/${SENT.id}`, { ok: true, campaign: sending }),
      call => {
        if (call.path !== `campaigns/${SENT.id}/report`) return undefined;
        reports++;
        return json(reports === 1 ? { ...REPORT, campaign: { ...REPORT.campaign, ...sending } } : REPORT);
      }
    ]);
    expect(await page.findByText("Report")).toBeTruthy();
    expect(page.getByText("Cancel sending")).toBeTruthy();
    expect(page.getByText("Sending")).toBeTruthy();
    fireEvent.click(page.getByText("Refresh"));
    // Time line, badge and actions all follow the reloaded report.
    expect(await page.findByText(/^Finished /)).toBeTruthy();
    expect(page.queryByText("Sending") === null).toBe(true);
    expect(page.queryByText("Cancel sending") === null).toBe(true);
  });
});

describe("sequence report and status (W, AB, AU)", () => {
  it("reloads the report after a save and after a status change", async () => {
    const { page, calls } = mount({ section: "sequences", id: SEQUENCE.id }, [
      call => call.method === "PATCH" ? json({ ok: true, sequence: { ...SEQUENCE, name: "Willkommen neu" } }) : undefined,
      call => call.path.endsWith("/status") ? json({ ok: true, sequence: { ...SEQUENCE, name: "Willkommen neu", status: "paused" } }) : undefined
    ]);
    const reports = () => calls.filter(call => call.path === `sequences/${SEQUENCE.id}/report`).length;
    expect(await page.findByText("Report per step")).toBeTruthy();
    await waitFor(() => expect(reports()).toBe(1));
    fireEvent.change(page.getAllByLabelText("Name")[0], { target: { value: "Willkommen neu" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reports()).toBe(2));
    fireEvent.click(page.getByRole("button", { name: "Pause" }));
    fireEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(reports()).toBe(3));
  });

  it("pauses without saving unsaved edits first", async () => {
    const { page, calls } = mount({ section: "sequences", id: SEQUENCE.id }, [
      call => call.method === "PATCH" ? json({ ok: false, message: "Step 5 needs a subject." }, 400) : undefined,
      call => call.path.endsWith("/status") ? json({ ok: true, sequence: { ...SEQUENCE, status: "paused" } }) : undefined
    ]);
    fireEvent.click(await page.findByRole("button", { name: "Add step" }));
    fireEvent.click(page.getByRole("button", { name: "Pause" }));
    fireEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(bodies(calls, "POST", `sequences/${SEQUENCE.id}/status`)).toEqual([{ status: "paused" }]));
    expect(calls.some(call => call.method === "PATCH")).toBe(false);
    expect(await page.findByRole("button", { name: "Resume" })).toBeTruthy();
    // The new step is still there and still unsaved.
    expect(page.getByText("5. Untitled")).toBeTruthy();
    expect((page.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("locks the trigger list once the sequence left the draft", async () => {
    for (const status of ["live", "paused", "draft"] as const) {
      const { page } = mount({ section: "sequences", id: SEQUENCE.id }, [get(`sequences/${SEQUENCE.id}`, { ok: true, sequence: { ...SEQUENCE, status } })]);
      const trigger = await page.findByLabelText("Trigger list") as HTMLSelectElement;
      expect(trigger.disabled).toBe(status !== "draft");
      cleanup();
    }
  });
});

describe("browser Back with unsaved changes (S)", () => {
  const href = (search: string) => `/newsletter?accountId=${ACCOUNT_ID}${search}`;
  const back = (search: string) => act(() => {
    window.history.replaceState(null, "", href(search));
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  it("asks before leaving an edited template and keeps the editor on cancel", async () => {
    resetOutreachStatusForTests({ loaded: true, available: true, accounts: [{ accountId: ACCOUNT_ID, enabled: true, trackMailDefault: false }], sesConfigured: true, trackingConfigured: true });
    window.history.replaceState(null, "", href("&section=templates"));
    const { fetchImpl } = stubFetch([get("/api/auth/me", { ok: true, accounts: [{ id: ACCOUNT_ID, email: "news@example.test", name: "", accessRole: "editor" }] })]);
    const page = render(<Theme><OutreachManagePage fetchImpl={fetchImpl} /></Theme>);
    fireEvent.click(await page.findByRole("button", { name: /Rundbrief/ }));
    const name = await page.findByLabelText("Name") as HTMLInputElement;
    expect(window.location.search).toContain(`id=${TEMPLATE.id}`);
    fireEvent.change(name, { target: { value: "Rundbrief geändert" } });

    await back("&section=templates");
    const dialog = await page.findByRole("dialog");
    expect(dialog.textContent).toContain("Discard unsaved changes?");
    // The history points at the editor again, and the editor keeps the input.
    expect(window.location.search).toContain(`id=${TEMPLATE.id}`);
    expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("Rundbrief geändert");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog") === null).toBe(true));
    expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("Rundbrief geändert");

    await back("&section=templates");
    fireEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "Discard and switch" }));
    expect(await page.findByRole("button", { name: /Rundbrief/ })).toBeTruthy();
    expect(page.queryByLabelText("HTML source")).toBeNull();
    expect(window.location.search).not.toContain("id=");
  });
});
