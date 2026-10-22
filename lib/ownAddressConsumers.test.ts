import { describe, test, expect } from "bun:test";
import type { Message } from "./data";
import { collectTopicSignalEntries } from "./topicSignals";
import { resolveCalendarParticipationFromPreview } from "./calendarParticipation";
import { classifyCategoryFromMetadata } from "./mail/categorization/classifier";
import { computeComposeInitState } from "../app/components/mailclient/composition/composeInitState";
import { getCollapsedThreadIconParticipant, getMessageFromDisplay } from "../app/components/mailclient/messagelist/threadGroupUtils";
import { planNewMailNotifications } from "../app/components/mailclient/syncNotificationFilter";
const ownAddresses = ["primary@example.test", "alias@example.test", "disabled@example.test"];
const message: Message = { id: "synthetic", accountId: "a", folderId: "a:INBOX", threadId: "t", subject: "Synthetic",
  from: "alias@example.test", to: "primary@example.test, customer@example.test", cc: "disabled@example.test, other@example.test",
  preview: "Synthetic", body: "Synthetic", date: new Date(1000).toISOString(), dateValue: 1000 };
describe("own-address consumers", () => {
  test("compose self reply and reply-all exclude every own address while external Reply-To is retained", () => {
    const compose = (mode: "reply" | "replyAll", source = message) => computeComposeInitState(mode, source, false,
      { accountEmail: "primary@example.test", ownAddresses, accountDateFormat: "locale" },
      { stripHtml: value => value, normalizeHtmlDerivedText: value => value });
    expect(compose("reply").composeTo).toBe("customer@example.test");
    const all = compose("replyAll");
    expect(all.composeTo).toBe("customer@example.test"); expect(all.composeCc).toBe("other@example.test");
    expect(compose("reply", { ...message, from: "external@example.test", replyTo: "list@example.test" }).composeTo).toBe("list@example.test");
  });
  test("thread display/icons and notifications recognize historical aliases", () => {
    expect(getMessageFromDisplay("disabled@example.test", undefined, ownAddresses).isFromUser).toBe(true);
    expect(getCollapsedThreadIconParticipant([{ message, depth: 0 }], ownAddresses)?.fromEmail).toBe("customer@example.test");
    expect(planNewMailNotifications({ items: [{ uid: 2, from: "alias@example.test" }], lastNotifiedUid: 1,
      notifiedKeys: new Set(), isNotificationSuppressedFolder: () => false, accountEmail: ownAddresses }).dispatch.kind).toBe("none");
  });
  test("classification, topic participant signals and calendar attendee matching share the set", () => {
    expect(classifyCategoryFromMetadata({ from: { value: [{ address: "alias@example.test" }] }, subject: "Synthetic" },
      { context: { accountEmail: ownAddresses } }).signals).toContain("skip:sender-is-account");
    const signals = collectTopicSignalEntries([{ fromEmail: "alias@example.test", to: "primary@example.test, customer@example.test" }], { excludeAccountEmail: ownAddresses });
    expect(signals).toEqual([{ type: "recipient", value: "customer@example.test" }]);
    expect(resolveCalendarParticipationFromPreview({ attendeeDetails: [{ email: "alias@example.test", partstat: "ACCEPTED" }] }, ownAddresses)).toMatchObject({ myAttendeeEmail: "alias@example.test", myPartstat: "ACCEPTED" });
  });
});

test("address-like display names never change reply-all, classifier or topic decisions", () => {
  for (const address of ["customer@example.test", "a!tag+part@bücher.example"]) {
    const entry = `"alias@example.test" <${address}>`;
    const canonical = address.replace("bücher", "xn--bcher-kva");
    expect(getCollapsedThreadIconParticipant([{ message: { ...message, from: entry }, depth: 0 }], ownAddresses)?.fromEmail).toBe(canonical);
    const all = computeComposeInitState("replyAll", { ...message, from: "sender@example.test", to: entry, cc: "" }, false,
      { accountEmail: "primary@example.test", ownAddresses, accountDateFormat: "locale" },
      { stripHtml: value => value, normalizeHtmlDerivedText: value => value });
    expect(all.composeCc).toContain(address);
    expect(classifyCategoryFromMetadata({ from: entry }, { context: { accountEmail: ownAddresses } }).signals).not.toContain("skip:sender-is-account");
    expect(collectTopicSignalEntries([{ to: entry }], { excludeAccountEmail: ownAddresses })).toEqual([{ type: "recipient", value: canonical }]);
  }
});
