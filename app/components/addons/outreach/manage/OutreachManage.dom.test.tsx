import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { previewCsp, withPreviewCsp } from "./HtmlContent";
import type { OutreachLocation } from "./location";
import { CONTACT_DETAIL, DRAFT, LISTS, ManageHarness, SEQUENCE, SENT, TEMPLATE, json, stubFetch } from "./testFixtures";

afterEach(cleanup);

const mount = (options: { role?: "viewer" | "editor" | "manager"; initial?: OutreachLocation; handlers?: Parameters<typeof stubFetch>[0] } = {}) => {
  const stub = stubFetch(options.handlers);
  const navigations: OutreachLocation[] = [];
  const page = render(<ManageHarness role={options.role} initial={options.initial} fetchImpl={stub.fetchImpl} onNavigate={location => navigations.push(location)} />);
  return { ...stub, page, navigations };
};

describe("newsletter overview", () => {
  it("shows the overview figures and the recent campaigns", async () => {
    const { page } = mount();
    expect(await page.findByText("Last 30 days – 520 mails sent")).toBeTruthy();
    expect(page.getByText("512")).toBeTruthy();
    // Opened 236 of 513 delivered (520 sent − 7 bounced); automatic fetches reported apart.
    expect(page.getAllByText("46%").length).toBeGreaterThan(0);
    expect(page.getByText("Plus 131 automatic fetches (not counted)")).toBeTruthy();
    expect(await page.findByRole("button", { name: /Rundbrief November/ })).toBeTruthy();
  });

  it("turns a server error into a readable message", async () => {
    const { page } = mount({ handlers: [call => call.path === "overview" ? json({ ok: false, message: "boom" }, 500) : undefined] });
    const alert = await page.findByRole("alert");
    expect(alert.textContent).toContain("That did not work. Try again.");
    expect(alert.textContent).not.toContain("{");
  });
});

