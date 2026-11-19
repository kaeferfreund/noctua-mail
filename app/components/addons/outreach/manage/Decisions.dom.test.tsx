import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render as testingLibraryRender, within } from "@testing-library/react";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import type { ReactNode } from "react";
import type { Campaign, Sequence } from "@/lib/addons/outreach/types";
import type { OutreachLocation } from "./location";
import { ACCOUNT_ID, CONTACT_DETAIL, ManageHarness, REPORT, SENT, SEQUENCE, json, stubFetch, type Call } from "./testFixtures";

/** Decisions AA (erase keeps a block) and AE (who scheduled, through what) in the newsletter area; synthetic data only. */

afterEach(cleanup);

const MCP_VIA = "mcp:Assistent (…a1b2)";
const membersPath = `/api/accounts/${ACCOUNT_ID}/members`;

function mount(initial: OutreachLocation, answers: { campaign?: Campaign; sequence?: Sequence } = {}, locale: "en" | "de" = "en") {
  const stub = stubFetch([(call: Call) => {
    if (answers.campaign && call.path === `campaigns/${SENT.id}`) return json({ ok: true, campaign: answers.campaign });
    if (answers.campaign && call.path === `campaigns/${SENT.id}/report`) {
      const { html: _html, text: _text, ...meta } = answers.campaign;
      void _html; void _text;
      return json({ ...REPORT, campaign: { ...REPORT.campaign, ...meta } });
    }
    if (answers.sequence && call.path === `sequences/${SEQUENCE.id}`) return json({ ok: true, sequence: answers.sequence });
    return undefined;
  }]);
  const ui = <ManageHarness initial={initial} fetchImpl={stub.fetchImpl} />;
  const page = locale === "en" ? render(ui)
    : testingLibraryRender(ui, { wrapper: ({ children }: { children: ReactNode }) => <I18nTestProvider locale="de">{children}</I18nTestProvider> });
  return { ...stub, page };
}

describe("AA: deleting a contact", () => {
  it("says that the address stays blocked and needs a new consent", async () => {
    const { page } = mount({ section: "contacts", id: CONTACT_DETAIL.id });
    fireEvent.click(await page.findByRole("button", { name: "Delete" }));
    const dialog = await page.findByRole("dialog");
    expect(dialog.textContent).toContain("all of this person's opens and clicks");
    expect(dialog.textContent).toContain("The address stays blocked afterwards");
    expect(dialog.textContent).toContain("only after the person has given new consent");
  });

  it("says it in German too", async () => {
    const { page } = mount({ section: "contacts", id: CONTACT_DETAIL.id }, {}, "de");
    fireEvent.click(await page.findByRole("button", { name: "Löschen" }));
    const dialog = await page.findByRole("dialog");
    expect(within(dialog).getByText(/Die Adresse bleibt danach gesperrt/).textContent)
      .toContain("Wieder eintragen lässt sie sich erst, wenn die Person neu eingewilligt hat.");
  });
});

describe("AE: where scheduled work came from", () => {
  it("names the user and the MCP token in the campaign view", async () => {
    const { page } = mount({ section: "campaigns", id: SENT.id }, { campaign: { ...SENT, scheduledByUserId: "user-erika", scheduledVia: MCP_VIA } });
    expect(await page.findByText("Scheduled by Erika Beispiel through the MCP token “Assistent” (…a1b2)")).toBeTruthy();
  });

  it("writes the German sentence", async () => {
    const { page } = mount({ section: "campaigns", id: SENT.id }, { campaign: { ...SENT, scheduledByUserId: "user-erika", scheduledVia: MCP_VIA } }, "de");
    expect(await page.findByText("Geplant von Erika Beispiel über das MCP-Token „Assistent“ (…a1b2)")).toBeTruthy();
  });

  it("falls back to the address for a member without a name and to a neutral sentence for a former member", async () => {
    const { page } = mount({ section: "campaigns", id: SENT.id }, { campaign: { ...SENT, scheduledByUserId: "user-max", scheduledVia: "app" } });
    expect(await page.findByText("Scheduled by max@example.test in the app")).toBeTruthy();
    cleanup();
    const former = mount({ section: "campaigns", id: SENT.id }, { campaign: { ...SENT, scheduledByUserId: "user-gone", scheduledVia: MCP_VIA } });
    expect(await former.page.findByText("Scheduled through the MCP token “Assistent” (…a1b2)")).toBeTruthy();
  });

  it("shows nothing for a campaign scheduled before the trace existed", async () => {
    const { page, calls } = mount({ section: "campaigns", id: SENT.id });
    await page.findByRole("heading", { name: SENT.name });
    await page.findByText("https://www.example.test/neu");
    expect(page.queryByText(/^Scheduled/)).toBeNull();
    expect(calls.some(call => call.path === membersPath)).toBe(false);
  });

  it("names who switched a sequence live and through what in the sequence editor", async () => {
    const { page } = mount({ section: "sequences", id: SEQUENCE.id }, { sequence: { ...SEQUENCE, statusChangedByUserId: "user-erika", statusChangedVia: "app" } });
    expect(await page.findByText("Switched live by Erika Beispiel in the app")).toBeTruthy();
    cleanup();
    const paused = mount({ section: "sequences", id: SEQUENCE.id },
      { sequence: { ...SEQUENCE, status: "paused", statusChangedByUserId: "user-erika", statusChangedVia: MCP_VIA } }, "de");
    expect(await paused.page.findByText("Pausiert von Erika Beispiel über das MCP-Token „Assistent“ (…a1b2)")).toBeTruthy();
  });
});
