import { describe, expect, test } from "bun:test";
import { simpleParser } from "mailparser";
import {
  buildSpamInput, buildSpamInputFromMessage, configuredAuthservIds, extractMaskedLinkDomains, parseHeaderBlock, receivingAuthenticationResults, SPAM_TEXT_LIMIT,
  stripQuotedText
} from "./input";

const source = [
  "Authentication-Results: mx.example.test; spf=pass smtp.mailfrom=example.test;",
  "  dkim=pass header.d=example.test; dmarc=pass",
  "X-Spam-Status: No, score=0.4",
  "X-Spam-Flag: NO",
  "From: \"Shop Team\" <News@Shop.Example.test>",
  "Reply-To: replies@example.test",
  "To: anna@example.test",
  "Subject: Angebot der Woche",
  "Date: Fri, 23 Oct 2026 10:00:00 +0000",
  "List-Id: <news.shop.example.test>",
  "List-Unsubscribe: <https://shop.example.test/unsubscribe>",
  "MIME-Version: 1.0",
  "Content-Type: multipart/mixed; boundary=b1",
  "",
  "--b1",
  "Content-Type: multipart/alternative; boundary=b2",
  "",
  "--b2",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hallo Anna, siehe https://www.shop.example.test/deal?id=1",
  "",
  "Am 22.10.2026 um 09:00 schrieb Anna <anna@example.test>:",
  "> alte Nachricht",
  "--b2",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Hallo Anna, <a href=\"https://track.example.test/c\">hier</a> <img src=\"https://img.example.test/p.gif\"></p>",
  "--b2--",
  "--b1",
  "Content-Type: application/pdf; name=katalog.pdf",
  "Content-Disposition: attachment; filename=katalog.pdf",
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0=",
  "--b1--",
  ""
].join("\r\n");