describe("newsletter contacts", () => {
  it("searches, filters by list and opens a contact with its events", async () => {
    const { page, calls } = mount({ initial: { section: "contacts" } });
    expect(await page.findByText("person1@example.test")).toBeTruthy();
    expect(page.getByText("1–50 of 512")).toBeTruthy();
    fireEvent.change(page.getByLabelText("List"), { target: { value: "list-beta" } });
    await waitFor(() => expect(calls.some(call => call.path === "contacts" && call.query.get("listId") === "list-beta")).toBe(true));
    fireEvent.change(page.getByLabelText("Search"), { target: { value: "kim" } });
    await waitFor(() => expect(calls.some(call => call.path === "contacts" && call.query.get("q") === "kim" && call.query.get("listId") === "list-beta")).toBe(true));
    fireEvent.click(page.getAllByRole("button", { name: /person1@example\.test/ })[0]);
    expect(await page.findByRole("heading", { name: "person1@example.test" })).toBeTruthy();
    // Machine fetches are listed but marked.
    expect(await page.findByText("automatic")).toBeTruthy();
    expect(page.getByText("https://www.example.test/neu")).toBeTruthy();
  });

  it("changes a subscription and deletes only after a clear confirmation", async () => {
    const { page, calls, navigations } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [call => call.method === "POST" && call.path.endsWith("/subscriptions") ? json({ ok: true, contact: { ...CONTACT_DETAIL, lists: CONTACT_DETAIL.lists.map(entry => ({ ...entry, status: "subscribed" })) } }) : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Subscribe" }));
    await waitFor(() => expect(calls.find(call => call.path.endsWith("/subscriptions"))?.body).toEqual({ listId: "list-beta", action: "subscribe", consentSource: "manual" }));
    await waitFor(() => expect(page.getAllByRole("button", { name: "Unsubscribe" }).length).toBe(2));

    fireEvent.click(page.getByRole("button", { name: "Delete" }));
    const dialog = await page.findByRole("dialog");
    expect(dialog.textContent).toContain("all of this person's opens and clicks");
    expect(calls.some(call => call.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete contact and data" }));
    await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.path === `contacts/${CONTACT_DETAIL.id}`)).toBe(true));
    await waitFor(() => expect(navigations.at(-1)).toEqual({ section: "contacts" }));
  });

  it("shows a state conflict as a sentence", async () => {
    const { page } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [call => call.method === "PATCH" ? json({ ok: false, code: "conflict", message: "Address already used by another contact." }, 409) : undefined]
    });
    fireEvent.change(await page.findByLabelText("First name"), { target: { value: "Alexa" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    const alert = await page.findByRole("alert");
    expect(alert.textContent).toContain("This is not possible in the current state");
    expect(alert.textContent).toContain("Address already used by another contact.");
  });

  it("gives viewers no write controls and editors no suppression", async () => {
    const viewer = mount({ role: "viewer", initial: { section: "contacts", id: CONTACT_DETAIL.id } });
    await viewer.page.findByRole("heading", { name: "person1@example.test" });
    for (const name of ["Delete", "Save", "Subscribe", "Unsubscribe", "Block"]) expect(viewer.page.queryByRole("button", { name })).toBeNull();
    expect((viewer.page.getByLabelText("First name") as HTMLInputElement).readOnly).toBe(true);
    cleanup();
    const editor = mount({ role: "editor", initial: { section: "contacts", id: CONTACT_DETAIL.id } });
    await editor.page.findByRole("heading", { name: "person1@example.test" });
    expect(editor.page.queryByRole("button", { name: "Block" })).toBeNull();
    cleanup();
    const manager = mount({ role: "manager", initial: { section: "contacts", id: CONTACT_DETAIL.id } });
    expect(await manager.page.findByRole("button", { name: "Block" })).toBeTruthy();
  });

  it("adds a contact by hand and subscribes it to the chosen list", async () => {
    const { page, calls } = mount({
      initial: { section: "contacts" },
      handlers: [call => call.method === "POST" && call.path === "contacts" ? json({ ok: true, created: true, contact: { ...CONTACT_DETAIL, id: "contact-new", email: "neu@example.test" } }) : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Add contact" }));
    const dialog = await page.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: "neu@example.test" } });
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(1));
    fireEvent.change(within(dialog).getByLabelText("Subscribe to list"), { target: { value: "list-beta" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls.find(call => call.path === "contacts/contact-new/subscriptions")?.body).toEqual({ listId: "list-beta", action: "subscribe", consentSource: "manual" }));
    expect(calls.find(call => call.method === "POST" && call.path === "contacts")?.body).toEqual({ email: "neu@example.test" });
  });
});

describe("newsletter lists", () => {
  it("creates a list, archives one after confirmation and jumps to its contacts", async () => {
    const { page, calls, navigations } = mount({ initial: { section: "lists" } });
    expect(await page.findByText("412 members")).toBeTruthy();
    expect(page.getByText("1 archived list")).toBeTruthy();
    fireEvent.click(page.getByRole("button", { name: "New list" }));
    const dialog = await page.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Kunden" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find(call => call.method === "POST" && call.path === "lists")?.body).toEqual({ name: "Kunden", description: "", optIn: "single" }));

    fireEvent.click(await page.findByRole("button", { name: "Archive list “Beta-Tester”" }));
    fireEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(calls.some(call => call.method === "DELETE" && call.path === "lists/list-beta")).toBe(true));

    fireEvent.click(page.getAllByRole("button", { name: "Contacts" }).find(button => button.closest("li")?.textContent?.includes("Newsletter"))!);
    expect(navigations.at(-1)).toEqual({ section: "contacts", listId: "list-news" });
  });
});

describe("newsletter templates", () => {
  it("previews foreign HTML only in a sandbox without scripts or same-origin access", async () => {
    const { page } = mount({ initial: { section: "templates", id: TEMPLATE.id } });
    const frame = await page.findByTitle("Live preview") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe(withPreviewCsp(TEMPLATE.html, previewCsp(window.location.origin, false)));
    expect(frame.getAttribute("src")).toBeNull();
  });

  it("inserts a placeholder, renders with warnings and keeps unsaved edits from being dropped silently", async () => {
    const { page, calls, navigations } = mount({
      initial: { section: "templates", id: TEMPLATE.id },
      handlers: [call => call.path === "render" ? json({ ok: true, subject: "Neuigkeiten", html: "<p>Hallo Alex</p><script>alert(1)</script>", text: "Hallo Alex", warnings: ["No unsubscribe link: a footer is added when sending."] }) : undefined]
    });
    const source = await page.findByLabelText("HTML source") as HTMLTextAreaElement;
    fireEvent.change(source, { target: { value: "<p>Hallo </p>", selectionStart: 9, selectionEnd: 9 } });
    fireEvent.keyDown(page.getByRole("button", { name: "Placeholder" }), { key: "Enter" });
    await act(async () => { fireEvent.click(await page.findByRole("menuitem", { name: /First name/ })); });
    await waitFor(() => expect(source.value).toBe("<p>Hallo {{ first_name }}</p>"));

    fireEvent.click(page.getByRole("button", { name: "Render with data" }));
    expect(await page.findByText("No unsubscribe link: a footer is added when sending.")).toBeTruthy();
    expect(calls.find(call => call.path === "render")?.body).toEqual({ subject: TEMPLATE.subject, html: "<p>Hallo {{ first_name }}</p>" });
    expect((page.getByTitle("Rendered preview") as HTMLIFrameElement).getAttribute("sandbox")).toBe("");

    fireEvent.click(page.getByRole("button", { name: "Campaigns" }));
    expect(await page.findByText("Discard unsaved changes?")).toBeTruthy();
    expect(navigations).toEqual([]);
    fireEvent.click(page.getByRole("button", { name: "Cancel" }));
    fireEvent.click(page.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(calls.some(call => call.method === "PATCH" && call.path === `templates/${TEMPLATE.id}`)).toBe(true));
  });
});

