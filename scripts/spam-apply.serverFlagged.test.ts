import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildImapMessageRowId } from "../lib/messageIds";
import { startImapServer } from "./dev-fixture/imap-server";
import type { SeedMessage, SeedSpec } from "./spam-apply.serverFlagged.test.fixture";

const run = promisify(execFile);
const repo = join(import.meta.dir, "..");
const DAY = 24 * 60 * 60_000;
const TEAM = "acc-team";
const OFFICE = "acc-office";
const NOJUNK = "acc-plain";

/** Runs a script of this repo with an isolated synthetic environment (no API key, explicit data dir). */
async function bun(args: string[], env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await run(process.execPath, args, {
      cwd: repo, timeout: 30_000, maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, ANTHROPIC_API_KEY: "", ...env }
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, output: `${failed.stdout ?? ""}${failed.stderr ?? ""}` };
  }
}

function source(mail: { messageId: string; from: string; to: string; subject: string; date: number; spamFlag: "YES" | "NO"; forgedLowerFlag?: boolean }) {
  const stamp = new Date(mail.date).toUTCString();
  return [
    `Received: from relay.sender.test by mx.example.test; ${stamp}`,
    `X-Spam-Flag: ${mail.spamFlag}`,
    `X-Spam-Status: ${mail.spamFlag === "YES" ? "Yes, score=7.4" : "No, score=0.3"}`,
    "Received: from origin.sender.test by relay.sender.test",
    ...(mail.forgedLowerFlag ? ["X-Spam-Flag: YES"] : []),
    `From: ${mail.from}`, `To: ${mail.to}`, `Subject: ${mail.subject}`, `Message-ID: ${mail.messageId}`, `Date: ${stamp}`,
    "Content-Type: text/plain; charset=utf-8", "", "Synthetischer Inhalt der Testnachricht.", ""
  ].join("\r\n");
}

