import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { UserAccountPrefs } from "@/lib/data";
import type { Folder } from "@/lib/data";
import { isRemoteContentSenderVerified, messageSenderVerified, remoteContentSenderDecision, senderVerifiedByHeaders } from "./remoteContentSender.server";

const ACCOUNT = "acct-1";
const SENDER = "news@example.test";
const prefs: UserAccountPrefs = { remoteContent: { allowedSenders: { [SENDER]: true } } };
let sourcesDir = "";

const received = "Received: from relay.example.net by mx.example.test with ESMTPS; Mon, 2 Nov 2026 10:00:00 +0000";
const SOURCES: Record<string, string[]> = {
  "no-results": [received, `From: <${SENDER}>`],
  "dkim-pass": [received, "Authentication-Results: mx.example.test; dkim=pass header.d=example.test; spf=fail smtp.mailfrom=other.test", `From: <${SENDER}>`],
  "spf-pass-subdomain": [received, "Authentication-Results: mx.example.test; spf=pass smtp.mailfrom=bounce.example.test", `From: <${SENDER}>`],
  "forged": [received, "Authentication-Results: mx.example.test; dkim=fail header.d=example.test; spf=softfail smtp.mailfrom=attacker.test", `From: <${SENDER}>`],
  "other-domain-pass": [received, "Authentication-Results: mx.example.test; dkim=pass header.d=attacker.test", `From: <${SENDER}>`],
  // A provider that re-injects after its spam check: its A-R sits below the second Received line.
  "reinjected": [
    "Received: by mx1.mail.example.net (Postfix, from userid 1001) id 1; Mon, 2 Nov 2026 10:00:05 +0000",
    "X-Spam-Status: No, score=-0.1",
    "Received: from out-1.relay.example.net (out-1.relay.example.net [192.0.2.1]) by mx1.mail.example.net (Postfix) with ESMTPS id 2; Mon, 2 Nov 2026 10:00:00 +0000",
    "Authentication-Results: mx1; dkim=pass header.d=example.test; spf=pass smtp.mailfrom=example.test",
    `From: <${SENDER}>`
  ],
  // Stored by a mail client via IMAP APPEND: never passed a mail server.
  "appended": [`From: <${SENDER}>`, "To: <owner@example.test>"],
  "sender-inserted": [
    received,
    "Authentication-Results: mx.example.test; dkim=fail header.d=example.test; spf=fail smtp.mailfrom=attacker.test",
    "Received: from attacker.test by relay.example.net; Mon, 2 Nov 2026 09:59:00 +0000",
    "Authentication-Results: mx.example.test; dkim=pass header.d=example.test",
    `From: <${SENDER}>`
  ]
};

beforeAll(async () => {
  sourcesDir = await mkdtemp(path.join(process.env.TMPDIR || os.tmpdir(), "remote-content-sender-"));
  const dir = path.join(sourcesDir, encodeURIComponent(ACCOUNT));
  await mkdir(dir, { recursive: true });
  for (const [id, headers] of Object.entries(SOURCES)) {
    await writeFile(path.join(dir, `${encodeURIComponent(id)}.eml`), `${headers.join("\r\n")}\r\nSubject: Synthetic\r\n\r\nBody\r\n`);
  }
});

afterAll(async () => {
  await rm(sourcesDir, { recursive: true, force: true });
});

const message = (id: string, overrides: { hasSource?: boolean; senderKey?: string | null } = {}) =>
  ({ id, senderKey: SENDER, hasSource: true, ...overrides });

