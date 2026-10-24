// Synthetic 11k shared shard for the review harnesses (review-only, untracked).
// Two accounts on ONE physical shard; account B reuses account A's local
// message ids (FTS v3 collision identity). Everything is @example.test.
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

export const WT = "/home/monkey/code/noctua-mail/wt-review-fts";

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const VOCAB = {
  common: ["synthetic", "report", "meeting", "update", "project", "status"],
  mid: ["invoice", "budget", "review", "planning", "contract", "delivery", "schedule", "agenda"],
  rare: ["needle", "quokka", "zebra", "frobnicate", "haystack", "walrus", "plover"],
  umlaut: ["Grüße", "Köln", "Müller", "Straße", "Übersicht", "fällig", "Ölwechsel", "Größe", "über"],
  dashed: ["budget-2026", "q3-plan", "kick-off", "follow-up"],
  // Frequencies chosen around the default cap (2000) on the 11k shard.
  capBand: ["nearcap", "overcap"]
};

export const PEOPLE = [
  "Alice Example <alice@example.test>",
  "Bob Builder <bob@example.test>",
  "Jürgen Groß <juergen@example.test>",
  "Zoë Ångström <zoe@example.test>",
  "Team Inbox <team@example.test>",
  "news@lists.example.test",
  "billing@shop.example.test",
  "carol@partner.example.test"
];

export const FILES = [
  "invoice-2026-{n}.pdf",
  "budget-2026.xlsx",
  "zebra-plan.pdf",
  "Übersicht_{n}.xlsx",
  "photo_{n}.jpg",
  "quokka-notes.pdf",
  "contract final.docx"
];

export type SeedInfo = { aId: string; bId: string; folders: string[]; threadsA: string[]; dataDir: string };

