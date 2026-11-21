import { describe, expect, it } from "bun:test";
import type { Folder, Message } from "@/lib/data";
import { collectRecipientListFolderIds } from "@/lib/specialFolders";
import { buildMessageListItems, type ListRowItem } from "./listModel";
import { buildThreadTree, flattenThread, getThreadLatestDate } from "./threadTree";

// Name column per message, by the folder the message itself lies in (Outlook /
// Apple Mail rule): Sent / Drafts of its own mailbox → recipients with the
// arrow; every other folder → the sender, own addresses included.
const BASE = Date.UTC(2026, 10, 21, 8, 0, 0);
const folder = (accountId: string, name: string, specialUse?: string): Folder =>
  ({ id: `${accountId}:${name}`, accountId, name, specialUse, count: 0, unreadCount: 0 });
const folders: Folder[] = [
  folder("acc-a", "INBOX", "\\Inbox"), folder("acc-a", "Sent", "\\Sent"), folder("acc-a", "Drafts", "\\Drafts"),
  // Mailbox B has no special-use flags: the name fallbacks of findSentFolder / findDraftsFolder apply.
  folder("acc-b", "INBOX"), folder("acc-b", "Gesendet"), folder("acc-b", "Entwürfe"), folder("acc-b", "Projekte")
];
const recipientFolderIds = collectRecipientListFolderIds(folders);
const showRecipientsFor = (message: Message) => recipientFolderIds.has(message.folderId);

const ANNA = "Anna Example <anna@example.test>";
const INFO = "Info Desk <info@example.test>";
const CUSTOMER = "Carla Customer <carla@example.invalid>";

function mail(id: string, accountId: string, folderName: string, from: string, to: string, minute: number,
  extra: Partial<Message> = {}): Message {
  return {
    id, accountId, folderId: `${accountId}:${folderName}`, threadId: extra.threadId ?? `<${id}@example.test>`,
    messageId: `<${id}@example.test>`, subject: `Subject ${id}`, from, to, preview: "", body: "",
    date: new Date(BASE + minute * 60_000).toISOString(), dateValue: BASE + minute * 60_000, ...extra
  };
}

function rows(items: Message[], options: {
  activeFolderId: string;
  userEmail?: string[];
  searchScope?: "folder" | "all";
  expanded?: boolean;
}): Map<string, ListRowItem> {
  const collapsedThreads: Record<string, boolean> = {};
  if (options.expanded) items.forEach((item) => { collapsedThreads[item.threadId] = false; });
  const list = buildMessageListItems({
    groupedMessages: [{ key: "Today", label: "Today", items }],
    collapsedGroups: {},
    collapsedThreads,
    supportsThreads: true,
    includeThreadAcrossFolders: true,
    searchScope: options.searchScope ?? "folder",
    activeFolderId: options.activeFolderId,
    buildThreadTree,
    flattenThread,
    getThreadLatestDate,
    userEmail: options.userEmail,
    showRecipientsFor,
    mode: "nested",
    locale: "en"
  });
  return new Map(list.filter((item): item is ListRowItem => item.type === "row").map((row) => [row.message.id, row]));
}

describe("collectRecipientListFolderIds", () => {
  it("collects Sent and Drafts of every mailbox, by special use or name", () => {
    expect([...recipientFolderIds].sort()).toEqual(["acc-a:Drafts", "acc-a:Sent", "acc-b:Entwürfe", "acc-b:Gesendet"]);
  });
});

describe("name column by the message's own folder", () => {
  it("domain view: A's mail in B's inbox shows sender A and A's reply in A's Sent its recipient, whatever mailbox is active", () => {
    const toB = mail("to-b", "acc-b", "INBOX", ANNA, INFO, 0);
    const reply = mail("reply", "acc-a", "Sent", ANNA, CUSTOMER, 1);
    for (const active of [{ folder: "acc-a:INBOX", own: ["anna@example.test"] }, { folder: "acc-b:INBOX", own: ["info@example.test"] }]) {
      const byId = rows([toB, reply], { activeFolderId: active.folder, userEmail: active.own, searchScope: "all" });
      expect(byId.get("to-b")).toMatchObject({ fromText: "Anna Example", showRecipientIcon: false, iconFrom: ANNA });
      expect(byId.get("reply")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: true });
    }
  });

  it("Sent thread: the inbound member shows its sender, the own reply its recipient", () => {
    const threadId = "<question@example.test>";
    const question = mail("question", "acc-b", "INBOX", CUSTOMER, INFO, 0, { threadId });
    const answer = mail("answer", "acc-b", "Gesendet", INFO, CUSTOMER, 1, { threadId, inReplyTo: "<question@example.test>", parentId: "question" });
    const byId = rows([question, answer], { activeFolderId: "acc-b:Gesendet", expanded: true });
    expect(byId.get("question")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: false });
    expect(byId.get("answer")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: true });
  });

  it("own mail in the inbox (contact form info@ → info@) shows the sender, not 'Me' and not the recipient", () => {
    const form = mail("form", "acc-b", "INBOX", INFO, INFO, 0);
    const byId = rows([form], { activeFolderId: "acc-b:INBOX", userEmail: ["info@example.test"] });
    expect(byId.get("form")).toMatchObject({ fromText: "Info Desk", showRecipientIcon: false, iconFrom: INFO });
  });

  it("search or topic opened from Sent: inbound mail shows its sender, sent mail and drafts their recipients", () => {
    const inbound = mail("inbound", "acc-a", "INBOX", CUSTOMER, ANNA, 0);
    const custom = mail("custom", "acc-b", "Projekte", CUSTOMER, INFO, 1);
    const sent = mail("sent", "acc-a", "Sent", ANNA, CUSTOMER, 2);
    const draft = mail("draft", "acc-b", "Entwürfe", INFO, CUSTOMER, 3);
    const byId = rows([inbound, custom, sent, draft], { activeFolderId: "acc-a:Sent", searchScope: "all" });
    expect(byId.get("inbound")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: false });
    expect(byId.get("custom")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: false });
    expect(byId.get("sent")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: true });
    expect(byId.get("draft")).toMatchObject({ fromText: "Carla Customer", showRecipientIcon: true });
  });

  it("collapsed thread header lists recipients only when every message lies in Sent or Drafts", () => {
    const threadId = "<conv@example.test>";
    const first = mail("first", "acc-a", "Sent", ANNA, CUSTOMER, 0, { threadId });
    const second = mail("second", "acc-a", "Sent", ANNA, CUSTOMER, 1, { threadId, inReplyTo: "<first@example.test>", parentId: "first" });
    const onlySent = [...rows([first, second], { activeFolderId: "acc-a:INBOX", userEmail: ["anna@example.test"] }).values()];
    expect(onlySent).toHaveLength(1);
    expect(onlySent[0].fromText).toBe("Carla Customer");
    // Like a single row in Sent: the arrow, not the recipient's avatar.
    expect(onlySent[0].showRecipientIcon).toBe(true);
    const inbound = mail("inbound2", "acc-a", "INBOX", CUSTOMER, ANNA, 2, { threadId, inReplyTo: "<second@example.test>", parentId: "second" });
    const mixed = [...rows([first, second, inbound], { activeFolderId: "acc-a:Sent", userEmail: ["anna@example.test"] }).values()];
    expect(mixed).toHaveLength(1);
    expect(mixed[0].fromText.split(", ").sort()).toEqual(["Carla Customer", "Me"]);
    expect(mixed[0].showRecipientIcon).toBe(false);
  });
});
