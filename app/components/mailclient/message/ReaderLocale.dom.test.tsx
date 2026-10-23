import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import ThreadSubject from "./ThreadSubject";
import InAppNoticeStack from "../InAppNoticeStack";

afterEach(cleanup);

test("switching reader locale preserves expanded subject and semantic undo action", async () => {
  const subject = "Synthetic original Subject {untouched}";
  let undone = 0;
  const content = <>
    <ThreadSubject subject={subject} />
    <InAppNoticeStack state={{ inAppNotices: [{
      id: "synthetic-undo", type: "success", title: subject,
      actionKind: "undo", onAction() { undone++; }, expiresAt: null
    }] }} actions={{ onOpenNotice() {}, onDismissNotice() {} }} />
  </>;
  const view = render(<I18nTestProvider locale="en">{content}</I18nTestProvider>);
  fireEvent.click(view.getByRole("button", { name: "Expand subject" }));
  view.rerender(<I18nTestProvider locale="de">{content}</I18nTestProvider>);
  expect(view.getByRole("button", { name: "Betreff einklappen" })).toBeTruthy();
  expect(view.getAllByText(subject).length).toBe(2);
  await act(async () => { fireEvent.click(view.getByRole("button", { name: "Rückgängig" })); });
  expect(undone).toBe(1);
});
