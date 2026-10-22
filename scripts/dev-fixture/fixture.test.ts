import { afterAll, beforeAll, expect, test } from "bun:test";
import { createConnection } from "node:net";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Account } from "../../lib/data";
import { verifyImapCredentials } from "../../lib/mail/imapAuth";
import { startImapServer } from "./imap-server";
import { startSmtpSink } from "./smtp-sink";
import { createSeed, demoPass, demoUser, makeMessage } from "./seed";
let imap: Awaited<ReturnType<typeof startImapServer>>;
let smtp: Awaited<ReturnType<typeof startSmtpSink>>;
let directory: string;
const clients: ImapFlow[] = [];
const anchor = new Date("2026-10-22T00:00:00Z");
async function client() {
  const connection = new ImapFlow({ host: "127.0.0.1", port: imap.port, secure: false, auth: { user: demoUser, pass: demoPass }, logger: false, disableAutoIdle: true });
  clients.push(connection);
  await connection.connect();
  return connection;
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "noctua-fixture-"));
  imap = await startImapServer({ port: 0, controlPort: 0, date: anchor });
  smtp = await startSmtpSink({ port: 0, out: directory, deliver: source => { imap.store.append("INBOX", source); } });
});
afterAll(async () => {
  for (const connection of clients) connection.close();
  await smtp?.stop(); await imap?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});
