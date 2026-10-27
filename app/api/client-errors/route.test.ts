import { afterEach, expect, spyOn, test } from "bun:test";
import { createAuthenticatedTestSession, getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { POST } from "./route";

const logged = spyOn(console, "error").mockImplementation(() => {});
afterEach(() => logged.mockClear());
const crashLines = () => logged.mock.calls.filter(call => call[0] === "[client] crash");
const report = { source: "boundary", message: "TypeError: Cannot read properties of undefined (reading 'id')", stack: "TypeError: …\n    at Reader (chunk.js:1:2)",
  path: "/", queryKeys: ["a", "f", "m", "q"], build: "synthetic-build", userAgent: "Synthetic iPhone", standalone: true };
function request(cookie: string, body: unknown = report, extra: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/client-errors", { method: "POST", headers: {
    origin: "http://localhost:3000", "content-type": "application/json", cookie, ...extra
  }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("writes one structured log line for a signed-in session", async () => {
  const f = await createAuthenticatedTestSession();
  const response = await POST(request(f.jar.header(), { ...report, cookie: "session=secret", q: "private search" }));
  expect(response.status).toBe(204);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(crashLines()).toHaveLength(1);
  const [, line] = crashLines()[0];
  expect(typeof line).toBe("string");
  expect(line).not.toContain("\n");
  expect(JSON.parse(line as string)).toMatchObject({ ...report, digest: "", userId: f.user.id });
  expect(line).not.toContain("secret");
  expect(line).not.toContain("private search");
});

test("requires a session and the shared origin and JSON guards", async () => {
  expect((await POST(request(""))).status).toBe(401);
  const f = await createAuthenticatedTestSession();
  const foreign = await POST(request(f.jar.header(), report, { origin: "https://foreign.example.test" }));
  expect(foreign.status).toBe(403);
  expect((await POST(request(f.jar.header(), report, { "content-type": "text/plain" }))).status).toBe(400);
  expect(crashLines()).toHaveLength(0);
});

test("restricted sessions (security screens) report as well", async () => {
  const h = await getSharedTestAuthHarness();
  const user = await h.createUser(`client-error-setup-${crypto.randomUUID()}@example.test`);
  const signed = await h.signIn(user.email);
  await h.seedSessionSecurity(signed.session!.session.id, user.id, "setup");
  expect((await POST(request(signed.jar.header()))).status).toBe(204);
});

test("rejects malformed and oversized bodies without logging them", async () => {
  const f = await createAuthenticatedTestSession();
  for (const body of ["{", { message: "no source" }, [report]]) expect((await POST(request(f.jar.header(), body))).status).toBe(400);
  const large = await POST(request(f.jar.header(), { ...report, stack: "s".repeat(17 * 1024) }));
  expect(large.status).toBe(413);
  expect(crashLines()).toHaveLength(0);
});

test("limits each session to ten reports per minute", async () => {
  const f = await createAuthenticatedTestSession();
  for (let n = 0; n < 10; n++) expect((await POST(request(f.jar.header()))).status).toBe(204);
  const limited = await POST(request(f.jar.header()));
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(crashLines()).toHaveLength(10);
  // Another session keeps its own budget.
  const other = await createAuthenticatedTestSession();
  expect((await POST(request(other.jar.header()))).status).toBe(204);
});

test("overlay Back telemetry reaches the journal with count and no stack", async () => {
  const f = await createAuthenticatedTestSession();
  expect((await POST(request(f.jar.header(), { ...report, source: "error", kind: "overlay-back-fallback", count: 4, stack: "ignored" }))).status).toBe(204);
  expect(JSON.parse(crashLines()[0][1] as string)).toMatchObject({ kind: "overlay-back-fallback", count: 4, stack: "" });
});

test("a blank-screen report logs as [client] blank, once per minute and session", async () => {
  const f = await createAuthenticatedTestSession();
  const blank = { ...report, source: "watchdog", message: "Blank screen", kind: "blank-screen", stack: "ignored",
    blank: { search: "?a=~qa&q=private search", historyStateKeys: ["noctuaRoot"], visibilityState: "visible", navigationType: "navigate", trigger: "load" } };
  expect((await POST(request(f.jar.header(), blank))).status).toBe(204);
  expect((await POST(request(f.jar.header(), blank))).status).toBe(429);
  // Crash reports keep their own budget.
  expect((await POST(request(f.jar.header()))).status).toBe(204);
  const blankLines = logged.mock.calls.filter(call => call[0] === "[client] blank");
  expect(blankLines).toHaveLength(1);
  expect(crashLines()).toHaveLength(1);
  const line = blankLines[0][1] as string;
  expect(JSON.parse(line)).toMatchObject({ kind: "blank-screen", stack: "", userId: f.user.id,
    blank: { search: "?a=%7Eqa&q=", historyStateKeys: ["noctuaRoot"], navigationType: "navigate", trigger: "load" } });
  expect(line).not.toContain("private search");
});
