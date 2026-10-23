import { afterEach, expect, it } from "bun:test";
import { cleanup } from "@testing-library/react";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import InAppNoticeStack, { type InAppNotice } from "../InAppNoticeStack";
import { presentDraftSendOutcome } from "./sendOutcome";
import SendWarnings from "./SendWarnings";
afterEach(cleanup);
it("renders accepted draft warnings and forbids an optimistic Sent row when the copy failed", () => {
  const notices: InAppNotice[] = [];
  const result = presentDraftSendOutcome({ sentCopy: "failed", sentCopyWarning: "Sent copy unavailable.", postSendWarning: "Reply flags refresh delayed." }, "Synthetic subject", notice => notices.push({ ...notice, id: String(notices.length) }), "en");
  const view = render(<InAppNoticeStack state={{ inAppNotices: notices }} actions={{ onOpenNotice: () => {}, onDismissNotice: () => {} }} />);
  expect(view.getByText("Draft sent.")).toBeTruthy();
  expect(view.getByText("Sent copy unavailable.")).toBeTruthy();
  expect(view.getByText("Reply flags refresh delayed.")).toBeTruthy();
  expect(result.canCreateSentRow).toBe(false);
  expect(presentDraftSendOutcome({ sentCopy: "appended" }, "Synthetic subject", () => {}, "en").canCreateSentRow).toBe(true);
  expect(presentDraftSendOutcome({ sentCopy: "no-sent-folder" }, "Synthetic subject", () => {}, "en").canCreateSentRow).toBe(false);
});

it("presents the draft-send notice and delivered receipt in German without translating server warnings", () => {
  const notices: InAppNotice[] = [];
  presentDraftSendOutcome({ sentCopy: "no-sent-folder", postSendWarning: "Synthetic server warning." }, "Synthetischer Betreff", notice => notices.push({ ...notice, id: String(notices.length) }), "de");
  const view = render(<I18nTestProvider locale="de"><InAppNoticeStack state={{ inAppNotices: notices }} actions={{ onOpenNotice: () => {}, onDismissNotice: () => {} }} /><SendWarnings warnings={["Synthetic server warning."]} /></I18nTestProvider>);
  expect(view.getByText("Entwurf gesendet.")).toBeTruthy();
  expect(view.getByText("Synthetischer Betreff")).toBeTruthy();
  expect(view.getAllByText("Entwurf mit Warnung gesendet").length).toBeGreaterThan(0);
  expect(notices.map(notice => notice.description)).toContain("E-Mail gesendet, aber die Kopie in „Gesendet“ konnte nicht gespeichert werden. Sende die E-Mail nicht erneut.");
  expect(notices.map(notice => notice.description)).toContain("Synthetic server warning.");
  expect(view.getByText("E-Mail gesendet.")).toBeTruthy();
  expect(view.getByText("Die Zustellung war erfolgreich. Sende die E-Mail nicht erneut.")).toBeTruthy();
});
