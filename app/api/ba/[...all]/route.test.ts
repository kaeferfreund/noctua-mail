import { beforeAll, describe, expect, test } from "bun:test";
// Sets NOCTUA_DATA_DIR to a temp dir before the master DB opens.
import "@/lib/testDbHarness";
import { AUTH_BASE_PATH, getAuth } from "@/lib/betterAuth";
import { GET, POST } from "./route";
// eslint-disable-next-line no-restricted-imports -- This spike checks handle identity/PRAGMAs on the exact auth connection, not barrel CRUD.
import { getDb, getAuthDb } from "@/lib/db/connection";

const BASE = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "spike-route-test-secret-0123456789abcdef";
process.env.BETTER_AUTH_URL ??= BASE;

function url(pathname: string) {
  return `${BASE}${AUTH_BASE_PATH}${pathname}`;
}

function post(pathname: string, body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(url(pathname), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body)
    })
  );
}

beforeAll(async () => {
  const auth = await getAuth();
  // The app harness/getAuth instance survives bun --rerun-each file runs.
  const context = await auth.$context;
  if (!(await context.internalAdapter.findUserByEmail("route@example.test"))) {
    await auth.api.createUser({
      body: { email: "route@example.test", password: "route-password-1", name: "Route", role: "user" }
    });
  }
});

describe("app/api/ba/[...all] (toNextJsHandler on the lazily built instance)", () => {
  test("getAuth() is memoised within this module graph", async () => {
    expect(await getAuth()).toBe(await getAuth());
  });

  test("GET /api/ba/ok and /api/ba/get-session answer through the Next route", async () => {
    const ok = await GET(new Request(url("/ok")));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });

    const anonymous = await GET(new Request(url("/get-session")));
    expect(anonymous.status).toBe(200);
    expect(await anonymous.json()).toBeNull();
  });

  test("POST /api/ba/sign-in/email from the app origin sets the session cookie", async () => {
    const res = await post(
      "/sign-in/email",
      { email: "route@example.test", password: "route-password-1" },
      { origin: BASE }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toStartWith("noctua.session_token=");

    const session = await GET(
      new Request(url("/get-session"), { headers: { cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] } })
    );
    expect(((await session.json()) as { user: { email: string } }).user.email).toBe("route@example.test");
  });

  test("a foreign Origin is rejected and the disabled impersonation path is a 404", async () => {
    const foreign = await post(
      "/sign-in/email",
      { email: "route@example.test", password: "route-password-1" },
      { origin: "https://evil.example" }
    );
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).code).toBe("INVALID_ORIGIN");

    const disabled = await post("/admin/impersonate-user", { userId: "x" }, { origin: BASE });
    expect(disabled.status).toBe(404);
  });

  test("auth uses a dedicated handle on the master file with nonblocking writers", async () => {
    const master = await getDb();
    const authDb = await getAuthDb();
    expect(master).not.toBe(authDb);
    expect(master.prepare("PRAGMA busy_timeout").get().timeout).toBe(0);
    expect(authDb.prepare("PRAGMA busy_timeout").get().timeout).toBe(0);
  });

  test("the Better Auth tables live next to Noctua's in the same master DB", async () => {
    const context = await (await getAuth()).$context;
    const row = await context.adapter.findOne<{ email: string }>({
      model: "user",
      where: [{ field: "email", value: "route@example.test" }]
    });
    expect(row?.email).toBe("route@example.test");
  });
});
