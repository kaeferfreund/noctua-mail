import { expect, test } from "bun:test";
import { JSON_BODY_LIMITS, readJsonBody } from "./readJsonBody";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/synthetic", { method: "POST", body, headers });

test("parses JSON and maps empty or malformed bodies to null", async () => {
  expect(await readJsonBody(post(JSON.stringify({ a: 1 })))).toEqual({ ok: true, value: { a: 1 } });
  expect(await readJsonBody(post(null))).toEqual({ ok: true, value: null });
  expect(await readJsonBody(post("{not json"))).toEqual({ ok: true, value: null });
});

test("an oversized body answers 413 without reading the rest of the stream", async () => {
  let reads = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(1024 * 1024).fill(32)); }
  }, { highWaterMark: 0 });
  const result = await readJsonBody(post(body), { limit: 2 * 1024 * 1024 });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("unreachable");
  expect(result.response.status).toBe(413);
  expect(await result.response.json()).toMatchObject({ code: "request_body_too_large" });
  expect(reads).toBe(3);
  // A declared length above the limit is refused before any read.
  const declared = await readJsonBody(post("{}", { "content-length": String(JSON_BODY_LIMITS.default + 1) }));
  expect(declared.ok ? 200 : declared.response.status).toBe(413);
});

test("a stalled body answers 408 at the deadline", async () => {
  const body = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); } }, { highWaterMark: 0 });
  const result = await readJsonBody(post(body), { timeoutMs: 20 });
  expect(result.ok ? 200 : result.response.status).toBe(408);
  if (!result.ok) expect(await result.response.json()).toMatchObject({ code: "request_body_timeout" });
});

test("mailbox routes check the session before reading the body", async () => {
  await import("@/lib/testDbHarness");
  const routes = await Promise.all([
    import("@/app/api/accounts/[accountId]/messages/move/route"),
    import("@/app/api/accounts/[accountId]/messages/delete/bulk/route"),
    import("@/app/api/accounts/[accountId]/thread/related/route"),
    import("@/app/api/accounts/[accountId]/reminders/route")
  ]);
  for (const route of routes) {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(1024).fill(32)); }
    }, { highWaterMark: 0 });
    const request = new Request("http://localhost:3000/api/accounts/synthetic/x", {
      method: "POST", body, headers: { "content-type": "application/json", origin: "http://localhost:3000" }, duplex: "half"
    } as RequestInit);
    const response = await route.POST(request, { params: Promise.resolve({ accountId: "synthetic", messageId: "synthetic" }) });
    expect(response.status).toBe(401);
    expect(reads).toBe(0);
  }
});