// A38 / Sol 31: "always load from this sender" must not apply to a forged From.
describe("remote-content sender verification", () => {
  it("applies the permission when the receiving server authenticated the sender's domain", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("dkim-pass"), sourcesDir)).toEqual({ senderVerified: true, allowed: true });
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("spf-pass-subdomain"), sourcesDir)).toBe(true);
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("reinjected"), sourcesDir)).toBe(true);
  });

  it("does not apply it when SPF and DKIM did not pass for the From domain", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("forged"), sourcesDir)).toEqual({ senderVerified: false, allowed: false });
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("other-domain-pass"), sourcesDir)).toBe(false);
  });

  it("only counts the receiving server's own Authentication-Results block", async () => {
    // Below the second Received line: written by an earlier hop or the sender.
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("sender-inserted"), sourcesDir)).toBe(false);
  });

  // Changed 2026-11-20 (user decision): no recognised Authentication-Results is
  // no longer "no signal = verified"; "always load" needs SPF or DKIM pass.
  it("without any authentication signal or stored source the sender is not verified", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("no-results"), sourcesDir)).toEqual({ senderVerified: false, allowed: false });
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("no-source", { hasSource: false }), sourcesDir)).toBe(false);
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("missing-file"), sourcesDir)).toBe(false);
    // A source without any Received line: no badge (see below), but no remote images either.
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("appended"), sourcesDir)).toBe(false);
  });

  it("never applies without a sender key or a matching permission", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("dkim-pass", { senderKey: null }), sourcesDir)).toEqual({ senderVerified: false, allowed: false });
    expect(await remoteContentSenderDecision({}, ACCOUNT, message("dkim-pass"), sourcesDir)).toEqual({ senderVerified: true, allowed: false });
  });
});

describe("strict sender check (senderVerifiedByHeaders)", () => {
  const headers = (authenticationResults?: string) =>
    [received, ...(authenticationResults ? [`Authentication-Results: ${authenticationResults}`] : []), `From: <${SENDER}>`].join("\r\n");

  it("passes on SPF or DKIM pass for the From domain", () => {
    expect(senderVerifiedByHeaders(headers("mx.example.test; dkim=pass header.d=example.test"), SENDER)).toBe(true);
    expect(senderVerifiedByHeaders(headers("mx.example.test; spf=pass smtp.mailfrom=bounce.example.test"), SENDER)).toBe(true);
  });

  it("fails on fail results, on results for another domain and without results", () => {
    expect(senderVerifiedByHeaders(headers("mx.example.test; dkim=fail header.d=example.test; spf=softfail smtp.mailfrom=example.test"), SENDER)).toBe(false);
    expect(senderVerifiedByHeaders(headers("mx.example.test; dkim=pass header.d=attacker.test; spf=pass smtp.mailfrom=attacker.test"), SENDER)).toBe(false);
    expect(senderVerifiedByHeaders(headers(), SENDER)).toBe(false);
  });
});

describe("reader sender badge signal (messageSenderVerified)", () => {
  const folders = [
    { id: "inbox", accountId: ACCOUNT, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
    { id: "sent", accountId: ACCOUNT, name: "Sent", count: 0, unreadCount: 0, specialUse: "\\Sent" },
    { id: "drafts", accountId: ACCOUNT, name: "Drafts", count: 0, unreadCount: 0, specialUse: "\\Drafts" }
  ] as Folder[];
  const mailbox = { ownAddresses: ["owner@example.test"], folders };
  const opened = (id: string, overrides: { folderId?: string; senderKey?: string; hasSource?: boolean } = {}) =>
    ({ ...message(id, overrides), from: overrides.senderKey ?? SENDER, folderId: overrides.folderId ?? "inbox" });

  it("is true or false from the strict check for received mail", async () => {
    expect(await messageSenderVerified(ACCOUNT, opened("dkim-pass"), mailbox, sourcesDir)).toBe(true);
    expect(await messageSenderVerified(ACCOUNT, opened("reinjected"), mailbox, sourcesDir)).toBe(true);
    expect(await messageSenderVerified(ACCOUNT, opened("no-results"), mailbox, sourcesDir)).toBe(false);
    expect(await messageSenderVerified(ACCOUNT, opened("forged"), mailbox, sourcesDir)).toBe(false);
  });

  it("is null for own mail, Sent, Drafts and messages without a stored source", async () => {
    expect(await messageSenderVerified(ACCOUNT, opened("no-results", { senderKey: "owner@example.test" }), mailbox, sourcesDir)).toBeNull();
    expect(await messageSenderVerified(ACCOUNT, opened("no-results", { folderId: "sent" }), mailbox, sourcesDir)).toBeNull();
    expect(await messageSenderVerified(ACCOUNT, opened("no-results", { folderId: "drafts" }), mailbox, sourcesDir)).toBeNull();
    expect(await messageSenderVerified(ACCOUNT, opened("no-source", { hasSource: false }), mailbox, sourcesDir)).toBeNull();
  });

  it("is null for a source without any Received line (stored by a mail client, never passed a mail server)", async () => {
    expect(await messageSenderVerified(ACCOUNT, opened("appended"), mailbox, sourcesDir)).toBeNull();
  });
});
