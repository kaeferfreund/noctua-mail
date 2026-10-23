import { expect, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import { closeAccountDbConnection, getAccountDb, getDb } from "./connection";
import { getDefaultAccountDbPath } from "../runtimePaths";
import { recomputeCategoriesForAccount } from "./categories";
import { createTopic, setThreadTopics } from "../topics/core";

test("topic assignment and metadata-only category fallback survive shard reopen and isolate shared accounts", async () => {
  const f = await createCollabFixture();
  const other = await createCollabFixture();
  (await getDb()).prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(f.accountId), other.accountId);
  await getAccountDb(other.accountId);
  for (const fixture of [f, other]) {
    await fixture.api.upsertMessages(fixture.accountId, fixture.folderId, ["one", "two"].map((threadId, index) => fixture.message(threadId, {
      id: `local-${index}`, messageId: `<local-${index}@example.test>`,
      subject: "Invoice", hasSource: false,
      attachments: [{ id: "attachment", filename: "invoice_987654321.pdf", contentType: "application/pdf", size: 10, inline: false, url: "" }]
    })));
  }
  const topics = await Promise.all(["Alpha", "Beta", "Gamma"].map(name => createTopic(f.accountId, name, null)));
  const ids = topics.map(topic => topic.id);
  const assigned = await setThreadTopics(f.accountId, "one", [ids[0], ids[1], ids[0], " "]);
  expect(assigned.map(topic => topic.name)).toEqual(["Alpha", "Beta"]);
  await recomputeCategoriesForAccount(f.accountId);
  const categories = f.db.prepare("SELECT id,category,categoryScore,categorySignals FROM messages WHERE accountId=? ORDER BY id").all(f.accountId);
  expect(categories).toHaveLength(2);
  expect(categories.every((row: { category: string | null }) => row.category !== null)).toBe(true);
  const otherMessages = f.db.prepare("SELECT * FROM messages WHERE accountId=? ORDER BY id").all(other.accountId);
  const learning = f.db.prepare("SELECT threadId,topicId,signalType,signalValue FROM topic_learning_signals WHERE accountId=? ORDER BY topicId,signalType,signalValue").all(f.accountId);
  expect(learning.length).toBeGreaterThan(0);
  closeAccountDbConnection(getDefaultAccountDbPath(f.accountId));
  const reopened = await getAccountDb(f.accountId);
  expect(reopened).not.toBe(f.db);
  expect((await setThreadTopics(f.accountId, "one", [ids[1], ids[2]])).map(topic => topic.name)).toEqual(["Beta", "Gamma"]);
  expect((await setThreadTopics(f.accountId, "one", ids.slice(0, 2))).map(topic => topic.name)).toEqual(["Alpha", "Beta"]);
  expect(reopened.prepare("SELECT threadId,topicId,signalType,signalValue FROM topic_learning_signals WHERE accountId=? ORDER BY topicId,signalType,signalValue").all(f.accountId)).toEqual(learning);
  await recomputeCategoriesForAccount(f.accountId);
  expect(reopened.prepare("SELECT id,category,categoryScore,categorySignals FROM messages WHERE accountId=? ORDER BY id").all(f.accountId)).toEqual(categories);
  expect(reopened.prepare("SELECT * FROM messages WHERE accountId=? ORDER BY id").all(other.accountId)).toEqual(otherMessages);
  expect(reopened.prepare("SELECT * FROM thread_topics WHERE accountId=?").all(other.accountId)).toEqual([]);
  expect(await setThreadTopics(f.accountId, "one", [])).toEqual([]);
  expect(reopened.prepare("SELECT * FROM topic_learning_signals WHERE accountId=?").all(f.accountId)).toEqual([]);
});