describe("buildSpamInput", () => {
  test("collects headers, link domains and attachments, without quoted text or HTML", async () => {
    const input = buildSpamInput(await simpleParser(source));
    expect(input.fromEmail).toBe("news@shop.example.test");
    expect(input.fromName).toBe("Shop Team");
    expect(input.replyTo).toContain("replies@example.test");
    expect(input.subject).toBe("Angebot der Woche");
    expect(input.listId).toBe("<news.shop.example.test>");
    expect(input.listUnsubscribe).toContain("unsubscribe");
    expect(input.authenticationResults).toEqual(["mx.example.test; spf=pass smtp.mailfrom=example.test; dkim=pass header.d=example.test; dmarc=pass"]);
    expect(input.spamHeaders).toEqual(["x-spam-status: No, score=0.4", "x-spam-flag: NO"]);
    expect(input.linkDomains).toEqual(expect.arrayContaining(["shop.example.test", "track.example.test"]));
    expect(input.linkDomains).not.toContain("img.example.test");
    expect(input.attachments).toEqual(["katalog.pdf (application/pdf)"]);
    // The attribution line follows less than SPAM_OWN_TEXT_MIN of own text: it stays, the quoted lines go.
    expect(input.text).toBe("Hallo Anna, siehe https://www.shop.example.test/deal?id=1\n\nAm 22.10.2026 um 09:00 schrieb Anna <anna@example.test>:");
    // No HTML: the plain part is used, never the markup of the HTML part.
    expect(input.text).not.toMatch(/<\/?(p|a|img)\b/);
    expect(input.cc).toBe("");
    expect(input.autoSubmitted).toBeNull();
    expect(input.maskedLinkDomains).toEqual([]);
  });

  test("a forged Authentication-Results block below the second Received line is ignored even with our authserv-id", async () => {
    const forged = [
      "Received: from sender.example.test (sender.example.test [192.0.2.10]) by mx.example.test (Postfix) with ESMTPS id 1; Sat, 24 Oct 2026 10:00:00 +0000",
      "Authentication-Results: mx.example.test; spf=fail smtp.mailfrom=attacker.example.net; dkim=none",
      "Received: from laptop (unknown [192.0.2.11]) by sender.example.test with ESMTP id 2; Sat, 24 Oct 2026 09:59:00 +0000",
      "Authentication-Results: mx.example.test; dkim=pass header.d=victim.example.test; spf=pass smtp.mailfrom=victim.example.test",
      "From: Victim <ceo@victim.example.test>",
      "To: anna@example.test",
      "Subject: Dringend",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Bitte sofort ueberweisen."
    ].join("\r\n");
    const input = buildSpamInput(await simpleParser(forged));
    expect(input.authenticationResults).toEqual(["mx.example.test; spf=fail smtp.mailfrom=attacker.example.net; dkim=none"]);
  });

  test("a long X-Spam-Status keeps the tests at the end of its list; other headers stay capped", async () => {
    const tests = Array.from({ length: 60 }, (_, index) => `SYNTHETIC_TEST_${index}`).concat("RCVD_ILLEGAL_IP").join(",");
    const status = `Yes, score=9.9 required=5.0 tests=${tests} autolearn=no version=3.4.6`;
    expect(status.length).toBeGreaterThan(1000);
    const raw = [`X-Spam-Status: ${status}`, `X-Spam-Report: ${"x".repeat(1000)}`, "From: a@example.test", "To: b@example.test", "Subject: S", "", "Text"].join("\r\n");
    const input = buildSpamInput(await simpleParser(raw));
    expect(input.spamHeaders[0]).toBe(`x-spam-status: ${status}`);
    expect(input.spamHeaders[1].length).toBe("x-spam-report: ".length + 600);
    expect(buildSpamInputFromMessage({ from: "a@example.test", to: "b@example.test", subject: "S", headers: raw.slice(0, raw.indexOf("\r\n\r\n")) }).spamHeaders[0])
      .toContain("RCVD_ILLEGAL_IP");
  });

  test("authserv-id pinning: without our server's block a sender-inserted block of another id never counts", async () => {
    const mail = (...authResults: string[]) => [
      "Received: from sender.example.net (sender.example.net [192.0.2.10]) by mx1.mail.example.test (Postfix) with ESMTPS id 1; Sat, 24 Oct 2026 10:00:00 +0000",
      ...authResults.map((value) => `Authentication-Results: ${value}`),
      "From: Victim <ceo@victim.example.test>",
      "To: anna@example.test",
      "Subject: Dringend",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Bitte sofort ueberweisen."
    ].join("\r\n");
    const forged = "mx.google.example; dkim=pass header.d=victim.example.test; spf=pass smtp.mailfrom=victim.example.test";
    expect(buildSpamInput(await simpleParser(mail(forged))).authenticationResults).toEqual([]);
    // Our server's block (same organisation as the Received "by" host) counts; the forged one under it does not.
    const ours = "mx2.mail.example.test; spf=fail smtp.mailfrom=attacker.example.net; dkim=none";
    expect(buildSpamInput(await simpleParser(mail(forged, ours))).authenticationResults).toEqual([ours]);
    const headers = mail(forged, ours).split("\r\n\r\n")[0];
    expect(buildSpamInputFromMessage({ from: "ceo@victim.example.test", to: "anna@example.test", subject: "S", headers }).authenticationResults).toEqual([ours]);
  });

  test("authserv-id pinning: MailProvider's bare host label (by mx1.mail.example.com, Authentication-Results: mx1;) is the receiving server", async () => {
    const ours = "mx1; dkim=pass header.d=shop.example.test; spf=pass smtp.mailfrom=shop.example.test";
    const mailprovider = [
      "Received: from mail.shop.example.test (mail.shop.example.test [192.0.2.20]) by mx1.mail.example.com (Postfix) with ESMTPS id 4X1; Sat, 24 Oct 2026 10:00:00 +0000",
      `Authentication-Results: ${ours}`,
      "Authentication-Results: mx.forwarder.example.net; dkim=pass header.d=victim.example.test",
      "From: Shop <news@shop.example.test>",
      "To: anna@example.test",
      "Subject: Bestellung",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Ihre Bestellung ist unterwegs."
    ].join("\r\n");
    expect(buildSpamInput(await simpleParser(mailprovider)).authenticationResults).toEqual([ours]);
    const lines = parseHeaderBlock(mailprovider.split("\r\n\r\n")[0]);
    for (const id of ["MX1.", "mx1.mail.example.com", "mx2.mail.example.com"]) {
      const block = `Authentication-Results: ${id}; spf=pass smtp.mailfrom=shop.example.test`;
      expect(receivingAuthenticationResults(parseHeaderBlock(`${mailprovider.split("\r\n")[0]}\r\n${block}`), [])).toHaveLength(1);
    }
    // Another bare label or a foreign host never counts.
    expect(receivingAuthenticationResults(parseHeaderBlock(`${mailprovider.split("\r\n")[0]}\r\nAuthentication-Results: mx2; spf=pass`), [])).toEqual([]);
    expect(receivingAuthenticationResults(lines.filter((line) => !line.value.startsWith("mx1;")), [])).toEqual([]);
  });

  test("authserv-id pinning: a configured list wins over the Received host; no Received line keeps the top-most block", () => {
    const lines = parseHeaderBlock([
      "Received: from relay.example.net by relay.example.net; Sat, 24 Oct 2026 10:00:00 +0000",
      "Authentication-Results: relay.example.net; dkim=pass header.d=victim.example.test",
      "Authentication-Results: auth.provider.example; dkim=none"
    ].join("\r\n"));
    expect(receivingAuthenticationResults(lines, [])).toEqual(["relay.example.net; dkim=pass header.d=victim.example.test"]);
    expect(receivingAuthenticationResults(lines, ["auth.provider.example"])).toEqual(["auth.provider.example; dkim=none"]);
    expect(configuredAuthservIds({ NOCTUA_SPAM_AUTHSERV_ID: " Auth.Provider.example , mx.example.test" })).toEqual(["auth.provider.example", "mx.example.test"]);
    expect(receivingAuthenticationResults(lines.slice(1), [])).toEqual(["relay.example.net; dkim=pass header.d=victim.example.test"]);
  });

  test("the row fallback takes the server verdicts from a raw header block", () => {
    const headers = source.slice(0, source.indexOf("\r\n\r\n")) + "\r\nAuto-Submitted: auto-generated";
    const input = buildSpamInputFromMessage({ from: "News@Shop.Example.test", to: "anna@example.test", cc: "bob@example.test", subject: "S",
      messageId: "<1@shop.example.test>", body: "Text", headers });
    expect(input.authenticationResults).toEqual(["mx.example.test; spf=pass smtp.mailfrom=example.test; dkim=pass header.d=example.test; dmarc=pass"]);
    expect(input.spamHeaders).toEqual(["x-spam-status: No, score=0.4", "x-spam-flag: NO"]);
    expect(input).toMatchObject({ cc: "bob@example.test", messageId: "<1@shop.example.test>", listId: "<news.shop.example.test>", autoSubmitted: "auto-generated" });
  });

  test("arrival: the top-most Received stamp, also beyond the header value cap; the Date header and lower Received never count", async () => {
    const padding = "x".repeat(700);
    const received = [
      `Received: from relay.example.test (relay.example.test [192.0.2.1]) (${padding})`,
      "  by mx.example.test (Postfix) with ESMTPS id 1; Sat, 24 Oct 2026 16:59:17 +0200 (CEST)",
      "Received: from forged.example.invalid by forged.example.invalid; Mon, 01 Jan 2024 00:00:00 +0000"
    ].join("\r\n");
    const withReceived = `${received}\r\n${source}`;
    expect(buildSpamInput(await simpleParser(withReceived)).receivedAt).toBe("2026-10-24T14:59:17.000Z");
    const headers = withReceived.slice(0, withReceived.indexOf("\r\n\r\n"));
    expect(buildSpamInputFromMessage({ from: "News@Shop.Example.test", to: "anna@example.test", subject: "S", headers }).receivedAt)
      .toBe("2026-10-24T14:59:17.000Z");
    expect(buildSpamInput(await simpleParser(source)).receivedAt).toBeNull();
    expect(buildSpamInputFromMessage({ from: "a@example.test", to: "b@example.test", subject: "S", date: "2026-10-23" }).receivedAt).toBeNull();
  });

  test("masked links: link text naming another domain than the target", () => {
    const html = `<a href="https://login.example.invalid/x">www.bank.example.test</a> <a href="https://bank.example.test/y"><b>bank.example.test</b></a>
      <a href="https://track.example.test/c">Hier klicken</a>`;
    expect(extractMaskedLinkDomains(html)).toEqual(["login.example.invalid"]);
    expect(extractMaskedLinkDomains(null)).toEqual([]);
  });

  test("caps the text and falls back to the stored row", () => {
    const input = buildSpamInputFromMessage({ from: "a@example.test", to: "b@example.test", subject: "S", body: "x".repeat(10_000) });
    expect(input.text).toHaveLength(SPAM_TEXT_LIMIT);
    expect(input.fromEmail).toBe("a@example.test");
  });

  test("stripQuotedText removes quote lines and the attribution tail", () => {
    expect(stripQuotedText("Neu\n> zitiert\nweiter\nOn Mon, 1 Jan 2026, Bob wrote:\nalt")).toBe("Neu\nweiter");
  });

  test("a fake attribution line at the top does not hide the body; after enough own text the tail is cut", () => {
    const body = "On Mon, 1 Jan 2026, Bank wrote:\nIhr Konto wurde gesperrt. Bestätigen Sie Ihre Daten unter https://login.example.invalid";
    const input = buildSpamInputFromMessage({ from: "a@example.test", to: "b@example.test", subject: "S", body });
    expect(input.text).toContain("Ihr Konto wurde gesperrt");
    const own = "Eigener Text. ".repeat(80);
    const reply = buildSpamInputFromMessage({ from: "a@example.test", to: "b@example.test", subject: "S", body: `${own}\nOn Mon, 1 Jan 2026, Bob wrote:\nalte Nachricht` });
    expect(reply.text).toBe(own.trim());
  });
});