test("server-flagged backfill: the dry run lists every exclusion, the real run moves only reviewed candidates and resumes", async () => {
  const root = mkdtempSync(join(tmpdir(), "spam-server-flagged-"));
  const dataDir = join(root, "data");
  const outDir = join(root, "out");
  mkdirSync(outDir, { recursive: true });
  const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
  try {
    const now = Date.now();
    const old = now - 30 * DAY;
    const messages: SeedMessage[] = [];
    const add = (key: string, mail: { accountId?: string; folder?: string; from: string; to?: string; subject?: string; spamFlag?: "YES" | "NO"; date?: number;
      flags?: string[]; inReplyTo?: string; checked?: boolean; topic?: boolean; forgedLowerFlag?: boolean }) => {
      const messageId = `<${key}@sender.test>`;
      const accountId = mail.accountId ?? TEAM;
      const folder = mail.folder ?? "INBOX";
      const date = mail.date ?? old;
      const raw = source({ messageId, from: mail.from, to: mail.to ?? "team@example.test", subject: mail.subject ?? `Angebot ${key}`, date,
        spamFlag: mail.spamFlag ?? "YES", forgedLowerFlag: mail.forgedLowerFlag });
      // Only the team mailbox talks to the IMAP fixture; the others never move.
      const uid = accountId === TEAM ? server.store.append(folder, Buffer.from(raw), mail.flags ?? [], new Date(date)).uid : messages.length + 1;
      messages.push({ key, accountId, folder, messageId, from: mail.from, to: mail.to ?? "team@example.test", subject: mail.subject ?? `Angebot ${key}`,
        dateValue: date, source: raw, imapUid: uid, flags: mail.flags, inReplyTo: mail.inReplyTo, checked: mail.checked, topic: mail.topic });
    };
    add("spam1", { from: "Angebote <offer@cheap-pills.test>" });
    add("spam2", { from: "promo@bulk-mailer.test" });
    add("unflagged", { from: "info@newsletter.test", spamFlag: "NO" });
    add("forged", { from: "info@forged.test", spamFlag: "NO", forgedLowerFlag: true });
    add("correspondent", { from: "partner@client.test" });
    add("household-correspondent", { from: "friend@elsewhere.test" });
    add("flagged", { from: "deal@shop-deals.test", flags: ["\\Flagged"] });
    add("answered", { from: "query@answered.test", flags: ["\\Answered"] });
    add("not-junk", { from: "notice@nonjunk.test", flags: ["NONJUNK"] });
    add("ham-sender", { from: "orders@platform.test" });
    add("ham-domain", { from: "noreply@mail.platform.test" });
    add("own-domain", { from: "newsletter@example.test" });
    add("static-allow", { from: "alerts@allowed-list.test" });
    add("replied", { from: "asker@question.test" });
    add("collab", { from: "lead@collab.test", topic: true });
    add("checked", { from: "seen@classifier.test", checked: true });
    add("recent", { from: "fresh@recent.test", date: now - DAY });
    add("history-a", { from: "service@known-shop.test", spamFlag: "NO" });
    add("history-b", { from: "Service <service@known-shop.test>", spamFlag: "NO" });
    add("history", { from: "service@known-shop.test" });
    add("nojunk", { accountId: NOJUNK, from: "promo@bulk-mailer.test", to: "info@example.test" });
    // Sent mail: the team wrote to partner@client.test and replied to asker@question.test; the office wrote to friend@elsewhere.test.
    add("sent-partner", { folder: "Sent", from: "team@example.test", to: "partner@client.test", spamFlag: "NO" });
    add("sent-reply", { folder: "Sent", from: "team@example.test", to: "other@question.test", spamFlag: "NO", inReplyTo: "<replied@sender.test>" });
    add("sent-office", { accountId: OFFICE, folder: "Sent", from: "office@example.test", to: "friend@elsewhere.test", spamFlag: "NO" });

    const spec: SeedSpec = {
      accounts: [
        { id: TEAM, email: "team@example.test", imapPort: server.port, folders: [{ path: "INBOX", specialUse: "\\Inbox" }, { path: "Sent", specialUse: "\\Sent" }, { path: "Junk", specialUse: "\\Junk" }] },
        { id: OFFICE, email: "office@example.test", imapPort: server.port, folders: [{ path: "INBOX", specialUse: "\\Inbox" }, { path: "Sent", specialUse: "\\Sent" }] },
        { id: NOJUNK, email: "info@example.test", imapPort: server.port, folders: [{ path: "INBOX", specialUse: "\\Inbox" }] }
      ],
      messages,
      hamExamples: [{ accountId: TEAM, senderEmail: "orders@platform.test", senderDomain: "platform.test" }],
      users: [{ id: "user-admin", email: "admin@example.test", role: "admin" }, { id: "user-plain", email: "member@example.test", role: "user" }],
      mailboxSettings: [{ accountId: TEAM, settings: { autoMove: true } }]
    };
    const specPath = join(root, "spec.json");
    writeFileSync(specPath, JSON.stringify(spec));
    const seeded = await bun(["scripts/spam-apply.serverFlagged.test.fixture.ts", specPath], { NOCTUA_DATA_DIR: dataDir });
    expect(seeded.output).not.toContain("error");
    expect(seeded.code).toBe(0);
    writeFileSync(join(dataDir, "spam-static-rules.json"), JSON.stringify({ allow: [{ type: "address", value: "alerts@allowed-list.test" }] }));

    // Dry run: read-only, every server-flagged INBOX mail with its decision.
    const listPath = join(outDir, "flagged.json");
    const dry = await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir, "--dry-run", "--out", listPath]);
    expect(dry.code).toBe(0);
    expect(dry.output).not.toContain("Synthetischer Inhalt");
    expect(statSync(listPath).mode & 0o777).toBe(0o600);
    const list = JSON.parse(readFileSync(listPath, "utf8")) as { items: Array<{ id: string; accountId: string; decision: string; reasons: string[]; score: number | null; senderUnflagged: number; domainUnflagged: number }> };
    const decisions = Object.fromEntries(list.items.map((item) => [messages.find((message) => buildImapMessageRowId(message.messageId) === item.id)!.key, item.decision]));
    expect(decisions).toEqual({
      spam1: "move", spam2: "move",
      correspondent: "correspondent", "household-correspondent": "correspondent",
      flagged: "flagged", answered: "answered", "not-junk": "not-junk",
      "ham-sender": "ham-example", "ham-domain": "ham-domain", "own-domain": "own-domain", "static-allow": "static-allow",
      replied: "replied", collab: "collab", checked: "classifier-decided", recent: "classifier-window", history: "sender-history", nojunk: "no-junk-folder"
    });
    expect(list.items.find((item) => item.decision === "move")?.score).toBe(7.4);
    expect(list.items.find((item) => item.decision === "sender-history")).toMatchObject({ senderUnflagged: 2, domainUnflagged: 2 });
    expect(dry.output).toContain("move 2");
    // Nothing moved on IMAP (the fixture's own seed mails in Junk aside).
    const junkIds = () => server.store.get("Junk").messages.map((message) => message.mime.raw.toString().match(/^Message-ID: (.+)$/m)?.[1]?.trim())
      .filter((id) => id?.endsWith("@sender.test>"));
    expect(junkIds()).toEqual([]);

    // The eval-file selection is unchanged.
    const evalPath = join(outDir, "eval.json");
    writeFileSync(evalPath, JSON.stringify({ items: [{ accountId: TEAM, id: buildImapMessageRowId("<spam1@sender.test>"), label: "ham", decision: "spam",
      source: "model", confidence: 0.95, subject: "Angebot spam1", fromEmail: "offer@cheap-pills.test", mailboxPath: "INBOX", serverSpamFlag: true }] }));
    expect((await bun(["scripts/spam-apply.ts", "--in", evalPath, "--data", dataDir, "--dry-run"])).output).toContain("Summary: 1 would move");

    // The real run needs the reviewed list.
    expect((await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir])).output).toContain("needs --only");

    // A household member flags spam2 after the review: the real run keeps it.
    expect((await bun(["scripts/spam-apply.serverFlagged.test.fixture.ts", "--flags", TEAM, "<spam2@sender.test>", JSON.stringify(["\\Flagged"])], { NOCTUA_DATA_DIR: dataDir })).code).toBe(0);
    const logPath = join(outDir, "applied.json");
    const first = await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir, "--only", listPath, "--out", logPath]);
    expect(first.output).toContain("Summary: 1 moved");
    expect(first.output).toContain("1 excluded now");
    expect(first.code).toBe(0);
    expect(junkIds()).toEqual(["<spam1@sender.test>"]);
    const applied = JSON.parse(readFileSync(logPath, "utf8")) as { moved: Array<{ previousId: string; messageId: string; rfcMessageId: string; junkMailbox: string }> };
    expect(applied.moved).toMatchObject([{ previousId: buildImapMessageRowId("<spam1@sender.test>"), rfcMessageId: "<spam1@sender.test>", junkMailbox: "Junk" }]);

    // Unflagged again: a rerun moves spam2 and skips spam1, which is no longer in the INBOX.
    expect((await bun(["scripts/spam-apply.serverFlagged.test.fixture.ts", "--flags", TEAM, "<spam2@sender.test>", "[]"], { NOCTUA_DATA_DIR: dataDir })).code).toBe(0);
    const second = await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir, "--only", listPath]);
    expect(second.output).toContain("Summary: 1 moved");
    expect(second.output).toContain("1 reviewed items gone");
    expect(junkIds().sort()).toEqual(["<spam1@sender.test>", "<spam2@sender.test>"]);
    const third = await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir, "--only", listPath]);
    expect(third.output).toContain("Summary: 0 moved");
    expect(third.output).toContain("2 reviewed items gone");

    // Local rows: both candidates in Junk with a dated spam example, every excluded mail still in the INBOX.
    const shard = new Database(join(dataDir, "db", "accounts", `${TEAM}.db`), { readonly: true });
    try {
      const rows = shard.prepare("SELECT messageId, folderId FROM messages WHERE accountId = ?").all(TEAM) as Array<{ messageId: string; folderId: string }>;
      const folderOf = (key: string) => rows.find((row) => row.messageId === `<${key}@sender.test>`)?.folderId;
      expect(folderOf("spam1")).toBe(`${TEAM}:Junk`);
      expect(folderOf("spam2")).toBe(`${TEAM}:Junk`);
      for (const key of ["correspondent", "flagged", "ham-sender", "own-domain", "replied", "collab", "checked", "recent", "history", "unflagged", "forged"]) {
        expect(folderOf(key)).toBe(`${TEAM}:INBOX`);
      }
      const examples = shard.prepare("SELECT senderEmail, label, source, createdAt FROM spam_examples WHERE accountId = ? AND source = 'server-flag-backfill' ORDER BY senderEmail")
        .all(TEAM);
      expect(examples).toEqual([
        { senderEmail: "offer@cheap-pills.test", label: "spam", source: "server-flag-backfill", createdAt: old },
        { senderEmail: "promo@bulk-mailer.test", label: "spam", source: "server-flag-backfill", createdAt: old }
      ]);
    } finally { shard.close(); }
    expect(server.store.get("INBOX").messages.some((message) => message.mime.raw.toString().includes("<flagged@sender.test>"))).toBe(true);

    // Settings: show, plan, refuse a non-admin actor, write, read back (auto-move kept).
    const settings = (...extra: string[]) => bun(["scripts/spam-settings.ts", "--data", dataDir, "--mailbox", "team@example.test", ...extra]);
    expect((await settings()).output).toContain(`Mailbox team@example.test (${TEAM}): {"autoMove":true} → effective threshold 0.85 (global)`);
    expect((await settings("--threshold", "0.8")).output).toContain("Planned: {\"autoMove\":true,\"threshold\":0.8}");
    expect((await settings()).output).toContain("effective threshold 0.85 (global)");
    expect((await settings("--threshold", "0.4", "--write", "--actor", "admin@example.test")).output).toContain("--threshold must be");
    expect((await settings("--threshold", "0.8", "--write", "--actor", "member@example.test")).output).toContain("is not an admin user");
    const written = await settings("--threshold", "0,8", "--write", "--actor", "admin@example.test");
    expect(written.output).toContain("Written: {\"autoMove\":true,\"threshold\":0.8} → effective threshold 0.8 (own)");
    expect(written.output).toContain("previous threshold: default");
    expect((await settings()).output).toContain("effective threshold 0.8 (own), detection on, auto-move on");
    const main = new Database(join(dataDir, "db", "main.db"), { readonly: true });
    try {
      expect(main.prepare("SELECT updatedByUserId FROM spam_settings WHERE settings LIKE '%0.8%'").get()).toEqual({ updatedByUserId: "user-admin" });
    } finally { main.close(); }
    expect((await settings("--threshold", "default", "--write", "--actor", "admin@example.test")).output).toContain("effective threshold 0.85 (global)");

    // A live data dir (WAL content) is refused for the dry run; output never goes into the data dir.
    expect((await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir, "--dry-run", "--out", join(dataDir, "x.json")])).output)
      .toContain("must not point into the data dir");
    writeFileSync(join(dataDir, "db", "main.db-wal"), "pending");
    expect((await bun(["scripts/spam-apply.ts", "--server-flagged", "--data", dataDir, "--dry-run"])).output).toContain("Refusing the dry run on a live data dir");
  } finally {
    await server.stop();
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
