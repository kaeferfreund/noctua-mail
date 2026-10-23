import { describe, expect, test } from "bun:test";
import { requireMutationSameOrigin } from "./requestOrigin";

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