describe("newsletter campaigns", () => {
  it("asks for confirmation with the recipient count before scheduling and then shows the server's count", async () => {
    const { page, calls } = mount({
      initial: { section: "campaigns", id: DRAFT.id },
      handlers: [call => call.path === `campaigns/${DRAFT.id}/schedule`
        ? json({ ok: true, recipients: 398, contentVersion: "synthetic-content-v1", campaign: { ...DRAFT, status: "sending", startedAt: Date.now(), stats: { recipients: 398, queued: 398, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0, machineOpens: 0 } } })
        : call.path === `campaigns/${DRAFT.id}/report` ? json({ ok: true, campaign: { ...DRAFT, status: "sending" }, stats: { recipients: 398, queued: 398, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0, machineOpens: 0 }, links: [], recipients: [], nextCursor: null })
        : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Send …" }));
    const dialog = await page.findByRole("dialog");
    // The count comes from the server's dry run (consent, suppression, excluded lists), not from list sizes.
    expect(dialog.textContent).toContain("The campaign goes to 398 recipients from the lists Newsletter.");
    const scheduleCalls = () => calls.filter(call => call.path.endsWith("/schedule")).map(call => call.body);
    // The count is bound to the version on screen, the confirmation to what that count resolved.
    expect(scheduleCalls()).toEqual([{ sendAt: null, dryRun: true, expectedUpdatedAt: DRAFT.updatedAt }]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Send now" }));
    // The confirmed call names the draft version the count was made for.
    await waitFor(() => expect(scheduleCalls()).toEqual([{ sendAt: null, dryRun: true, expectedUpdatedAt: DRAFT.updatedAt },
      { sendAt: null, expectedUpdatedAt: DRAFT.updatedAt, expectedContentVersion: "synthetic-content-v1" }]));
    expect(await page.findByText("Sending to 398 recipients has started.")).toBeTruthy();
    expect(page.getByRole("button", { name: "Cancel sending" })).toBeTruthy();
  });

  it("sends a test and reports a refused schedule as a readable conflict", async () => {
    const { page, calls } = mount({
      initial: { section: "campaigns", id: DRAFT.id },
      handlers: [call => !call.path.endsWith("/schedule") ? undefined
        : (call.body as { dryRun?: boolean }).dryRun ? json({ ok: true, recipients: 3, campaign: DRAFT })
        : json({ ok: false, message: "Only a draft can be scheduled." }, 409)]
    });
    fireEvent.change(await page.findByLabelText("Test to"), { target: { value: "ich@example.test" } });
    fireEvent.click(page.getByRole("button", { name: "Send test" }));
    expect(await page.findByText("Test sent to ich@example.test.")).toBeTruthy();
    expect(calls.find(call => call.path.endsWith("/test"))?.body).toEqual({ to: "ich@example.test" });

    fireEvent.click(page.getByRole("button", { name: "Send …" }));
    const dialog = await page.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Send later"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("Only a draft can be scheduled.");
    expect(typeof (calls.filter(call => call.path.endsWith("/schedule")).at(-1)?.body as { sendAt: unknown }).sendAt).toBe("number");
  });

  it("shows a refused dry run before any confirmation dialog opens", async () => {
    const { page } = mount({
      initial: { section: "campaigns", id: DRAFT.id },
      handlers: [call => call.path.endsWith("/schedule") ? json({ ok: false, message: "SES is not configured." }, 400) : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Send …" }));
    expect((await page.findByRole("alert")).textContent).toContain("SES is not configured.");
    expect(page.queryByRole("dialog")).toBeNull();
  });

  it("reports rates next to counts, automatic fetches apart, links and recipients", async () => {
    const { page } = mount({ initial: { section: "campaigns", id: SENT.id } });
    expect(await page.findByText("Report")).toBeTruthy();
    // 449 delivered of 455 sent; 201 opened of 449.
    expect(page.getByText("449")).toBeTruthy();
    expect(page.getByText("44.8%")).toBeTruthy();
    expect(page.getByText("Plus 119 automatic fetches (not counted)")).toBeTruthy();
    expect(page.getByText("https://www.example.test/preise")).toBeTruthy();
    expect(page.getByText("person4@example.test").closest("tr")?.textContent).toContain("Bounced");
    expect(page.getByRole("button", { name: "Load more" })).toBeTruthy();
    expect(page.queryByRole("button", { name: "Cancel sending" })).toBeNull();
  });

  it("gives viewers a read-only draft", async () => {
    const { page } = mount({ role: "viewer", initial: { section: "campaigns", id: DRAFT.id } });
    expect(await page.findByText("Draft (read only).")).toBeTruthy();
    for (const name of ["Send …", "Save", "Send test", "Delete draft"]) expect(page.queryByRole("button", { name })).toBeNull();
    expect(page.queryByRole("button", { name: "New campaign" })).toBeNull();
  });
});

describe("newsletter sequences", () => {
  it("reorders and adds steps and saves them in order", async () => {
    const { page, calls } = mount({
      initial: { section: "sequences", id: SEQUENCE.id },
      handlers: [call => call.method === "PATCH" ? json({ ok: true, sequence: SEQUENCE }) : undefined]
    });
    expect(await page.findByText("After 1 day")).toBeTruthy();
    fireEvent.click(page.getByRole("button", { name: "Move step 2 down" }));
    fireEvent.click(page.getByRole("button", { name: "Add step" }));
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(call => call.method === "PATCH")).toBe(true));
    const steps = (calls.find(call => call.method === "PATCH")!.body as { steps: Array<{ id?: string; delayMinutes: number }> }).steps;
    expect(steps.map(step => step.id)).toEqual(["step-1", "step-3", "step-2", "step-4", undefined]);
    expect(steps[4].delayMinutes).toBe(1440);
    expect(await page.findByText("Report per step")).toBeTruthy();
    expect(page.getByText("23 running · 266 completed · 21 ended")).toBeTruthy();
  });

  it("explains what pausing and going live do before switching", async () => {
    const { page, calls } = mount({
      initial: { section: "sequences", id: SEQUENCE.id },
      handlers: [call => call.path.endsWith("/status") ? json({ ok: true, sequence: { ...SEQUENCE, status: (call.body as { status: "live" | "paused" }).status } }) : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Pause" }));
    const pause = await page.findByRole("dialog");
    expect(pause.textContent).toContain("Anyone who joins “Newsletter” during the pause does not start the sequence.");
    fireEvent.click(within(pause).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(calls.find(call => call.path.endsWith("/status"))?.body).toEqual({ status: "paused" }));
    fireEvent.click(await page.findByRole("button", { name: "Resume" }));
    expect((await page.findByRole("dialog")).textContent).toContain("Mails that fell due during the pause go out now.");
  });

  it("states what going live means for a draft", async () => {
    const { page } = mount({
      initial: { section: "sequences", id: SEQUENCE.id },
      handlers: [call => call.path === `sequences/${SEQUENCE.id}` && call.method === "GET" ? json({ ok: true, sequence: { ...SEQUENCE, status: "draft" } }) : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Switch live" }));
    expect((await page.findByRole("dialog")).textContent).toContain("From now on, everyone who newly joins “Newsletter” gets the 3 active steps of this sequence one after another.");
  });
});

describe("newsletter shell", () => {
  it("marks the active section and leaves viewers a read-only note", async () => {
    const { page } = mount({ role: "viewer", initial: { section: "lists" } });
    expect(page.getByRole("button", { name: "Lists" }).getAttribute("aria-current")).toBe("page");
    expect(page.getByText(/You have read access/)).toBeTruthy();
    await page.findByText("412 members");
    expect(page.queryByRole("button", { name: "New list" })).toBeNull();
    expect(LISTS.length).toBe(3);
  });
});
