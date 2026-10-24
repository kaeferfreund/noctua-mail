// Mailbox-switch spike: shared synthetic fixture (12 shards of mixed size, one MFA user with 12 memberships).
// Imported after sqlcounter.ts so every handle is instrumented. Synthetic data only (example.test).
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();

export type MailboxSpec = { id: string; cls: "small" | "medium" | "large" | "folders"; messages: number; extraFolders: number };
const ALL_MAILBOXES: MailboxSpec[] = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: `syn-s${i}`, cls: "small" as const, messages: 50, extraFolders: 0 })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `syn-m${i}`, cls: "medium" as const, messages: 2000, extraFolders: 0 })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `syn-l${i}`, cls: "large" as const, messages: 11000, extraFolders: 0 })),
  { id: "syn-f0", cls: "folders", messages: 3000, extraFolders: 32 }
];
// SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 builds a subset (profiling runs).
export const MAILBOXES = process.env.SWITCH_FIXTURE_ONLY
  ? ALL_MAILBOXES.filter(m => process.env.SWITCH_FIXTURE_ONLY!.split(",").includes(m.id)) : ALL_MAILBOXES;
const BASE_FOLDERS = ["INBOX", "Sent", "Drafts", "Trash", "Archive", "Junk"];
const SPECIAL: Record<string, string> = { INBOX: "\\Inbox", Sent: "\\Sent", Drafts: "\\Drafts", Trash: "\\Trash", Archive: "\\Archive", Junk: "\\Junk" };

