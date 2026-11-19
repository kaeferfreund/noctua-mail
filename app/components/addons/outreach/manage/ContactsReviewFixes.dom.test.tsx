import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { formatDate } from "@/lib/i18n/format";
import type { ContactDetail } from "@/lib/addons/outreach/types";
import OutreachManage from "./OutreachManage";
import type { OutreachLocation } from "./location";
import { ACCOUNT_ID, CONTACT_DETAIL, ManageHarness, contact, json, stubFetch, type Call, type Handler } from "./testFixtures";

/** Review fixes L, I, U, V, AC, AD, R of the contact views (synthetic data only). */

afterEach(cleanup);

const mount = (options: { role?: "viewer" | "editor" | "manager"; initial?: OutreachLocation; handlers?: Handler[] } = {}) => {
  const stub = stubFetch(options.handlers);
  const navigations: OutreachLocation[] = [];
  const page = render(<ManageHarness role={options.role} initial={options.initial} fetchImpl={stub.fetchImpl} onNavigate={location => navigations.push(location)} />);
  return { ...stub, page, navigations };
};

const isPost = (path: string) => (call: Call) => call.method === "POST" && call.path === path;
const subscriptionCalls = (calls: Call[]) => calls.filter(call => call.method === "POST" && call.path.endsWith("/subscriptions"));
const RESUBSCRIBE_409 = { ok: false, code: "resubscribe_confirmation_required", message: "This person unsubscribed.", unsubscribedAt: CONTACT_DETAIL.lists[1].unsubscribedAt };
const UNSUBSCRIBED_AT = formatDate(CONTACT_DETAIL.lists[1].unsubscribedAt!, "en");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function openAddDialog(page: ReturnType<typeof mount>["page"], email: string) {
  fireEvent.click(await page.findByRole("button", { name: "Add contact" }));
  const dialog = await page.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: email } });
  await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(1));
  return dialog;
}

