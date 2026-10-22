import { expect, test } from "bun:test";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { createCollabFixture } from "./testThreadCollabHarness";
import { GET } from "@/app/api/accounts/[accountId]/messages/[messageId]/html/route";
import { GET as getPrefs, PUT } from "@/app/api/accounts/[accountId]/prefs/route";
import { remoteContentSenderKey } from "./html/remoteContent";
import { senderPermissionCases } from "./testFixtures/senderPermissions";

// Regression scenario copied from the S3 review probe, with privacy expectations.
test("HTML route blocks remote resources and navigation and applies document policies", async () => {
  const f = await createCollabFixture();
  const user = await createAuthenticatedTestSession(f.accountId);
  const html = '<html><head><meta http-equiv="refresh" content="0;url=https://images.example.test/next"><style>@import url("https://images.example.test/style");</style></head><body><img src="https://images.example.test/pixel?message=synthetic" onerror="alert(1)"><script>alert(1)</script><form action="https://images.example.test/"></form><img src="cid:logo"></body></html>';
  const [message] = await f.seed(f.message("<privacy@example.test>", { from: "Synthetic <SENDER@EXAMPLE.TEST>", htmlBody: html }));
  const params = { params: Promise.resolve({ accountId: f.accountId, messageId: message.id }) };
  const get = (query = "") => GET(new Request(`http://localhost:3000/html${query}`, { headers: user.jar.headers() }), params);
  const blocked = await get();
  const body = await blocked.text();
  expect(blocked.status).toBe(200);
  expect(body).toContain('data-remote-src="https://images.example.test/pixel');
  expect(body).not.toMatch(/\ssrc="https:\/\//);
  expect(body).not.toContain("@import");
  expect(body).not.toContain("http-equiv");
  expect(body).not.toMatch(/<script|onerror|<form/);
  expect(blocked.headers.get("referrer-policy")).toBe("no-referrer");
  expect(blocked.headers.get("content-security-policy")).toContain("default-src 'none'; img-src 'self' data: cid: blob:");
  expect(blocked.headers.get("content-security-policy")).toContain("style-src 'unsafe-inline'");
  expect(blocked.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
  expect(blocked.headers.get("content-security-policy")).not.toContain("script-src");
  const allowed = await get("?remoteContent=allow");
  const allowedBody = await allowed.text();
  expect(allowedBody).toContain('src="https://images.example.test/pixel');
  expect(allowedBody).toContain('referrerpolicy="no-referrer"');
  expect(allowedBody).not.toContain("@import");
  expect(allowed.headers.get("content-security-policy")).toContain("https: http:");
  const preference = await PUT(new Request(`http://localhost:3000/api/accounts/${f.accountId}/prefs`, {
    method: "PUT", headers: user.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
    body: JSON.stringify({ remoteContent: { allowedSenders: { "SENDER@EXAMPLE.TEST": true } } })
  }), { params: Promise.resolve({ accountId: f.accountId }) });
  expect(preference.status).toBe(200);
  expect((await preference.json()).prefs.remoteContent.allowedSenders).toEqual({ "sender@example.test": true });
  expect(await (await get()).text()).toContain('src="https://images.example.test/pixel');
  expect(await (await get("?remoteContent=block")).text()).not.toMatch(/\ssrc="https:\/\//);
  const other = await createAuthenticatedTestSession(f.accountId);
  const otherView = await GET(new Request("http://localhost:3000/html", { headers: other.jar.headers() }), params);
  expect(await otherView.text()).not.toMatch(/\ssrc="https:\/\//);
  const missing = await GET(new Request("http://localhost:3000/html", { headers: user.jar.headers() }), { params: Promise.resolve({ accountId: f.accountId, messageId: "missing" }) });
  expect(missing.status).toBe(404);
  expect(missing.headers.get("content-security-policy")).toContain("default-src 'none'");
});

test("HTML route matches the real From mailbox and rejects a quoted display-name address", async () => {
  const f = await createCollabFixture();
  const user = await createAuthenticatedTestSession(f.accountId);
  const [message] = await f.seed(f.message("<sender-privacy@example.test>", {
    from: '"Trusted <trusted@example.test>" <ACTUAL@EXAMPLE.TEST>',
    htmlBody: '<img src="https://images.example.test/pixel">'
  }));
  const params = { params: Promise.resolve({ accountId: f.accountId, messageId: message.id }) };
  const setAllowed = (email: string) => PUT(new Request(`http://localhost:3000/api/accounts/${f.accountId}/prefs`, {
    method: "PUT", headers: user.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
    body: JSON.stringify({ remoteContent: { allowedSenders: { [email]: true } } })
  }), { params: Promise.resolve({ accountId: f.accountId }) });
  const get = () => GET(new Request("http://localhost:3000/html", { headers: user.jar.headers() }), params);
  expect((await setAllowed("trusted@example.test")).status).toBe(200);
  expect(await (await get()).text()).not.toMatch(/\ssrc="https:\/\//);
  expect((await setAllowed("actual@example.test")).status).toBe(200);
  expect(await (await get()).text()).toContain('src="https://images.example.test/pixel"');
});

test("HTML route rejects unrelated sender permissions and saves/reads the full sender matrix", async () => {
  const f = await createCollabFixture();
  const user = await createAuthenticatedTestSession(f.accountId);
  const prefsParams = { params: Promise.resolve({ accountId: f.accountId }) };
  const patchPrefs = (patch: unknown) => PUT(new Request(`http://localhost:3000/api/accounts/${f.accountId}/prefs`, {
    method: "PUT", headers: user.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
    body: JSON.stringify(patch)
  }), prefsParams);
  for (const { name, from, key } of senderPermissionCases) {
    await patchPrefs({ remoteContent: null });
    expect((await patchPrefs({ remoteContent: { allowedSenders: { "trusted@example.test": true } } })).status).toBe(200);
    const [message] = await f.seed(f.message(`<${crypto.randomUUID()}@example.test>`, { from, htmlBody: '<img src="https://images.example.test/pixel">' }));
    const get = () => GET(new Request("http://localhost:3000/html", { headers: user.jar.headers() }), {
      params: Promise.resolve({ accountId: f.accountId, messageId: message.id })
    });
    const blocked = await get();
    expect(blocked.status, name).toBe(200);
    expect(await blocked.text(), name).not.toMatch(/\ssrc="https:\/\/images\.example\.test\/pixel"/);
    expect(blocked.headers.get("content-security-policy"), name).not.toContain("https: http:");
    expect(remoteContentSenderKey(from), name).toBe(key);
    if (!key) continue;
    const saved = await patchPrefs({ remoteContent: { allowedSenders: { [key]: true } } });
    expect(saved.status, name).toBe(200);
    const read = await getPrefs(new Request(`http://localhost:3000/api/accounts/${f.accountId}/prefs`, { headers: user.jar.headers() }), prefsParams);
    expect((await read.json()).prefs.remoteContent.allowedSenders[key], name).toBe(true);
    expect(await (await get()).text(), name).toMatch(/\ssrc="https:\/\/images\.example\.test\/pixel"/);
  }
});

test("sender preference saves canonicalize IDN, case and whitespace into one key and preserve quoted mailboxes", async () => {
  const f = await createCollabFixture();
  const user = await createAuthenticatedTestSession(f.accountId);
  const params = { params: Promise.resolve({ accountId: f.accountId }) };
  for (const input of [" \t ACTUAL@BÜCHER.EXAMPLE \t ", "actual@xn--bcher-kva.example", '  "ATTACKER TRUSTED"@EXAMPLE.TEST  ']) {
    const saved = await PUT(new Request(`http://localhost:3000/api/accounts/${f.accountId}/prefs`, {
      method: "PUT", headers: user.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
      body: JSON.stringify({ remoteContent: { allowedSenders: { [input]: true } } })
    }), params);
    expect(saved.status).toBe(200);
  }
  const read = await getPrefs(new Request(`http://localhost:3000/api/accounts/${f.accountId}/prefs`, { headers: user.jar.headers() }), params);
  expect((await read.json()).prefs.remoteContent.allowedSenders).toEqual({
    "actual@xn--bcher-kva.example": true,
    '"attacker trusted"@example.test': true
  });
});
