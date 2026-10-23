import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import type { SenderIdentity } from "@/lib/data";
import ComposeFields from "./ComposeFields";
import ComposeActions from "./ComposeActions";
afterEach(cleanup);
const identities = ["primary", "alias", "disabled"].map(id => ({ id, accountId: "a", email: `${id}@example.test`, displayName: `Synthetic ${id}`, enabled: id !== "disabled", isDefault: id === "primary" } as SenderIdentity));

function fields(variant: "inline" | "modal", extra: Partial<React.ComponentProps<typeof ComposeFields>> = {}) {
  let selected = "", dirty = 0;
  const props = { variant, composeSubject: "", composeTo: "", composeCc: "", composeBcc: "", composeShowBcc: false, activeAccountId: "a", identityId: "primary", identities,
    setComposeSubject: () => {}, setComposeTo: () => {}, setComposeCc: () => {}, setComposeBcc: () => {}, setComposeShowBcc: () => {}, applyRecipientSelection: (current: string) => current, loadRecipientOptions: async () => [], getComposeToken: (value: string) => value,
    markComposeDirty: () => { dirty++; }, onIdentityChange: (id: string) => { selected = id; }, ...extra };
  const view = render(<Theme><ComposeFields {...props} /></Theme>);
  return { view, selected: () => selected, dirty: () => dirty };
}

describe("compose From control", () => {
  for (const variant of ["inline", "modal"] as const) test(`${variant}: From label is associated and only enabled identities can be selected`, async () => {
    const { view, selected, dirty } = fields(variant);
    const trigger = view.getByLabelText("From:", { exact: true });
    expect(trigger.id).toBe(`compose-${variant}-from`);
    expect(trigger.textContent).toContain("primary@example.test");
    fireEvent.click(trigger);
    const alias = await view.findByRole("option", { name: /Synthetic alias/ });
    expect(view.queryByRole("option", { name: /disabled@example.test/ })).toBeNull();
    expect(view.getByRole("option", { name: /mailbox default/ })).toBeTruthy();
    fireEvent.click(alias);
    await waitFor(() => expect(selected()).toBe("alias")); expect(dirty()).toBe(1);
  });
  test("mobile modal retains the From row even with a single identity", () => {
    const { view } = fields("modal", { identities: [identities[0]] });
    const from = view.getByLabelText("From:", { exact: true });
    expect(from.closest('[hidden], [aria-hidden="true"]')).toBeNull();
    expect(from.textContent).toContain("primary@example.test");
    expect(view.getByLabelText("To:", { exact: true })).toBeTruthy();
  });
  test("a stale draft retains its unavailable From label and exposes guidance", () => {
    const { view } = fields("inline", { identityId: "unknown", fromValue: "old@example.test", senderMessage: "Choose an enabled sender and save the draft." });
    expect(view.getByLabelText("From:").textContent).toContain("old@example.test — unavailable");
    expect(view.getByRole("alert").textContent).toContain("Choose an enabled sender");
    expect(view.getByRole("link", { name: "Review From" }).getAttribute("href")).toBe("#compose-inline-from");
  });
  test("viewer From selection and send are disabled", () => {
    const { view } = fields("modal", { identityDisabled: true });
    expect((view.getByLabelText("From:") as HTMLButtonElement).disabled).toBe(true);
    const actions = render(<Theme><ComposeActions composeDraftId={null} composeOpen canSaveDraft={false} draftSaving={false} draftSaveError={null} draftSavedAt={null} sendingMail={false} discardingDraft={false} sendDisabled handleDiscardDraft={() => {}} handleSaveDraft={() => {}} handleCancel={() => {}} handleSendMail={() => { throw Error("viewer sent"); }} formatRelativeTime={() => ""} /></Theme>);
    expect((actions.getByRole("button", { name: /^Send$/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
