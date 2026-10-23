import { afterEach, describe, expect, jest, test } from "bun:test";
import { connect } from "node:net";
import { requireBodylessSameOrigin, requireMutationSameOrigin } from "./requestOrigin";
import { BODY_READ_TIMEOUT_MS } from "./readAuthJson";
import { POST as logout } from "@/app/api/auth/logout/route";
import { DELETE as removeUserPasskey } from "@/app/api/admin/users/[userId]/passkeys/[passkeyId]/route";
import { DELETE as revokeUserSessions } from "@/app/api/admin/users/[userId]/sessions/route";

const origin = "http://localhost:3000";
const command = (init: RequestInit & { headers?: Record<string, string> } = {}) =>
  new Request(`${origin}/api/accounts/synthetic/messages/synthetic/delete`,
    { method: "POST", ...init, headers: { origin, ...init.headers } });
async function outcome(request: Request) {
  const response = await requireMutationSameOrigin(request);
  return response ? { status: response.status, code: (await response.json()).code } : null;
}

describe("requireMutationSameOrigin", () => {
  test("an empty body is accepted with or without headers", async () => {
    // A ReadableStream body matches what Next hands production handlers.
    const empty = () => new ReadableStream({ start(controller) { controller.close(); } });
    expect(await outcome(command())).toBeNull();
    expect(await outcome(command({ method: "DELETE" }))).toBeNull();
    expect(await outcome(command({ body: empty() }))).toBeNull();
    expect(await outcome(command({ body: "", headers: { "content-type": "text/plain" } }))).toBeNull();
  });
  test("a JSON body stays unread for the handler", async () => {
    const request = command({ body: '{"folderId":"synthetic"}', headers: { "content-type": "application/json; charset=utf-8" } });
    expect(await outcome(request)).toBeNull();
    expect(await request.json()).toEqual({ folderId: "synthetic" });
  });
  test("a non-empty body must be JSON and every request must be same-origin", async () => {
    expect(await outcome(command({ body: "x", headers: { "content-type": "text/plain" } })))
      .toEqual({ status: 400, code: "json_required" });
    expect(await outcome(command({ body: "a=1", headers: { "content-type": "application/x-www-form-urlencoded" } })))
      .toEqual({ status: 400, code: "json_required" });
    expect(await outcome(new Request(`${origin}/api/synthetic`, { method: "POST", headers: { origin: "https://foreign.example.test" } })))
      .toEqual({ status: 403, code: "invalid_origin" });
    expect(await outcome(new Request(`${origin}/api/synthetic`, { method: "POST" })))
      .toEqual({ status: 403, code: "invalid_origin" });
  });
});

