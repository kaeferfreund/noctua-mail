import { beforeAll, describe, expect, test } from "bun:test";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { createCollabFixture } from "./testThreadCollabHarness";
import { GET as getCollab, PATCH } from "@/app/api/accounts/[accountId]/threads/[threadId]/collab/route";
import { POST } from "@/app/api/accounts/[accountId]/threads/[threadId]/comments/route";
import { DELETE } from "@/app/api/accounts/[accountId]/threads/[threadId]/comments/[commentId]/route";
import { GET as activity } from "@/app/api/accounts/[accountId]/threads/[threadId]/activity/route";
import { GET as members } from "@/app/api/accounts/[accountId]/members/route";
import { executeMcpHttpRequest } from "./mcpServer";
import { getDb } from "./db/connection";
import { recordReplySent, getThreadCollabState, listThreadActivity, updateThreadCollabState } from "./threadCollab";
let principal: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
beforeAll(async () => { principal = await createAuthenticatedTestSession(); });
const thread = "<case%25/with space@example.test>";
async function fixture(role: "viewer" | "editor" | "manager") {
  const f = await createCollabFixture();
  await principal.addMembership(principal.user.id, f.accountId, role);
  const [message] = await f.seed(f.message(thread));
  const route = (extra = {}) => ({ params: Promise.resolve({ accountId: f.accountId, threadId: encodeURIComponent(thread), ...extra }) });
  const request = (method = "GET", body?: unknown, headers = {}) => new Request("http://localhost:3000/api/collab", {
    method, headers: principal.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json", "x-noctua-client": "test_browser", ...headers }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  async function tool(name: string, args: Record<string, unknown> = {}) {
    const response = await executeMcpHttpRequest({ body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
      accountId: f.accountId, account: f.account, tokenRecord: { id: "synthetic-token", accountId: f.accountId, createdByUserId: principal.user.id,
        label: "Synthetic", tokenSuffix: "test", createdAt: Date.now(), expiresAt: null, lastUsedAt: null } });
    return (response.responses[0] as unknown as { result: { isError?: boolean; structuredContent: { members: Array<{ userId: string; name: string | null; email: string; role: string; isOwner: boolean; disabled: boolean }>; accounts: Array<{ accessRole: string }>; items: Array<{ collab: unknown }>; state: { assigneeUserId: string }; activity: Array<{ actorClientId: string }> }; content: Array<{ text: string }> } }).result;
  }
  return { ...f, message, request, route, tool };
}
describe("collaboration REST", () => {
  for (const role of ["viewer", "editor", "manager"] as const) test(`${role} reads sanitized state, members and activity; writes follow role`, async () => {
    const f = await fixture(role);
    const response = await getCollab(f.request(), f.route());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.state.threadId).toBe(thread);
    const realUrl = `http://localhost:3000/api/accounts/${f.accountId}/threads/${encodeURIComponent(thread)}/collab`;
    const decodedParamsResponse = await getCollab(new Request(realUrl, { headers: f.request().headers }), f.route({ threadId: thread }));
    expect((await decodedParamsResponse.json()).state.threadId).toBe(thread);
    expect(data.members.find((m: { userId: string }) => m.userId === principal.user.id)).toEqual({ userId: principal.user.id, name: "Synthetic User", email: principal.user.email, role, isOwner: false, disabled: false });
    expect((await members(f.request(), f.route())).status).toBe(200);
    expect((await activity(f.request(), f.route())).status).toBe(200);
    expect((await PATCH(f.request("PATCH", { status: "waiting" }), f.route())).status).toBe(role === "viewer" ? 403 : 200);
    expect((await POST(f.request("POST", { body: "Synthetic internal note" }), f.route())).status).toBe(role === "viewer" ? 403 : 201);
    expect((await DELETE(f.request("DELETE"), f.route({ commentId: "absent" }))).status).toBe(role === "viewer" ? 403 : 200);
  });
  test("GET and every REST mutation return the committed per-thread revision", async () => {
    const f = await fixture("editor");
    expect((await (await getCollab(f.request(), f.route())).json()).state.revision).toBe(0);
    const updated = await (await PATCH(f.request("PATCH", { status: "waiting" }), f.route())).json();
    expect(updated.state.revision).toBe(1);
    const added = await (await POST(f.request("POST", { body: "Synthetic versioned note" }), f.route())).json();
    expect(added.state.revision).toBe(2);
    expect(added.comment.revision).toBe(2);
    const snapshot = await (await getCollab(f.request(), f.route())).json();
    expect(snapshot.state).toEqual(added.state);
    expect(snapshot.comments).toEqual([added.comment]);
    const deleted = await (await DELETE(f.request("DELETE"), f.route({ commentId: added.comment.id }))).json();
    expect(deleted.state.revision).toBe(3);
    const latest = await (await getCollab(f.request(), f.route())).json();
    expect(latest.state).toEqual(deleted.state);
    expect(latest.comments).toEqual([]);
  });
  test("comment DELETE accepts bodyless same-origin, rejects cross-origin and unexpected bodies", async () => {
    const f = await fixture("editor");
    const added = await (await POST(f.request("POST", { body: "Delete regression" }), f.route())).json();
    const route = f.route({ commentId: added.comment.id });
    const req = (origin: string, body?: string) => new Request("http://localhost:3000/api/comment", {
      method: "DELETE", headers: principal.jar.headers({ origin }), ...(body === undefined ? {} : { body })
    });
    expect((await DELETE(req("https://evil.example.test"), route)).status).toBe(403);
    const unexpected = await DELETE(req("http://localhost:3000", "{}"), route);
    expect(unexpected.status).toBe(400);
    expect((await unexpected.json()).code).toBe("unexpected_body");
    expect((await DELETE(req("http://localhost:3000"), route)).status).toBe(200);
  });
  for (const role of ["viewer", "editor", "manager"] as const)
    test(`${role}: REST, bootstrap and MCP use canonical member DTO and manager-only disabled visibility`, async () => {
      const f = await fixture(role);
      const owner = await principal.createUser(`owner-${crypto.randomUUID()}@example.test`);
      const disabled = await principal.createUser(`disabled-${crypto.randomUUID()}@example.test`);
      await principal.addMembership(disabled.id, f.accountId, "editor");
      const db = await getDb();
      db.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(owner.id, f.accountId);
      db.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(disabled.id);
      // Expired bans are enabled, matching team-auth's getUsers mapping.
      const expired = await principal.createUser(`expired-${crypto.randomUUID()}@example.test`);
      await principal.addMembership(expired.id, f.accountId, "viewer");
      db.prepare("UPDATE auth_user SET banned=1,banExpires=? WHERE id=?").run(new Date(Date.now() - 60_000).toISOString(), expired.id);
      const rest = (await (await members(f.request(), f.route())).json()).members;
      const bootstrap = (await (await getCollab(f.request(), f.route())).json()).members;
      const mcp = (await f.tool("list_mailbox_members")).structuredContent.members;
      expect(bootstrap).toEqual(rest); expect(mcp).toEqual(rest);
      expect(rest.find((m: { userId: string }) => m.userId === owner.id)).toEqual({
        userId: owner.id, name: owner.name, email: owner.email, role: "manager", isOwner: true, disabled: false
      });
      expect(rest.find((m: { userId: string }) => m.userId === expired.id)?.disabled).toBe(false);
      const banned = rest.find((m: { userId: string }) => m.userId === disabled.id);
      if (role === "manager") expect(banned).toEqual({ userId: disabled.id, name: disabled.name, email: disabled.email, role: "editor", isOwner: false, disabled: true });
      else expect(banned).toBeUndefined();
      for (const member of rest) expect(Object.keys(member).sort()).toEqual(["disabled", "email", "isOwner", "name", "role", "userId"]);
    });
  test("message-less thread retains historical state with empty lists; never-known thread has defaults", async () => {
    const f = await fixture("editor");
    await PATCH(f.request("PATCH", { status: "waiting", assigneeUserId: principal.user.id }), f.route());
    await POST(f.request("POST", { body: "Historical note" }), f.route());
    const historical = (await (await getCollab(f.request(), f.route())).json()).state;
    f.db.prepare("DELETE FROM messages WHERE accountId=?").run(f.accountId);
    const retained = await (await getCollab(f.request(), f.route())).json();
    expect(retained.state).toEqual(historical);
    expect(retained.comments).toEqual([]); expect(retained.activity).toEqual([]);
    const unknown = await (await getCollab(f.request(), f.route({ threadId: "<never-known@example.test>" }))).json();
    expect(unknown.state.status).toBe("open"); expect(unknown.state.assigneeUserId).toBeNull();
    expect(unknown.state.commentCount).toBe(0);
    expect(unknown.comments).toEqual([]); expect(unknown.activity).toEqual([]);
  });
  test("validates JSON, status, assignee, comment, limit, thread existence and origin", async () => {
    const f = await fixture("editor");
    for (const body of [{ status: "done" }, { status: null }, { assigneeUserId: "unknown" }, { assigneeUserId: 1 }, [], null, {}, { unexpected: true }])
      expect((await PATCH(f.request("PATCH", body), f.route())).status).toBe(400);
    for (const body of [{ body: "" }, { body: " " }, { body: 4 }, { body: "x".repeat(20001) }, null])
      expect((await POST(f.request("POST", body), f.route())).status).toBe(400);
    expect((await PATCH(f.request("PATCH", { status: "closed" }), f.route({ threadId: "missing" }))).status).toBe(404);
    expect((await POST(f.request("POST", { body: "missing" }), f.route({ threadId: "missing" }))).status).toBe(404);
    expect((await DELETE(f.request("DELETE"), f.route({ threadId: "missing", commentId: "absent" }))).status).toBe(404);
    expect((await getCollab(f.request(), f.route({ threadId: "%ZZ" }))).status).toBe(400);
    for (const limit of ["0", "501", "NaN", "1.5", ""]) {
      const req = new Request(`http://localhost:3000/api/activity?limit=${limit}`, { headers: principal.jar.headers() });
      expect((await activity(req, f.route())).status).toBe(400);
    }
    for (const run of [() => PATCH(f.request("PATCH", { status: "closed" }, { origin: "https://evil.example.test" }), f.route()),
      () => POST(f.request("POST", { body: "x" }, { origin: "https://evil.example.test" }), f.route()),
      () => DELETE(f.request("DELETE", undefined, { origin: "https://evil.example.test" }), f.route())]) expect((await run()).status).toBe(403);
    expect((await POST(f.request("POST", { body: "x" }, { "content-type": "text/plain" }), f.route())).status).toBe(415);
    expect((await PATCH(new Request("http://localhost:3000/api", { method: "PATCH", headers: f.request().headers, body: "{" }), f.route())).status).toBe(400);
    expect((await getCollab(new Request("http://localhost:3000/api"), f.route())).status).toBe(401);
    expect((await getCollab(f.request(), f.route({ accountId: "inaccessible" }))).status).toBe(403);
  });
  test("forwards refresh cookies on every collaboration route and on validation/origin errors", async () => {
    const f = await fixture("editor");
    const session = await createAuthenticatedTestSession(f.accountId);
    await session.seedSessionSecurity(session.session.id, session.user.id, "mfa", "password_totp", Date.now() - 7200_000);
    const calls = [
      [getCollab, "GET", undefined, {}], [PATCH, "PATCH", { status: "waiting" }, {}],
      [POST, "POST", { body: "Synthetic refresh note" }, {}], [DELETE, "DELETE", undefined, {}],
      [activity, "GET", undefined, {}], [members, "GET", undefined, {}],
      [PATCH, "PATCH", { status: "invalid" }, {}],
      [POST, "POST", { body: "rejected" }, { origin: "https://evil.example.test" }]
    ] as const;
    for (const [handler, method, body, extraHeaders] of calls) {
      session.master.prepare("UPDATE auth_session SET updatedAt=?,expiresAt=? WHERE id=?").run(new Date(Date.now() - 7200_000).toISOString(), new Date(Date.now() + 79200_000).toISOString(), session.session.id);
      const headers = session.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json", ...extraHeaders });
      const response = await handler(new Request("http://localhost:3000/api/collab", { method, headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), f.route({ commentId: "absent" }));
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
      session.jar.absorb(response.headers);
    }
    session.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), session.session.id);
    const denied = await getCollab(new Request("http://localhost:3000/api/collab", { headers: session.jar.headers() }), f.route());
    expect(denied.status).toBe(401);
    expect(denied.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });
  test("only author or manager deletes another editor's comment", async () => {
    const f = await fixture("editor");
    const other = await principal.createUser(`other-${crypto.randomUUID()}@example.test`);
    const { addThreadComment } = await import("./threadCollab");
    await principal.addMembership(other.id, f.accountId, "editor");
    const added = (await addThreadComment(f.accountId, thread, "Other author's note", { userId: other.id, clientId: "web:other" }))!;
    expect((await DELETE(f.request("DELETE"), f.route({ commentId: added.comment.id }))).status).toBe(403);
    (await getDb()).prepare("UPDATE user_accounts SET role='manager' WHERE accountId=? AND userId=?").run(f.accountId, principal.user.id);
    const response = await DELETE(f.request("DELETE"), f.route({ commentId: added.comment.id }));
    expect(response.status).toBe(200);
    expect((await response.json()).state.commentCount).toBe(0);
    const mine = await (await POST(f.request("POST", { body: "My note" }), f.route())).json();
    expect((await DELETE(f.request("DELETE"), f.route({ commentId: mine.comment.id }))).status).toBe(200);
  });
});
describe("collaboration MCP executor", () => {
  for (const role of ["viewer", "editor", "manager"] as const) test(`${role}: bound reads and live-role mutations`, async () => {
    const f = await fixture(role);
    for (const [name, args] of [["list_mailbox_members", {}], ["get_thread_collaboration", { messageId: f.message.id }], ["list_thread_activity", { threadId: thread }], ["list_accounts", {}]] as const)
      expect((await f.tool(name, args)).isError).not.toBe(true);
    const accounts = (await f.tool("list_accounts")).structuredContent.accounts;
    expect(accounts).toHaveLength(1); expect(accounts[0].accessRole).toBe(role);
    for (const [name, args] of [["set_thread_status", { threadId: thread, status: "waiting" }], ["assign_thread", { threadId: thread, assigneeUserId: "me" }],
      ["add_internal_comment", { messageId: f.message.id, body: "Synthetic MCP note" }], ["flag_message", { messageId: "irrelevant" }],
      ["create_draft_message", { text: "Synthetic" }]] as const) {
      if (name === "create_draft_message" && role !== "viewer") continue;
      const result = await f.tool(name, args);
      if (role === "viewer") { expect(result.isError).toBe(true); expect(result.content[0].text).toContain("Insufficient mailbox role"); }
      else if (["set_thread_status", "assign_thread", "add_internal_comment"].includes(name)) expect(result.isError).not.toBe(true);
    }
    expect((await f.tool("list_mailbox_members", { accountId: "other" })).isError).toBe(true);
    expect((await f.tool("set_thread_status", { threadId: "missing", status: "closed" })).isError).toBe(true);
    expect((await f.tool("assign_thread", { threadId: thread, assigneeUserId: "unknown" })).isError).toBe(true);
    expect((await f.tool("list_thread_activity", { threadId: thread, limit: 501 })).isError).toBe(true);
    expect((await f.tool("get_thread_collaboration", {})).isError).toBe(true);
    if (role !== "viewer") {
      const result = (await f.tool("get_thread_collaboration", { threadId: thread })).structuredContent;
      expect(result.state.assigneeUserId).toBe(principal.user.id);
      expect(result.activity[0].actorClientId).toBe("mcp:synthetic-token");
    }
    (await getDb()).prepare("DELETE FROM user_accounts WHERE accountId=? AND userId=?").run(f.accountId, principal.user.id);
    expect((await f.tool("list_mailbox_members")).isError).toBe(true);
  });
  test("message lists enrich collaboration and use token creator for assigned-to-me", async () => {
    const f = await fixture("editor");
    await updateThreadCollabState(f.accountId, thread, { status: "waiting", assigneeUserId: principal.user.id }, { userId: principal.user.id, clientId: "web:test" });
    for (const [name, args] of [["search_messages", { badges: ["assigned-to-me"] }], ["list_messages_by_folder", { folderId: f.folderId, badges: ["assigned-to-me"] }],
      ["search_messages", { relatedId: f.message.id }], ["search_messages", { threadIds: [thread] }]] as const) {
      const result = await f.tool(name, args);
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent.items[0]?.collab).toMatchObject({ status: "waiting", assigneeUserId: principal.user.id });
    }
    (await getDb()).prepare("UPDATE user_accounts SET role='viewer' WHERE accountId=? AND userId=?").run(f.accountId, principal.user.id);
    expect((await f.tool("set_thread_status", { threadId: thread, status: "closed" })).content[0].text).toContain("Insufficient mailbox role");
  });
});
test("reply hook attributes new mail, resolves references, deduplicates replies and preserves status", async () => {
  const f = await fixture("editor");
  const actor = { userId: principal.user.id, clientId: "web:test" };
  await updateThreadCollabState(f.accountId, thread, { status: "closed" }, actor);
  const message = { messageId: "<sent@example.test>", inReplyTo: "<missing@example.test>", references: [thread] };
  await recordReplySent(f.accountId, message, actor); await recordReplySent(f.accountId, message, actor);
  expect((await getThreadCollabState(f.accountId, thread)).status).toBe("closed");
  expect((await listThreadActivity(f.accountId, thread)).filter(a => a.type === "reply_sent")).toHaveLength(1);
  await recordReplySent(f.accountId, { messageId: "<new@example.test>" }, actor);
  expect(f.db.prepare("SELECT userId FROM sent_by WHERE accountId=? AND messageId=?").get(f.accountId, "<new@example.test>").userId).toBe(principal.user.id);
});