test("seed is reproducible, has 25 inbox threads, both team members and realistic MIME", () => {
  const first = createSeed("test", anchor);
  expect(first.map(m => m.source.toString())).toEqual(createSeed("test", anchor).map(m => m.source.toString()));
  const inbox = first.filter(m => m.folder === "INBOX");
  expect(inbox.length).toBeGreaterThanOrEqual(60);
  expect(inbox.filter(m => !m.source.includes("In-Reply-To:")).length).toBe(25);
  expect(first.filter(m => m.folder === "Sent")).toHaveLength(15);
  expect(first.filter(m => m.folder === "Drafts")).toHaveLength(3);
});
test("Noctua verifyImapCredentials accepts plaintext and rejects bad credentials", async () => {
  const account = { id: "fixture", avatar: "", email: demoUser, name: "MonkeyDent", imap: { host: "127.0.0.1", port: imap.port, secure: false, user: demoUser, password: demoPass }, smtp: { host: "127.0.0.1", port: smtp.port, secure: false, user: demoUser, password: demoPass } } satisfies Account;
  expect(await verifyImapCredentials(account, demoPass)).toBe(true);
  expect(await verifyImapCredentials(account, "wrong")).toBe(false);
});
test("LIST special-use, SELECT and FETCH nested MIME with byte-exact source and sections", async () => {
  const connection = await client();
  const list = await connection.list();
  for (const special of ["\\Sent", "\\Drafts", "\\Trash", "\\Junk", "\\Archive"]) expect(list.some(folder => folder.specialUse === special)).toBe(true);
  expect(list.some(folder => folder.path === "Projekte/Website" && folder.delimiter === "/")).toBe(true);
  const box = await connection.mailboxOpen("INBOX");
  expect(box.exists).toBe(imap.store.get("INBOX").messages.length);
  const message = imap.store.get("INBOX").messages.find(m => m.mime.headers.get("message-id")?.includes("t5-m0"))!;
  const fetched = await connection.fetchOne(String(message.uid), { uid: true, flags: true, envelope: true, bodyStructure: true, source: true, headers: ["SUBJECT", "FROM"], bodyParts: ["1.2", "2"], internalDate: true, size: true }, { uid: true });
  if (!fetched) throw new Error("missing FETCH response");
  expect(fetched.source).toEqual(message.mime.raw);
  expect(fetched.envelope?.subject).toBe("Praxispost im Oktober");
  expect(fetched.bodyStructure?.type).toBe("multipart/related");
  expect(fetched.bodyStructure?.childNodes?.[0].childNodes?.[1].part).toBe("1.2");
  expect(fetched.bodyParts?.get("1.2")?.length).toBeGreaterThan(10);
  expect(fetched.headers?.toString()).toContain("Subject:");
  expect(fetched.size).toBe(message.mime.raw.length);
  expect(fetched.flags?.has("\\Seen")).toBe(message.flags.has("\\Seen"));
  await connection.logout();
});
test("UID SEARCH supports date, flags, headers, text, OR/NOT and UID ranges", async () => {
  const connection = await client();
  await connection.mailboxOpen("INBOX");
  const box = imap.store.get("INBOX");
  expect(await connection.search({ all: true }, { uid: true })).toHaveLength(box.messages.length);
  expect(await connection.search({ seen: false }, { uid: true })).toHaveLength(box.messages.filter(m => !m.flags.has("\\Seen")).length);
  expect((await connection.search({ flagged: true }, { uid: true })) || []).not.toHaveLength(0);
  expect(await connection.search({ uid: "1:3" }, { uid: true })).toEqual([1, 2, 3]);
  expect(await connection.search({ since: new Date("2026-10-22"), before: new Date("2026-10-23") }, { uid: true })).toEqual(box.messages.filter(m => m.date >= new Date("2026-10-22") && m.date < new Date("2026-10-23")).map(m => m.uid));
  expect((await connection.search({ on: new Date("2026-10-22") }, { uid: true })) || []).not.toHaveLength(0);
  expect((await connection.search({ header: { "message-id": "t5-m0" } }, { uid: true })) || []).toHaveLength(1);
  expect((await connection.search({ from: "mira.beispiel", subject: "Kontrolle" }, { uid: true })) || []).not.toHaveLength(0);
  expect((await connection.search({ text: "Tuesday" }, { uid: true })) || []).not.toHaveLength(0);
  const union = await connection.search({ or: [{ flagged: true }, { seen: false }] }, { uid: true });
  expect(union).toHaveLength(box.messages.filter(m => m.flags.has("\\Flagged") || !m.flags.has("\\Seen")).length);
  expect(await connection.search({ not: { seen: true } }, { uid: true })).toHaveLength(box.messages.filter(m => !m.flags.has("\\Seen")).length);
  await connection.logout();
});
test("STORE, COPY/MOVE COPYUID, APPEND APPENDUID and UID EXPUNGE", async () => {
  const connection = await client();
  await connection.mailboxOpen("INBOX");
  const raw = makeMessage({ id: "mutation", subject: "Synthetic mutation", text: ".A dot\nÄÖÜ literal bytes" });
  const appended = await connection.append("INBOX", raw, ["\\Draft"], anchor);
  if (!appended || !appended.uid) throw new Error("missing APPENDUID");
  const uid = appended.uid;
  expect(appended.uidValidity).toBe(BigInt(imap.store.get("INBOX").uidValidity));
  await connection.messageFlagsAdd(String(uid), ["\\Seen", "\\Flagged"], { uid: true });
  await connection.messageFlagsRemove(String(uid), ["\\Draft"], { uid: true });
  const fetched = await connection.fetchOne(String(uid), { flags: true }, { uid: true });
  if (!fetched) throw new Error("missing flags");
  expect([...fetched.flags!].sort()).toEqual(["\\Flagged", "\\Seen"]);
  const copied = await connection.messageCopy(String(uid), "Archive", { uid: true });
  if (!copied || !copied.uidMap) throw new Error("missing COPYUID");
  expect(copied.uidMap.get(uid)).toBeGreaterThan(0);
  const moved = await connection.messageMove(String(uid), "Trash", { uid: true });
  if (!moved || !moved.uidMap) throw new Error("missing MOVE COPYUID");
  expect(moved.uidMap.get(uid)).toBeGreaterThan(0);
  expect(imap.store.get("INBOX").messages.some(m => m.uid === uid)).toBe(false);
  await connection.mailboxOpen("Trash");
  const trashUid = moved.uidMap.get(uid)!;
  await connection.messageFlagsSet(String(trashUid), ["\\Deleted"], { uid: true });
  await connection.messageDelete(String(trashUid), { uid: true });
  expect(imap.store.get("Trash").messages.some(m => m.uid === trashUid)).toBe(false);
  await connection.logout();
});
test("IDLE sees HTTP-injected mail on concurrent connection", async () => {
  const connection = await client();
  await connection.mailboxOpen("INBOX");
  const before = imap.store.get("INBOX").messages.length;
  let resolveExists: () => void;
  const exists = new Promise<void>(resolve => { resolveExists = resolve; });
  connection.on("exists", event => { if (event.count === before + 1) resolveExists(); });
  const idling = connection.idle();
  // Wait for the actual IDLE state rather than relying on an arbitrary network delay.
  for (let tries = 0; !connection.idling && tries < 100; tries++) await sleep(5);
  expect(connection.idling).toBe(true);
  const response = await fetch(`http://127.0.0.1:${imap.controlPort}/inject`, { method: "POST", body: JSON.stringify({ subject: "IDLE synthetic request" }) });
  expect(response.status).toBe(200);
  await Promise.race([exists, new Promise((_, reject) => setTimeout(() => reject(new Error("IDLE EXISTS timeout")), 2000))]);
  await connection.noop();
  await idling;
  await connection.logout();
});
test("nodemailer verifies, authenticates, sends dot-stuffed mail, persists and round-trips", async () => {
  for (const authMethod of ["PLAIN", "LOGIN"]) {
    const transporter = nodemailer.createTransport({ host: "127.0.0.1", port: smtp.port, secure: false, auth: { user: demoUser, pass: demoPass }, authMethod }) as ReturnType<typeof nodemailer.createTransport> & { verify(): Promise<true> };
    expect(await transporter.verify()).toBe(true);
    const before = imap.store.get("INBOX").messages.length;
    await transporter.sendMail({ from: '"Toni Muster" <demo@monkeydent.test>', to: demoUser, subject: `Synthetic ${authMethod} reply`, text: "Hello\r\n.Leading dot\r\n..Two dots\r\nGrüße" });
    const mail = smtp.received.at(-1)!;
    expect(await readFile(mail.file)).toEqual(mail.source);
    expect(mail.source.toString()).toContain(".Leading dot");
    expect(imap.store.get("INBOX").messages.length).toBe(before + 1);
    expect(imap.store.get("INBOX").messages.at(-1)?.mime.raw).toEqual(mail.source);
  }
});
test("STATUS, EXAMINE, folder CRUD, subscription and UNSELECT", async () => {
  const connection = await client();
  const path = "Test/Übung";
  const renamed = "Test/Neu";
  await connection.mailboxCreate(path);
  await connection.mailboxSubscribe(path);
  expect((await connection.list()).some(box => box.path === path && box.subscribed)).toBe(true);
  const raw = makeMessage({ id: "crud", subject: "Synthetic CRUD" });
  const appended = await connection.append(path, raw);
  if (!appended || !appended.uid) throw new Error("No APPENDUID");
  const status = await connection.status(path, { messages: true, unseen: true, uidNext: true, uidValidity: true, recent: true });
  expect(status.messages).toBe(1);
  expect(status.unseen).toBe(1);
  expect(status.uidNext).toBe(2);
  const box = await connection.mailboxOpen(path, { readOnly: true });
  expect(box.readOnly).toBe(true);
  // PEEK must preserve unread state, including when fetching text sections.
  const fetched = await connection.fetchOne("1", { source: true, headers: true, bodyParts: ["TEXT", "1", "HEADER"] });
  if (!fetched) throw new Error("No FETCH");
  expect(fetched.source).toEqual(raw);
  expect(fetched.headers?.toString()).toContain("Message-ID:");
  expect(imap.store.get(path).messages[0].flags.has("\\Seen")).toBe(false);
  await connection.mailboxClose();
  await connection.mailboxRename(path, renamed);
  await connection.mailboxUnsubscribe(renamed);
  expect((await connection.list()).find(box => box.path === renamed)?.subscribed === true).toBe(false);
  await connection.mailboxDelete(renamed);
  expect((await connection.list()).some(box => box.path === renamed)).toBe(false);
  await connection.logout();
});
test("wire LOGIN, synchronizing and fragmented literals, partial FETCH, STORE and EXPUNGE", async () => {
  const socket = createConnection({ host: "127.0.0.1", port: imap.port });
  let wire = "";
  socket.on("data", chunk => { wire += chunk.toString("latin1"); });
  async function until(value: string) {
    for (let tries = 0; !wire.includes(value) && tries < 200; tries++) await sleep(5);
    expect(wire).toContain(value);
    const result = wire;
    wire = "";
    return result;
  }
  async function command(tag: string, value: string) { socket.write(`${tag} ${value}\r\n`); return until(`${tag} OK`); }
  try {
    await until("MonkeyDent synthetic mailbox");
    await command("a", `LOGIN "${demoUser}" "${demoPass}"`);
    await command("b", 'CREATE "Wire"');
    const raw = Buffer.from("From: Demo <demo@monkeydent.test>\r\nTo: Example <example@example.test>\r\nSubject: Wire literal\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nGrüße 👋\r\n");
    socket.write(`c APPEND "Wire" (\\Draft) {${raw.length}}\r\n`);
    await until("+ Ready for literal");
    socket.write(raw.subarray(0, 17));
    socket.write(Buffer.concat([raw.subarray(17), Buffer.from("\r\n")]));
    expect(await until("c OK")).toContain("[APPENDUID ");
    expect(await command("d", 'SELECT "Wire"')).toContain("* 1 EXISTS");
    const fetched = await command("e", "FETCH 1 (UID BODY.PEEK[] BODY.PEEK[HEADER.FIELDS (SUBJECT)] BODY.PEEK[TEXT] BODY.PEEK[1]<0.5>)");
    expect(fetched).toContain(`BODY[] {${raw.length}}\r\n${raw.toString("latin1")}`);
    expect(fetched).toContain("BODY[1]<0> {5}\r\n");
    expect(fetched).toContain("BODY[HEADER.FIELDS (SUBJECT)] {25}\r\nSubject: Wire literal\r\n\r\n");
    expect(imap.store.get("Wire").messages[0].flags.has("\\Seen")).toBe(false);
    await command("f", "FETCH 1 (BODY[TEXT])");
    expect(imap.store.get("Wire").messages[0].flags.has("\\Seen")).toBe(true);
    const silent = await command("g", "STORE 1 +FLAGS.SILENT (\\Deleted)");
    expect(silent).not.toContain("FETCH");
    expect(await command("h", "EXPUNGE")).toContain("* 1 EXPUNGE");
    await command("i", "UNSELECT");
    await command("j", 'DELETE "Wire"');
    await command("k", "LOGOUT");
  } finally { socket.destroy(); }
});
test("HTTP reset disconnects selected clients and changes UIDVALIDITY", async () => {
  const server = await startImapServer({ port: 0, controlPort: 0, date: anchor });
  const connection = new ImapFlow({ host: "127.0.0.1", port: server.port, secure: false, auth: { user: demoUser, pass: demoPass }, logger: false, disableAutoIdle: true });
  try {
    await connection.connect();
    await connection.mailboxOpen("INBOX");
    const closed = new Promise<void>(resolve => connection.once("close", resolve));
    const validity = server.store.get("INBOX").uidValidity;
    server.store.append("INBOX", makeMessage({ id: "reset", subject: "Synthetic reset" }));
    const response = await fetch(`http://127.0.0.1:${server.controlPort}/reset`, { method: "POST" });
    expect(response.ok).toBe(true);
    expect(server.store.get("INBOX").messages).toHaveLength(60);
    expect(server.store.get("INBOX").uidValidity).not.toBe(validity);
    await closed;
  } finally { connection.close(); await server.stop(); }
});
