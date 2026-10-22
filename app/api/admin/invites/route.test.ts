import { describe, expect, test } from "bun:test";
import { POST } from "./route";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";

describe("admin invite mutation origin contract", () => {
  test("origin and JSON checks precede the admin guard; same-origin JSON creates an invite", async () => {
    const f = await createAuthenticatedTestSession(undefined, "admin");
    const request = (headers: Record<string, string>, cookie = f.jar.header()) => new Request("http://localhost:3000/api/admin/invites", {
      method: "POST", headers: { cookie, ...headers }, body: "{}"
    });
    const json = { "content-type": "application/json" };
    for (const cookie of ["", f.jar.header()]) {
      expect((await POST(request({ ...json, origin: "https://foreign.example.test" }, cookie))).status).toBe(403);
      expect((await POST(request(json, cookie))).status).toBe(403);
      expect((await POST(request({ origin: "http://localhost:3000", "content-type": "text/plain" }, cookie))).status).toBe(400);
    }
    expect((await POST(request({ ...json, origin: "http://localhost:3000" }))).status).toBe(201);
    expect((await POST(request({ ...json, referer: "http://localhost:3000/admin" }))).status).toBe(201);
  });
});
