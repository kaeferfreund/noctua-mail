import { describe, expect, test } from "bun:test";
import { createCollabFixture } from "../../testThreadCollabHarness";
import * as collab from "../threadCollab";

const actor = { userId: "synthetic-author", clientId: "web:test" };
const root = "<stranded-root@example.test>", middle = "<stranded-middle@example.test>", reply = "<stranded-reply@example.test>";

describe("stranded reply threads", () => {
  test("an arriving ancestor absorbs the thread named after it, with its collaboration state", async () => {
    const f = await createCollabFixture();
    // Synced first: the reply only knows its missing parent, so its thread is named after it.
    const [late] = await f.seed(f.message(middle, { messageId: reply, inReplyTo: middle, references: [root, middle], dateValue: 1767225603000 }));
    f.db.transaction(() => {
      collab.addThreadComment(f.db, f.accountId, middle, "Comment on the stranded reply", actor, 100);
    }).immediate();
    await f.seed(
      f.message(root, { dateValue: 1767225601000 }),
      f.message(root, { messageId: middle, inReplyTo: root, references: [root], dateValue: 1767225602000 })
    );
    const rows = f.db.prepare("SELECT id, messageId, threadId, parentId FROM messages WHERE accountId=? ORDER BY dateValue")
      .all(f.accountId) as Array<{ id: string; messageId: string; threadId: string; parentId: string | null }>;
    expect(rows.map(row => row.threadId)).toEqual([root, root, root]);
    expect(rows.find(row => row.id === late.id)?.parentId).toBe(rows[1].id);
    expect(collab.listThreadComments(f.db, f.accountId, root).map(comment => comment.body)).toEqual(["Comment on the stranded reply"]);
    expect(collab.listThreadComments(f.db, f.accountId, middle)).toEqual([]);
  });

  test("a root, or a reply nobody waits for, leaves other threads alone", async () => {
    const f = await createCollabFixture();
    const other = f.message("<other@example.test>");
    await f.seed(other, f.message(root));
    await f.seed(f.message(root, { messageId: middle, inReplyTo: root, references: [root], dateValue: 1767225602000 }));
    const threads = f.db.prepare("SELECT messageId, threadId FROM messages WHERE accountId=? ORDER BY messageId").all(f.accountId);
    expect(threads).toEqual([
      { messageId: "<other@example.test>", threadId: "<other@example.test>" },
      { messageId: middle, threadId: root },
      { messageId: root, threadId: root }
    ]);
  });
});
