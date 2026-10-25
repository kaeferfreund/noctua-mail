import { afterEach, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import ComposeActions from "./ComposeActions";

afterEach(cleanup);
const noop = () => {};

test("saving a draft keeps the Save label (no re-flow of the phone action row) and reports progress in the status", () => {
  const view = render(<Theme><ComposeActions composeDraftId="draft-1" composeOpen canSaveDraft draftSaving draftSaveError={null}
    draftSavedAt={null} sendingMail={false} discardingDraft={false} handleDiscardDraft={noop} handleSaveDraft={noop}
    handleCancel={noop} handleSendMail={noop} formatRelativeTime={() => ""} /></Theme>);
  const save = view.getByRole("button", { name: "Save draft" });
  expect(save.hasAttribute("disabled")).toBe(true);
  expect(save.getAttribute("aria-busy")).toBe("true");
  expect(view.queryByRole("button", { name: "Saving..." })).toBeNull();
  expect(view.getByText("Saving draft…")).toBeTruthy();
});
