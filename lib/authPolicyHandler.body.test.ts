import { expect, test } from "bun:test";
import "./testDbHarness";
import { getDb } from "./db/connection";
import { AUTH_HANDLER_BODY_LIMIT, wrapAuthPolicyHandler } from "./authPolicyHandler";

const post = (path: string, body: BodyInit) => new Request(`http://localhost:3000/api/ba${path}`, {
  method: "POST", body, headers: { "content-type": "application/json", origin: "http://localhost:3000" }
});

test("public auth endpoints refuse an oversized body before the library or reset parsing runs", async () => {
  let calls = 0;
  const wrapped = wrapAuthPolicyHandler(async () => { calls++; return Response.json({ ok: true }); }, getDb);
  const large = JSON.stringify({ token: "synthetic", newPassword: "x".repeat(AUTH_HANDLER_BODY_LIMIT) });
  for (const path of ["/reset-password", "/sign-in/email"]) {
    const response = await wrapped(post(path, large));
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect(calls).toBe(0);
});

test("a body inside the limit reaches the library unchanged", async () => {
  let seen = "";
  const wrapped = wrapAuthPolicyHandler(async request => { seen = await request.text(); return Response.json({ ok: false }, { status: 401 }); }, getDb);
  const body = JSON.stringify({ email: "user@example.test", password: "synthetic" });
  await wrapped(post("/sign-in/email", body));
  expect(seen).toBe(body);
});

// Under `next start` the route receives Next's own request object, which is not a
// native Request of the runtime. Rebuilding it with `new Request(request, init)` lost
// method and URL there, so every POST to /api/ba/* answered 404. The wrapper must hand
// the library the same method, URL and headers for any Request-shaped object.
test("the bounded body keeps method, URL and headers of a non-native request object", async () => {
  let seen: Record<string, string | null> = {};
  const wrapped = wrapAuthPolicyHandler(async request => {
    seen = { method: request.method, url: request.url, type: request.headers.get("content-type"), body: await request.text() };
    return Response.json({ ok: false }, { status: 401 });
  }, getDb);
  const body = JSON.stringify({ email: "user@example.test", password: "synthetic" });
  const native = post("/sign-in/email", body);
  const foreign = { url: native.url, method: native.method, headers: native.headers, body: native.body, signal: native.signal,
    clone: () => native.clone(), json: () => native.clone().json(), text: () => native.clone().text() } as unknown as Request;
  await wrapped(foreign);
  expect(seen).toEqual({ method: "POST", url: "http://localhost:3000/api/ba/sign-in/email", type: "application/json", body });
});