const CHUNK = 64 * 1024;
const LARGE = 16 * 1024 * 1024;
/** A pull-based 16 MiB body that counts how many chunks a reader actually pulled. */
function largeBody() {
  let pulled = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled * CHUNK >= LARGE) return controller.close();
      pulled++;
      controller.enqueue(new Uint8Array(CHUNK).fill(120));
    },
    cancel() { cancelled = true; }
  }, { highWaterMark: 0 });
  return { body, pulled: () => pulled, cancelled: () => cancelled };
}
const largeRequest = (path: string, method: string, body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Request(`${origin}${path}`, { method, body, headers: { origin, ...headers } });

describe("bodyless guards never buffer a large body", () => {
  test("a streamed 16 MiB body is rejected after its first chunk and the stream is cancelled", async () => {
    for (const [guard, code] of [[requireBodylessSameOrigin, "unexpected_body"], [requireMutationSameOrigin, "json_required"]] as const) {
      const large = largeBody();
      const response = await guard(largeRequest("/api/synthetic", "POST", large.body, { "content-type": "text/plain" }));
      expect(response?.status).toBe(400);
      expect((await response!.json()).code).toBe(code);
      expect(large.pulled()).toBe(1);
      expect(large.cancelled()).toBe(true);
    }
  });
  test("a declared 16 MiB Content-Length is rejected without reading the body", async () => {
    const large = largeBody();
    const response = await requireBodylessSameOrigin(largeRequest("/api/synthetic", "POST", large.body, { "content-length": String(LARGE) }));
    expect(response?.status).toBe(400);
    expect((await response!.json()).code).toBe("unexpected_body");
    expect(large.pulled()).toBe(0);
  });
  test("pre-session logout and admin passkey/session actions reject 16 MiB after one chunk", async () => {
    const params = { userId: "synthetic-user", passkeyId: "synthetic-passkey" };
    const routes: Array<[string, (body: ReadableStream<Uint8Array>) => Promise<Response>]> = [
      ["logout", body => logout(largeRequest("/api/auth/logout", "POST", body))],
      ["admin passkey removal", body => removeUserPasskey(largeRequest(`/api/admin/users/${params.userId}/passkeys/${params.passkeyId}`, "DELETE", body), { params: Promise.resolve(params) })],
      ["admin session revoke", body => revokeUserSessions(largeRequest(`/api/admin/users/${params.userId}/sessions`, "DELETE", body), { params: Promise.resolve({ userId: params.userId }) })]
    ];
    for (const [name, call] of routes) {
      const large = largeBody();
      // No session cookie: these guards run before any session lookup.
      const response = await call(large.body);
      expect(response.status, name).toBe(400);
      expect((await response.json()).code, name).toBe("unexpected_body");
      expect(large.pulled(), name).toBe(1);
      expect(large.cancelled(), name).toBe(true);
    }
  });
});

describe("bodyless guards abandon a stalled body", () => {
  afterEach(() => jest.useRealTimers());
  /**
   * A real chunked HTTP request whose body stalls: the headers and optional
   * chunks are sent, but never the terminating chunk.
   */
  async function stalledChunked(path: string, chunks: string, handler: (request: Request) => Promise<Response>) {
    let entered!: () => void;
    const reached = new Promise<void>(resolve => { entered = resolve; });
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
      const response = handler(request);
      entered();
      return response;
    } });
    const socket = connect(server.port, "127.0.0.1");
    try {
      let raw = "";
      const answered = new Promise<string>(resolve => socket.on("data", data => {
        raw += data.toString("latin1");
        if (raw.includes("\r\n\r\n")) resolve(raw.split("\r\n")[0]);
      }));
      socket.write(`POST ${path} HTTP/1.1\r\nHost: 127.0.0.1:${server.port}\r\nOrigin: ${origin}\r\n` +
        `Content-Type: text/plain\r\nTransfer-Encoding: chunked\r\n\r\n${chunks}`);
      await reached;
      jest.advanceTimersByTime(BODY_READ_TIMEOUT_MS);
      return await answered;
    } finally {
      socket.destroy();
      server.stop(true);
    }
  }

  test("a stalled chunked text/plain body is rejected at the read deadline, before any session check", async () => {
    for (const chunks of ["", "3\r\nabc\r\n"]) {
      jest.useFakeTimers();
      const guarded = (guard: typeof requireMutationSameOrigin) => async (request: Request) =>
        await guard(request) ?? new Response(null, { status: 204 });
      expect(await stalledChunked("/api/accounts/synthetic/threads/recompute", chunks, guarded(requireMutationSameOrigin)), chunks)
        .toBe("HTTP/1.1 400 Bad Request");
      expect(await stalledChunked("/api/accounts/synthetic/mcp-tokens/synthetic", chunks, guarded(requireBodylessSameOrigin)), chunks)
        .toBe("HTTP/1.1 400 Bad Request");
      // No session cookie: logout's guard runs before any session lookup.
      expect(await stalledChunked("/api/auth/logout", chunks, logout), chunks).toBe("HTTP/1.1 400 Bad Request");
      jest.useRealTimers();
    }
  });
});
