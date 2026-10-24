// V2 differential: normalized threads-route responses for many views, to compare base vs branch.
//   SWITCH_ROOT=<checkout> SWITCH_FIXTURE_ONLY=syn-s0,syn-m0,syn-l0 [SWITCH_TOPICS=1] bun v2diff.ts out.json
// Adds edge data to every mailbox: recent dates (Today/Yesterday/This Week in Europe/Berlin), equal dateValues
// (tie-break), flagged non-first messages, alias / free-mail / own-address senders, attachments.
import { writeFileSync } from "node:fs";
import "./sqlcounter";
import { buildFixture, MAILBOXES } from "./fixture";
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const fx = await buildFixture();
const threads = await import(`${ROOT}/app/api/accounts/[accountId]/threads/route.ts`);
const { recomputeThreadsForAccountInternal } = await import(`${ROOT}/lib/db/threads.ts`);
const ORIGIN = "http://localhost:3000";
const DAY = 864e5;
const now = Math.floor(Date.now() / 3600e3) * 3600e3; // same anchor for base and branch runs within the hour
for (const mb of MAILBOXES) {
  const id = mb.id; const email = `${id}@example.test`;
  const extra: any[] = [];
  const add = (n: number, folder: string, dateValue: number, o: any = {}) => extra.push({ id: `${id}-x${n}`, accountId: id, folderId: `${id}:${folder}`,
    threadId: o.threadId ?? `<x${n}-${id}@example.test>`, messageId: `<x${n}-${id}@example.test>`, subject: `Edge subject ${n}`,
    from: o.from ?? `edge${n % 5}@example.test`, to: o.to ?? email, preview: "Edge preview", body: "Edge body", date: new Date(dateValue).toISOString(),
    dateValue, unread: n % 2 === 0, flagged: !!o.flagged, mailboxPath: folder, imapUid: 100000 + n, fromEmail: o.from ?? `edge${n % 5}@example.test` });
  let n = 0;
  for (const age of [0.01, 0.3, 0.9, 1.2, 2.5, 4, 6.5, 8, 15]) add(n++, "INBOX", now - age * DAY);
  // Equal dateValues inside one thread and across threads (tie-break order).
  const tie = now - 3 * DAY;
  for (let k = 0; k < 4; k++) add(n++, "INBOX", tie, { threadId: `<tie-${id}@example.test>` });
  for (let k = 0; k < 3; k++) add(n++, "INBOX", tie);
  // Flagged second message of a thread; thread spanning INBOX + Trash.
  add(n++, "INBOX", now - 5 * DAY, { threadId: `<fl-${id}@example.test>` });
  add(n++, "INBOX", now - 5.5 * DAY, { threadId: `<fl-${id}@example.test>`, flagged: true });
  add(n++, "Trash", now - 1.5 * DAY, { threadId: `<fl-${id}@example.test>` });
  // Alias, own address, free-mail sender, own address as recipient.
  add(n++, "INBOX", now - 0.5 * DAY, { from: `alias-${id}@example.test` });
  add(n++, "INBOX", now - 0.6 * DAY, { from: `Someone <someone@gmail.com>` });
  add(n++, "INBOX", now - 0.7 * DAY, { from: email, to: `alias-${id}@example.test, peer1@example.test` });
  await fx.api.upsertMessages(id, `${id}:INBOX`, extra.filter(m => m.folderId.endsWith(":INBOX")));
  await fx.api.upsertMessages(id, `${id}:Trash`, extra.filter(m => m.folderId.endsWith(":Trash")));
  await recomputeThreadsForAccountInternal(id);
}
const topicIds = new Map<string, string>();
const normalize = (v: any): any => {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") {
    const o: any = {};
    const isTopic = typeof v.name === "string" && "imapKeyword" in v;
    if (isTopic) topicIds.set(v.id, `topic:${v.name}`);
    for (const [k, x] of Object.entries(v)) o[k] = isTopic && k === "id" ? `topic:${v.name}` : isTopic && k === "imapKeyword" ? `kw:${v.name}`
      : isTopic && (k === "createdAt" || k === "updatedAt") ? 0 : normalize(x);
    return o;
  }
  return typeof v === "string" && topicIds.has(v) ? topicIds.get(v) : v;
};
const out: Record<string, any> = {};
for (const mb of MAILBOXES) {
  const id = mb.id;
  const other = MAILBOXES.find(m => m.id !== id)?.id ?? "syn-other";
  const inbox = `folderId=${encodeURIComponent(`${id}:INBOX`)}`;
  const views: Record<string, string> = {
    default: `page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&${inbox}`,
    page2: `page=2&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&${inbox}`,
    page3_50: `page=3&pageSize=50&groupBy=date&${inbox}`,
    latestDate: `page=1&pageSize=300&groupBy=date&threadDateSource=latestDateValue&${inbox}`,
    week: `page=1&pageSize=300&groupBy=week&${inbox}`,
    year: `page=1&pageSize=300&groupBy=year&${inbox}`,
    sender: `page=1&pageSize=300&groupBy=sender&${inbox}`,
    domain: `page=1&pageSize=300&groupBy=domain&${inbox}`,
    none: `page=1&pageSize=300&groupBy=none&${inbox}`,
    event: `page=1&pageSize=100&groupBy=event&${inbox}`,
    inviteDate: `page=1&pageSize=100&groupBy=invite-date&${inbox}`,
    unread: `page=1&pageSize=300&groupBy=date&badges=unread&${inbox}`,
    flagged: `page=1&pageSize=300&groupBy=date&badges=flagged&${inbox}`,
    attachments: `page=1&pageSize=300&groupBy=date&attachments=1&${inbox}`,
    allMail: `page=1&pageSize=300&groupBy=date`,
    allMailPage2: `page=2&pageSize=300&groupBy=date`,
    allMailExcl: `page=1&pageSize=300&groupBy=date&excludeFolderIds=${encodeURIComponent(`${id}:Trash,${id}:Junk`)}`,
    inboxExcl: `page=1&pageSize=300&groupBy=date&${inbox}&excludeFolderIds=${encodeURIComponent(`${id}:Trash`)}`,
    searchSubject: `page=1&pageSize=300&groupBy=date&${inbox}&q=${encodeURIComponent("Edge subject")}`,
    searchFrom: `page=1&pageSize=300&groupBy=date&q=${encodeURIComponent("from:sender5@example.test")}`,
    searchFromMe: `page=1&pageSize=300&groupBy=date&q=${encodeURIComponent("from:me")}`,
    searchTo: `page=1&pageSize=300&groupBy=date&q=${encodeURIComponent("to:peer1@example.test")}`,
    searchIn: `page=1&pageSize=300&groupBy=date&q=${encodeURIComponent("in:trash")}`,
    noTopic: `page=1&pageSize=300&groupBy=date&${inbox}&q=${encodeURIComponent("topic:none")}`,
    foreignFolder: `page=1&pageSize=300&groupBy=date&folderId=${encodeURIComponent(`${other}:INBOX`)}`,
    foreignExcl: `page=1&pageSize=300&groupBy=date&${inbox}&excludeFolderIds=${encodeURIComponent(`${other}:Trash`)}`
  };
  for (const [name, qs] of Object.entries(views)) {
    const res = await threads.GET(new Request(`${ORIGIN}/api/accounts/${id}/threads?${qs}`, { headers: { cookie: fx.user.jar.header(), origin: ORIGIN } }),
      { params: Promise.resolve({ accountId: id }) });
    const text = await res.text();
    let body: any; try { body = normalize(JSON.parse(text)); } catch { body = text; }
    out[`${id}/${name}`] = { status: res.status, body };
  }
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log("views", Object.keys(out).length);
process.exit(0);
