import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import type { Sequence } from "@/lib/addons/outreach/types";
import { resetOutreachStatusForTests } from "../useOutreachStatus";
import type { OutreachLocation } from "./location";
import { SEQUENCE, json, stubFetch, ManageHarness, type Handler } from "./testFixtures";

afterEach(() => { cleanup(); resetOutreachStatusForTests(); });

const PATH = `sequences/${SEQUENCE.id}`;
const REFUSAL = { ok: false, message: "Die Sequenz wurde inzwischen geändert. Prüfe sie erneut.", code: "sequence_changed" };

/** The sequence as someone else stored it meanwhile: step 2 renamed, the first step's preview text set. */
const THEIRS: Sequence = {
  ...SEQUENCE, updatedAt: SEQUENCE.updatedAt + 500,
  steps: SEQUENCE.steps.map(step => step.id === "step-2" ? { ...step, name: "Tipps neu" } : step.id === "step-1" ? { ...step, subject: "Hallo von woanders" } : step)
};

/**
 * The editor of `SEQUENCE`: the first read answers the loaded version, later reads `stored`. The first PATCH is
 * refused as changed elsewhere, later ones succeed against `stored.updatedAt`.
 */
function mount(stored: Sequence, extra: Handler[] = [], initial: Sequence = SEQUENCE) {
  let reads = 0;
  const stub = stubFetch([
    ...extra,
    call => {
      if (call.method === "GET" && call.path === PATH) return json({ ok: true, sequence: reads++ === 0 ? initial : stored });
      if (call.method !== "PATCH" || call.path !== PATH) return undefined;
      const body = call.body as Record<string, unknown>;
      if (body.expectedUpdatedAt !== stored.updatedAt) return json(REFUSAL, 409);
      return json({ ok: true, sequence: { ...stored, name: body.name, updatedAt: stored.updatedAt + 1 } });
    }
  ]);
  const location: OutreachLocation = { section: "sequences", id: SEQUENCE.id };
  const page = render(<ManageHarness initial={location} fetchImpl={stub.fetchImpl} />);
  return { ...stub, page };
}

const patches = (calls: ReturnType<typeof stubFetch>["calls"]) =>
  calls.filter(call => call.method === "PATCH" && call.path === PATH).map(call => call.body as Record<string, unknown> & { steps: Array<Record<string, unknown>> });
const button = (page: ReturnType<typeof mount>["page"], name: string) => page.getByRole("button", { name }) as HTMLButtonElement;

async function refusedSave(page: ReturnType<typeof mount>["page"]) {
  fireEvent.change(await page.findByLabelText("Name"), { target: { value: "Willkommen neu" } });
  fireEvent.change(page.getByLabelText("Subject"), { target: { value: "Mein Betreff" } });
  fireEvent.click(button(page, "Save"));
  return page.findByRole("alert");
}

