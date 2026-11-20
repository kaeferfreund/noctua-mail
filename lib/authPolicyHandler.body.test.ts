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