describe("add contact dialog", () => {
  it("L: does not send empty name fields, sends filled ones", async () => {
    const { page, calls } = mount({
      initial: { section: "contacts" },
      handlers: [call => isPost("contacts")(call) ? json({ ok: true, created: false, contact: contact(1) }) : undefined]
    });
    const dialog = await openAddDialog(page, "person1@example.test");
    fireEvent.change(within(dialog).getByLabelText("Last name"), { target: { value: "  Neu  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls.find(isPost("contacts"))?.body).toEqual({ email: "person1@example.test", lastName: "Neu" }));
  });

  it("U: does not offer lists with double opt-in", async () => {
    const { page } = mount({ initial: { section: "contacts" } });
    const dialog = await openAddDialog(page, "neu@example.test");
    const options = within(dialog).getAllByRole("option").map(option => option.textContent);
    expect(options).toContain("Beta-Tester");
    expect(options).not.toContain("Newsletter");
  });

  it("U: a filter on a double opt-in list is not preselected", async () => {
    const { page } = mount({ initial: { section: "contacts", listId: "list-news" } });
    const dialog = await openAddDialog(page, "neu@example.test");
    expect((within(dialog).getByLabelText("Subscribe to list") as HTMLSelectElement).value).toBe("");
  });

  it("I: an existing contact is reported before anything is subscribed; a re-subscription needs a confirmation", async () => {
    let confirmed = false;
    const { page, calls, navigations } = mount({
      initial: { section: "contacts" },
      handlers: [call => {
        if (isPost("contacts")(call)) return json({ ok: true, created: false, contact: contact(1) });
        if (isPost(`contacts/${CONTACT_DETAIL.id}/subscriptions`)(call)) {
          if ((call.body as { confirmResubscribe?: boolean }).confirmResubscribe !== true) return json(RESUBSCRIBE_409, 409);
          confirmed = true;
          return json({ ok: true, contact: CONTACT_DETAIL });
        }
        return undefined;
      }]
    });
    const dialog = await openAddDialog(page, "person1@example.test");
    fireEvent.change(within(dialog).getByLabelText("Subscribe to list"), { target: { value: "list-beta" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect((await within(dialog).findByRole("status")).textContent).toContain("This contact already existed");
    expect(within(dialog).getByRole("status").textContent).toContain("Nothing has changed in “Beta-Tester” yet.");
    expect(subscriptionCalls(calls)).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Subscribe to “Beta-Tester”" }));
    expect(await within(dialog).findByText("Subscribe someone who unsubscribed?")).toBeTruthy();
    expect(dialog.textContent).toContain(`person1@example.test unsubscribed on ${UNSUBSCRIBED_AT} and does not want to receive mail any more.`);
    expect(subscriptionCalls(calls).length).toBe(1);
    expect(confirmed).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Subscribe anyway" }));
    await waitFor(() => expect(subscriptionCalls(calls).at(-1)?.body).toEqual({ listId: "list-beta", action: "subscribe", consentSource: "manual", confirmResubscribe: true }));
    await waitFor(() => expect(navigations.at(-1)).toEqual({ section: "contacts", id: CONTACT_DETAIL.id }));
  });

  it("I: cancelling the confirmation subscribes nothing and says so", async () => {
    const { page, calls } = mount({
      initial: { section: "contacts" },
      handlers: [
        call => isPost("contacts")(call) ? json({ ok: true, created: false, contact: contact(1) }) : undefined,
        call => call.method === "POST" && call.path.endsWith("/subscriptions") ? json(RESUBSCRIBE_409, 409) : undefined
      ]
    });
    const dialog = await openAddDialog(page, "person1@example.test");
    fireEvent.change(within(dialog).getByLabelText("Subscribe to list"), { target: { value: "list-beta" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Subscribe to “Beta-Tester”" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Cancel" }));
    expect((await within(dialog).findByRole("status")).textContent).toBe("The contact is not subscribed to “Beta-Tester”.");
    expect(subscriptionCalls(calls).length).toBe(1);
  });

  it("U: a failed subscription after creating says what happened and reloads the list behind", async () => {
    const { page, calls, navigations } = mount({
      initial: { section: "contacts" },
      handlers: [
        call => isPost("contacts")(call) ? json({ ok: true, created: true, contact: contact(9, { email: "neu@example.test" }) }) : undefined,
        call => call.method === "POST" && call.path.endsWith("/subscriptions") ? json({ ok: false, code: "contact_suppressed", message: "Contact is blocked." }, 409) : undefined
      ]
    });
    await page.findByText("person1@example.test");
    const listLoads = () => calls.filter(call => call.method === "GET" && call.path === "contacts").length;
    const before = listLoads();
    const dialog = await openAddDialog(page, "neu@example.test");
    fireEvent.change(within(dialog).getByLabelText("Subscribe to list"), { target: { value: "list-beta" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    expect((await within(dialog).findByRole("status")).textContent).toBe("The contact was created but is not subscribed to “Beta-Tester”.");
    expect(within(dialog).getByRole("alert").textContent).toContain("Contact is blocked.");
    await waitFor(() => expect(listLoads()).toBeGreaterThan(before));
    fireEvent.click(within(dialog).getByRole("button", { name: "Open contact" }));
    await waitFor(() => expect(navigations.at(-1)).toEqual({ section: "contacts", id: "contact-9" }));
  });
});

describe("contact list filter", () => {
  const fetchStub = stubFetch();
  const view = (location: OutreachLocation, onLocationChange: (location: OutreachLocation) => void = () => {}) => (
    <Theme>
      <OutreachManage accountId={ACCOUNT_ID} accountLabel="news@example.test" role="editor" location={location} mailHref="/"
        onLocationChange={onLocationChange} fetchImpl={fetchStub.fetchImpl} />
    </Theme>
  );

  it("V: follows the list in the address on navigation and Back/Forward", async () => {
    const page = render(view({ section: "contacts", listId: "list-beta" }));
    const select = () => page.getByLabelText("List") as HTMLSelectElement;
    await waitFor(() => expect(select().value).toBe("list-beta"));
    // Sidebar "Contacts" or Back to the unfiltered address.
    page.rerender(view({ section: "contacts" }));
    await waitFor(() => expect(select().value).toBe(""));
    await waitFor(() => expect(fetchStub.calls.at(-1)?.query.get("listId")).toBeNull());
    // Forward again.
    page.rerender(view({ section: "contacts", listId: "list-beta" }));
    await waitFor(() => expect(select().value).toBe("list-beta"));
    await waitFor(() => expect(fetchStub.calls.at(-1)?.query.get("listId")).toBe("list-beta"));
  });

  it("V: choosing a list puts it into the address", async () => {
    const changes: OutreachLocation[] = [];
    const page = render(view({ section: "contacts" }, location => changes.push(location)));
    await waitFor(() => expect(page.getAllByRole("option").length).toBeGreaterThan(5));
    fireEvent.change(page.getByLabelText("List"), { target: { value: "list-beta" } });
    expect(changes.at(-1)).toEqual({ section: "contacts", listId: "list-beta" });
  });
});

describe("contact detail", () => {
  const detail = (patch: Partial<ContactDetail>) => (call: Call) =>
    call.method === "GET" && call.path === `contacts/${CONTACT_DETAIL.id}` ? json({ ok: true, contact: { ...CONTACT_DETAIL, ...patch } }) : undefined;

  it("I: subscribing an unsubscribed list row asks first and repeats with confirmResubscribe", async () => {
    const { page, calls } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [call => {
        if (!(call.method === "POST" && call.path.endsWith("/subscriptions"))) return undefined;
        if ((call.body as { confirmResubscribe?: boolean }).confirmResubscribe !== true) return json(RESUBSCRIBE_409, 409);
        return json({ ok: true, contact: { ...CONTACT_DETAIL, lists: CONTACT_DETAIL.lists.map(entry => ({ ...entry, status: "subscribed" })) } });
      }]
    });
    fireEvent.click(await page.findByRole("button", { name: "Subscribe" }));
    const dialog = await page.findByRole("dialog");
    expect(dialog.textContent).toContain("Subscribe someone who unsubscribed?");
    expect(dialog.textContent).toContain(`person1@example.test unsubscribed on ${UNSUBSCRIBED_AT}`);
    expect(page.queryByRole("alert")).toBeNull();
    expect(subscriptionCalls(calls).length).toBe(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Subscribe anyway" }));
    await waitFor(() => expect(subscriptionCalls(calls).at(-1)?.body).toEqual({ listId: "list-beta", action: "subscribe", consentSource: "manual", confirmResubscribe: true }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(page.getAllByRole("button", { name: "Unsubscribe" }).length).toBe(2));
  });

  it("I: cancelling the confirmation sends nothing more", async () => {
    const { page, calls } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [call => call.method === "POST" && call.path.endsWith("/subscriptions") ? json(RESUBSCRIBE_409, 409) : undefined]
    });
    fireEvent.click(await page.findByRole("button", { name: "Subscribe" }));
    fireEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    expect(subscriptionCalls(calls).length).toBe(1);
  });

  it("AD: a pending membership offers Subscribe as well as Unsubscribe", async () => {
    const { page, calls } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [detail({ lists: [{ listId: "list-news", listName: "Newsletter", status: "pending", subscribedAt: null, unsubscribedAt: null }] })]
    });
    const row = (await page.findByText("Awaiting confirmation")).closest("li")!;
    expect(within(row as HTMLElement).getByRole("button", { name: "Unsubscribe" })).toBeTruthy();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Subscribe" }));
    await waitFor(() => expect(subscriptionCalls(calls).at(-1)?.body).toEqual({ listId: "list-news", action: "subscribe", consentSource: "manual" }));
  });

  it("AC: lifting is offered only for a manual block", async () => {
    const bounced = mount({ role: "manager", initial: { section: "contacts", id: CONTACT_DETAIL.id }, handlers: [detail({ suppressedReason: "hard_bounce", suppressedAt: 1 })] });
    expect(await bounced.page.findByText(/This block cannot be lifted: the address was undeliverable/)).toBeTruthy();
    expect(bounced.page.queryByRole("button", { name: "Lift block" })).toBeNull();
    cleanup();

    const complained = mount({ role: "manager", initial: { section: "contacts", id: CONTACT_DETAIL.id }, handlers: [detail({ suppressedReason: "complaint", suppressedAt: 1 })] });
    expect(await complained.page.findByText(/This block cannot be lifted: the person reported a mail as spam/)).toBeTruthy();
    expect(complained.page.queryByRole("button", { name: "Lift block" })).toBeNull();
    cleanup();

    const manual = mount({ role: "manager", initial: { section: "contacts", id: CONTACT_DETAIL.id }, handlers: [detail({ suppressedReason: "manual", suppressedAt: 1 })] });
    expect(await manual.page.findByRole("button", { name: "Lift block" })).toBeTruthy();
    expect(manual.page.queryByText(/This block cannot be lifted/)).toBeNull();
  });

  it("R: what is typed while a save runs is kept and stays unsaved", async () => {
    const answer = deferred<Response>();
    const { page, calls } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [call => call.method === "PATCH" ? answer.promise : undefined]
    });
    const firstName = await page.findByLabelText("First name") as HTMLInputElement;
    fireEvent.change(firstName, { target: { value: "Alexa" } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(call => call.method === "PATCH")).toBe(true));
    fireEvent.change(firstName, { target: { value: "Alexandra" } });
    await act(async () => { answer.resolve(json({ ok: true, contact: { ...CONTACT_DETAIL, firstName: "Alexa" } })); });
    await waitFor(() => expect(page.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false));
    expect(firstName.value).toBe("Alexandra");
    expect(page.queryByText("Saved.")).toBeNull();
    expect(calls.find(call => call.method === "PATCH")?.body).toEqual({ email: CONTACT_DETAIL.email, firstName: "Alexa", lastName: CONTACT_DETAIL.lastName });
  });

  it("R: a save without typing meanwhile takes the server's values and says saved", async () => {
    const { page } = mount({
      initial: { section: "contacts", id: CONTACT_DETAIL.id },
      handlers: [call => call.method === "PATCH" ? json({ ok: true, contact: { ...CONTACT_DETAIL, firstName: "Alexa" } }) : undefined]
    });
    const firstName = await page.findByLabelText("First name") as HTMLInputElement;
    fireEvent.change(firstName, { target: { value: " Alexa " } });
    fireEvent.click(page.getByRole("button", { name: "Save" }));
    expect(await page.findByText("Saved.")).toBeTruthy();
    expect(firstName.value).toBe("Alexa");
    expect(page.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });
});