export async function openOrSeed(dataDir: string, opts: { messages?: number; bMessages?: number } = {}) {
  const N = opts.messages ?? 11000;
  const NB = opts.bMessages ?? 1500;
  const infoPath = dataDir + "/seed-info.json";
  const fresh = !existsSync(infoPath);
  mkdirSync(dataDir, { recursive: true });
  process.env.NOCTUA_DATA_DIR = dataDir;
  process.env.ACCOUNT_DB_IDLE_MS = "0";
  const api: any = await import(WT + "/lib/db.ts");
  const { getDb, getAccountDb } = await import(WT + "/lib/db/connection.ts");
  if (!fresh) {
    const info = JSON.parse(readFileSync(infoPath, "utf8")) as SeedInfo;
    return { info, api, getDb, getAccountDb };
  }
  const aId = "acct-a-review";
  const bId = "acct-b-review";
  for (const id of [aId, bId]) {
    await api.upsertAccount({
      id, name: "Synthetic " + id, email: id + "@example.test", avatar: "",
      imap: { host: "imap.example.test", port: 993, secure: true, user: id + "@example.test", password: "synthetic" },
      smtp: { host: "smtp.example.test", port: 465, secure: true, user: id + "@example.test", password: "synthetic" }
    });
  }
  const master: any = await getDb();
  const { dbPath } = master.prepare("SELECT dbPath FROM accounts WHERE id = ?").get(aId);
  master.prepare("UPDATE accounts SET dbPath = ? WHERE id = ?").run(dbPath, bId);
  const shardA = await getAccountDb(aId);
  const shardB = await getAccountDb(bId);
  if (shardA !== shardB) throw new Error("expected one shared shard connection");
  const folders = ["inbox", "archive", "sent", "trash"];
  for (const id of [aId, bId]) {
    await api.saveFoldersForAccount(id, [
      { id: "inbox", accountId: id, name: "INBOX", count: 0, specialUse: "\\Inbox" },
      { id: "archive", accountId: id, name: "Archive", count: 0 },
      { id: "sent", accountId: id, name: "Sent", count: 0, specialUse: "\\Sent" },
      { id: "trash", accountId: id, name: "Trash", count: 0, specialUse: "\\Trash" }
    ]);
  }
  const base = Date.UTC(2026, 0, 1, 8, 0, 0);
  const build = (accountId: string, i: number, r: () => number, flavour: "a" | "b") => {
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    const words: string[] = [];
    words.push(VOCAB.common[0]); // "synthetic" everywhere -> unselective
    const nw = 6 + Math.floor(r() * 18);
    for (let k = 0; k < nw; k++) {
      const x = r();
      if (x < 0.55) words.push(pick(VOCAB.common));
      else if (x < 0.8) words.push(pick(VOCAB.mid));
      else if (x < 0.9) words.push(pick(VOCAB.umlaut));
      else if (x < 0.97) words.push(pick(VOCAB.dashed));
      else if (x < 0.985) words.push(pick(VOCAB.rare));
    }
    if (i % 400 === 0) words.push("needle");
    if (i % 6 === 1) words.push("nearcap"); // ~1833 hits
    if (i % 4 === 2) words.push("overcap"); // ~2750 hits
    if (flavour === "b" && i % 7 === 0) words.push("banana");
    const subjectWords = [pick(VOCAB.mid), pick(VOCAB.common), ...(r() < 0.2 ? [pick(VOCAB.umlaut)] : []), ...(r() < 0.05 ? [pick(VOCAB.rare)] : [])];
    if (i % 400 === 0) subjectWords.push("needle");
    const thread = Math.floor(i / 3) + (r() < 0.1 ? 7 : 0);
    // Date ties: three consecutive messages share one timestamp and every
    // 50th block reuses an older timestamp, so ORDER BY dateValue ties.
    const slot = i % 50 === 0 ? Math.floor(i / 6) : Math.floor(i / 3);
    const dateValue = base + slot * 60_000;
    const folderRoll = r();
    const folderId = folderRoll < 0.6 ? "inbox" : folderRoll < 0.8 ? "archive" : folderRoll < 0.95 ? "sent" : "trash";
    const flags: string[] = [];
    if (r() < 0.04) flags.push("$Todo");
    if (r() < 0.03) flags.push("$Done");
    const hasAtt = r() < 0.08 || i % 500 === 0;
    const id = "m" + i; // B reuses these ids on the same shard
    const msg: any = {
      id,
      accountId,
      folderId,
      threadId: `th-${flavour}-${thread}`,
      messageId: `<${id}.${flavour}${i % 13 === 0 ? ".xyzzy" : ""}@mail.example.test>`,
      subject: subjectWords.join(" ") + " " + i,
      from: pick(PEOPLE),
      to: pick(PEOPLE),
      cc: r() < 0.2 ? pick(PEOPLE) : undefined,
      bcc: r() < 0.05 ? pick(PEOPLE) : undefined,
      preview: r() < 0.03 ? "previewonly" + (i % 5) + " text" : words.slice(0, 6).join(" "),
      body: words.join(" "),
      date: new Date(dateValue).toISOString(),
      dateValue,
      unread: r() < 0.3,
      flagged: r() < 0.06,
      answered: r() < 0.2,
      deleted: r() < 0.02,
      category: r() < 0.1 ? pick(["newsletter", "notification", "transactional"]) : null,
      flags: flags.length ? flags : undefined,
      attachments: hasAtt
        ? [{ id: `att-${flavour}-${i}`, filename: pick(FILES).replace("{n}", String(i)), contentType: "application/pdf", size: 1000 + i, inline: false }]
        : []
    };
    return msg;
  };
  const r = rng(1234567);
  const t0 = performance.now();
  for (let start = 0; start < N; start += 500) {
    const batch = [];
    for (let i = start; i < Math.min(N, start + 500); i++) batch.push(build(aId, i, r, "a"));
    await api.upsertMessages(aId, null, batch, false, { recomputeThreads: false });
  }
  const rb = rng(7654321);
  for (let start = 0; start < NB; start += 500) {
    const batch = [];
    for (let i = start; i < Math.min(NB, start + 500); i++) batch.push(build(bId, i, rb, "b"));
    await api.upsertMessages(bId, null, batch, false, { recomputeThreads: false });
  }
  const { recomputeThreadsForAccountInternal } = await import(WT + "/lib/db/threads.ts");
  await recomputeThreadsForAccountInternal(aId);
  await recomputeThreadsForAccountInternal(bId);
  // Collab state on ~300 threads of A for collab badges.
  const { upsertThreadCollabState, defaultThreadCollabState } = await import(WT + "/lib/db/threadCollab.ts");
  const threadsA = (shardA.prepare("SELECT threadId FROM threads WHERE accountId=? ORDER BY threadId").all(aId) as any[]).map((x) => x.threadId);
  const rc = rng(99);
  for (const tid of threadsA) {
    if (rc() > 0.08) continue;
    const st = defaultThreadCollabState(aId, tid);
    st.status = (["open", "closed", "in_progress", "waiting"] as const)[Math.floor(rc() * 4)] as any;
    st.assigneeUserId = rc() < 0.5 ? (rc() < 0.5 ? "u-viewer" : "u-other") : null;
    upsertThreadCollabState(shardA as any, st);
  }
  const info: SeedInfo = { aId, bId, folders, threadsA, dataDir };
  writeFileSync(infoPath, JSON.stringify(info));
  console.error(`[seed] ${N}+${NB} messages in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return { info, api, getDb, getAccountDb };
}
