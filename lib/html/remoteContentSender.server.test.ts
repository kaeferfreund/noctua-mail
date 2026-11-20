import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { UserAccountPrefs } from "@/lib/data";
import { isRemoteContentSenderVerified, remoteContentSenderDecision } from "./remoteContentSender.server";

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
  });

  it("does not apply it when SPF and DKIM did not pass for the From domain", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("forged"), sourcesDir)).toEqual({ senderVerified: false, allowed: false });
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("other-domain-pass"), sourcesDir)).toBe(false);
  });

  it("only counts the receiving server's own Authentication-Results block", async () => {
    // Below the second Received line: written by an earlier hop or the sender.
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("sender-inserted"), sourcesDir)).toBe(false);
  });

  it("without any authentication signal the stored (mailbox, user, exact address) permission applies", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("no-results"), sourcesDir)).toEqual({ senderVerified: true, allowed: true });
    expect(await isRemoteContentSenderVerified(ACCOUNT, message("no-source", { hasSource: false }), sourcesDir)).toBe(true);
  });

  it("never applies without a sender key or a matching permission", async () => {
    expect(await remoteContentSenderDecision(prefs, ACCOUNT, message("dkim-pass", { senderKey: null }), sourcesDir)).toEqual({ senderVerified: false, allowed: false });
    expect(await remoteContentSenderDecision({}, ACCOUNT, message("dkim-pass"), sourcesDir)).toEqual({ senderVerified: true, allowed: false });
  });
});