export async function buildFixture() {
  await import(`${ROOT}/lib/testSetupEnv.ts`);
  delete process.env.NOCTUA_MAILBOX_WATCHER;
  const { dbModulePromise } = await import(`${ROOT}/lib/testDbHarness.ts`);
  const api = await dbModulePromise;
  const { getDb, getAccountDb, closeAccountDbConnection } = await import(`${ROOT}/lib/db/connection.ts`);
  const { createAuthenticatedTestSession, getSharedTestAuthHarness } = await import(`${ROOT}/lib/testAuthHarness.ts`);
  const { recomputeThreadsForAccountInternal } = await import(`${ROOT}/lib/db/threads.ts`);
  const { recordMailboxSync } = await import(`${ROOT}/lib/db/mailboxSummary.ts`);
  const master = await getDb();
  const h = await getSharedTestAuthHarness();
  const body = "Synthetic body alpha beta gamma delta epsilon. ".repeat(30);
  const t0 = performance.now();
  for (const [i, mb] of MAILBOXES.entries()) {
    const email = `${mb.id}@example.test`;
    await api.upsertAccount({ id: mb.id, name: `Synthetic ${mb.cls} ${i}`, email, avatar: "",
      imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic-imap-secret" },
      smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp-secret" },
      ...(i % 3 === 0 ? { caldav: { url: "https://dav.example.test/", user: email, password: "synthetic-dav" } } : {}) } as any);
    master.prepare(`INSERT INTO sender_identities(id,accountId,email,displayName,isDefault,enabled,createdAt,updatedAt)
      VALUES(?,?,?,'Synthetic alias',0,1,0,0)`).run(`${mb.id}-alias`, mb.id, `alias-${mb.id}@example.test`);
    const names = [...BASE_FOLDERS, ...Array.from({ length: mb.extraFolders }, (_, f) => `Projekte/Projekt ${String(f).padStart(2, "0")}`)];
    await api.saveFoldersForAccount(mb.id, names.map(name => ({ id: `${mb.id}:${name}`, accountId: mb.id, name, count: 0, unreadCount: 0,
      ...(SPECIAL[name] ? { specialUse: SPECIAL[name] } : {}), ...(name.includes("/") ? { parentId: `${mb.id}:Projekte`, delimiter: "/" } : {}) })) as any);
    // 70 % INBOX, 15 % Sent, 10 % Archive, 5 % spread over the extra folders (or Trash).
    const byFolder = new Map<string, any[]>();
    for (let m = 0; m < mb.messages; m++) {
      const r = m % 20;
      const folder = r < 14 ? "INBOX" : r < 17 ? "Sent" : r < 19 ? "Archive" : (mb.extraFolders ? names[6 + (m % mb.extraFolders)] : "Trash");
      const dateValue = 1767225600000 + m * 60_000;
      const sent = folder === "Sent";
      const msg = { id: `${mb.id}-m${m}`, accountId: mb.id, folderId: `${mb.id}:${folder}`, threadId: `<t${Math.floor(m / 3)}-${mb.id}@example.test>`,
        messageId: `<m${m}-${mb.id}@example.test>`, subject: `Synthetic subject ${m % 997}`, from: sent ? email : `sender${m % 53}@example.test`,
        to: sent ? `peer${m % 41}@example.test` : email, preview: "Synthetic preview text", body, date: new Date(dateValue).toISOString(), dateValue,
        unread: m % 7 === 0, flagged: m % 31 === 0, mailboxPath: folder, imapUid: m + 1, fromEmail: sent ? email : `sender${m % 53}@example.test` };
      (byFolder.get(msg.folderId) ?? byFolder.set(msg.folderId, []).get(msg.folderId)!).push(msg);
    }
    for (const [folderId, msgs] of byFolder) await api.upsertMessages(mb.id, folderId, msgs as any);
    await recomputeThreadsForAccountInternal(mb.id);
    const shard = await getAccountDb(mb.id);
    // Collaboration state on every 5th thread (assignee/status), like an active team mailbox.
    const ins = shard.prepare(`INSERT OR IGNORE INTO thread_collab_state(accountId,threadId,status,assigneeUserId,lastActivityAt,updatedAt,revision) VALUES(?,?,'open',NULL,0,0,1)`);
    shard.transaction(() => { for (let t = 0; t < Math.ceil(mb.messages / 3); t += 5) ins.run(mb.id, `<t${t}-${mb.id}@example.test>`); })();
    await recordMailboxSync(mb.id, Date.now());
    // SWITCH_TOPICS=1: 6 topics, assigned to the oldest threads (off the first page), so first-page threads still
    // compute suggestions against real learning signals.
    if (process.env.SWITCH_TOPICS === "1" && mb.messages >= 2000) {
      const { createTopic, setThreadTopics } = await import(`${ROOT}/lib/topics/core.ts`);
      const topics = [];
      for (let k = 0; k < 6; k++) topics.push(await createTopic(mb.id, `Synthetic topic ${k}`, null));
      const threadCount = Math.ceil(mb.messages / 3);
      for (let t = 0; t < 400; t++) await setThreadTopics(mb.id, `<t${t}-${mb.id}@example.test>`, [topics[t % 6].id]);
      void threadCount;
    }
  }
  const seedMs = performance.now() - t0;
  // Users: the switching user (12 memberships, mixed roles, owner of none), a second active user with the same 12,
  // and 4 plain members spread over the mailboxes (member counts 0–4).
  const roles = ["manager", "editor", "viewer"];
  const user = await createAuthenticatedTestSession();
  const second = await createAuthenticatedTestSession();
  for (const [i, mb] of MAILBOXES.entries()) {
    await h.addMembership(user.user.id, mb.id, roles[i % 3] === "viewer" ? "editor" : roles[i % 3]);
    await h.addMembership(second.user.id, mb.id, "editor");
  }
  for (let k = 0; k < 4; k++) {
    const member = await h.createUser(`member-${k}@example.test`, "");
    for (const [i, mb] of MAILBOXES.entries()) if (i % 5 > k) await h.addMembership(member.id, mb.id, "viewer");
  }
  // Settle runtime probes like a long-running server: open, close, reopen every shard once.
  for (const mb of MAILBOXES) { const db = await getAccountDb(mb.id); closeAccountDbConnection(db.filename); await getAccountDb(mb.id); }
  return { api, master, user, second, seedMs, getAccountDb, closeAccountDbConnection };
}
