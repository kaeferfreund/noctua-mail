import { beforeAll, expect, test } from "bun:test";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { createCollabFixture } from "./testThreadCollabHarness";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken } from "./mcpAuth";
import { executeMcpHttpRequest } from "./mcpServer";
import { getUserMailboxSummary } from "./mailboxSummary";
import { updateThreadCollabState } from "./threadCollab";
import { appDeepLink } from "./navigation/deepLinks";

let principal: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
beforeAll(async () => { principal = await createAuthenticatedTestSession(); });
test("list_mailbox_summary reads canonical viewer counts, narrows to token scope and rechecks revocation", async () => {
  const f = await createCollabFixture(), other = await createCollabFixture();
  await principal.addMembership(principal.user.id, f.accountId, "editor");
  await principal.addMembership(principal.user.id, other.accountId, "manager");
  const identity = await requireActiveUserSession(new Request("http://localhost:3812", { headers: principal.jar.headers() }));
  if (identity instanceof Response) throw new Error("Missing synthetic session");
  const { tokenRecord } = await mintMcpToken(identity, f.accountId, "Synthetic summary token", 3600);
  await f.seed(f.message("mine"), f.message("waiting"), f.message("closed"));
  const actor = { userId: principal.user.id, clientId: "web:synthetic" };
  await updateThreadCollabState(f.accountId, "mine", { assigneeUserId: principal.user.id }, actor);
  await updateThreadCollabState(f.accountId, "waiting", { status: "waiting" }, actor);
  await updateThreadCollabState(f.accountId, "closed", { status: "closed" }, actor);
  principal.master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(principal.user.id, f.accountId);
  const invoke = async () => {
    const response = await executeMcpHttpRequest({
      body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_mailbox_summary", arguments: {} } },
      accountId: f.accountId, account: f.account, tokenRecord,
      authInfo: { token: "synthetic", clientId: "synthetic", scopes: [], extra: { userId: "untrusted-synthetic-identity" } }
    });
    return (response.responses[0] as unknown as { result: { isError?: boolean; structuredContent: Awaited<ReturnType<typeof getUserMailboxSummary>> } }).result;
  };
  const result = await invoke();
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent.mailboxes).toEqual((await getUserMailboxSummary(principal.user.id, [f.accountId])).mailboxes
    .map(mailbox => ({ ...mailbox, url: appDeepLink({ accountId: mailbox.accountId }, "http://localhost:3000") })));
  expect(result.structuredContent.mailboxes).toHaveLength(1);
  expect(result.structuredContent.mailboxes[0]).toMatchObject({ accountId: f.accountId, accessRole: "viewer", unread: null, assignedToMe: 1, unassignedOpen: 1 });
  principal.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(principal.user.id, f.accountId);
  expect((await invoke()).isError).toBe(true);
});