describe("a save refused because the sequence changed elsewhere", () => {
  it("offers to keep the typed changes or to discard them", async () => {
    const { page } = mount(THEIRS);
    const alert = await refusedSave(page);
    expect(alert.textContent).toContain("The sequence was changed elsewhere in the meantime");
    expect(within(alert).getByRole("button", { name: "Load the newest version and keep my changes" })).toBeTruthy();
    expect(within(alert).getByRole("button", { name: "Discard my changes" })).toBeTruthy();
    expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("Willkommen neu");
  });

  it("loads the newest version, keeps my changes, lists both-sided ones and saves against the new version", async () => {
    const { page, calls } = mount(THEIRS);
    const alert = await refusedSave(page);
    fireEvent.click(within(alert).getByRole("button", { name: "Load the newest version and keep my changes" }));
    const notice = await page.findByText(/The newest version is loaded/);
    expect(page.queryByRole("alert")).toBeNull();
    // Mine: the name and the first step's subject. Theirs: step 2's name. The subject changed on both sides.
    expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("Willkommen neu");
    expect((page.getByLabelText("Subject") as HTMLInputElement).value).toBe("Mein Betreff");
    expect(page.getByText("2. Tipps neu")).toBeTruthy();
    expect(notice.parentElement!.textContent).toContain("1. Willkommen: Subject");
    expect(within(notice.parentElement!).getAllByRole("listitem")).toHaveLength(1);
    const save = button(page, "Save");
    expect(save.disabled).toBe(false);
    expect(patches(calls)).toHaveLength(1);

    fireEvent.click(save);
    await page.findByText("Sequence saved.");
    const second = patches(calls)[1];
    expect(second).toMatchObject({ name: "Willkommen neu", expectedUpdatedAt: THEIRS.updatedAt });
    expect(second.steps.map(step => [step.id, step.name, step.subject])).toEqual([
      ["step-1", "Willkommen", "Mein Betreff"], ["step-2", "Tipps neu", "Drei Tipps für den Start"], ["step-3", "Funktionen", "Was noch geht"], ["step-4", "Feedback", "Wie gefällt es dir?"]
    ]);
  });

  it("discards my changes by loading the stored version", async () => {
    const { page, calls } = mount(THEIRS);
    const alert = await refusedSave(page);
    fireEvent.click(within(alert).getByRole("button", { name: "Discard my changes" }));
    await waitFor(() => expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe(SEQUENCE.name));
    expect((page.getByLabelText("Subject") as HTMLInputElement).value).toBe("Hallo von woanders");
    expect(page.getByText("2. Tipps neu")).toBeTruthy();
    expect(page.queryByRole("alert")).toBeNull();
    expect(button(page, "Save").disabled).toBe(true);
    expect(patches(calls)).toHaveLength(1);
  });

  it("offers only discarding when the steps were rearranged elsewhere, and keeps the form until then", async () => {
    const moved: Sequence = { ...THEIRS, steps: THEIRS.steps.map(step => ({ ...step, position: step.id === "step-1" ? 1 : step.id === "step-2" ? 0 : step.position })) };
    const { page } = mount(moved);
    const alert = await refusedSave(page);
    fireEvent.click(within(alert).getByRole("button", { name: "Load the newest version and keep my changes" }));
    await waitFor(() => expect(page.getByRole("alert").textContent).toContain("cannot be taken over automatically"));
    const note = page.getByRole("alert");
    expect(within(note).queryByRole("button", { name: "Load the newest version and keep my changes" })).toBeNull();
    expect(within(note).getByRole("button", { name: "Discard my changes" })).toBeTruthy();
    expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("Willkommen neu");
    expect((page.getByLabelText("Subject") as HTMLInputElement).value).toBe("Mein Betreff");

    fireEvent.click(within(note).getByRole("button", { name: "Discard my changes" }));
    await waitFor(() => expect(page.getByText("1. Tipps neu")).toBeTruthy());
    expect(page.queryByRole("alert")).toBeNull();
    expect(button(page, "Save").disabled).toBe(true);
  });

  it("keeps the form's version when pausing answers content changed elsewhere", async () => {
    const paused: Sequence = { ...THEIRS, status: "paused" };
    const { page, calls } = mount(paused, [
      call => call.method === "POST" && call.path === `${PATH}/status` ? json({ ok: true, sequence: paused }) : undefined
    ]);
    const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
    fireEvent.change(await page.findByLabelText("Name"), { target: { value: "Willkommen neu" } });
    fireEvent.click(page.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(dialog()).not.toBeNull());
    fireEvent.click(within(dialog()!).getByRole("button", { name: "Pause" }));
    // Paused, and the choice is offered right away: the answer carried someone else's step texts.
    await page.findByText("The sequence is paused.");
    const alert = await page.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Load the newest version and keep my changes" })).toBeTruthy();
    // A save still names the version the form was loaded from, so it cannot overwrite the other change.
    fireEvent.click(button(page, "Save"));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0].expectedUpdatedAt).toBe(SEQUENCE.updatedAt);
    expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("Willkommen neu");
  });

  it("shows the same choice when going live is refused, outside the dialog", async () => {
    const draft: Sequence = { ...SEQUENCE, status: "draft" };
    const { page } = mount({ ...THEIRS, status: "draft" }, [
      call => call.method === "POST" && call.path === `${PATH}/status` ? json(REFUSAL, 409) : undefined
    ], draft);
    // Role queries over the whole live page (report included) are slow; dialog and note are looked up directly.
    const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
    const note = () => document.querySelector<HTMLElement>("[role=alert]");
    fireEvent.click(await page.findByText("Switch live"));
    await waitFor(() => expect(dialog()).not.toBeNull());
    fireEvent.click(within(dialog()!).getByRole("button", { name: "Switch live" }));
    await waitFor(() => expect(note()).not.toBeNull());
    expect(dialog()).toBeNull();
    expect(within(note()!).getByRole("button", { name: "Load the newest version and keep my changes" })).toBeTruthy();
  });
});
