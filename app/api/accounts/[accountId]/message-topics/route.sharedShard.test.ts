import { describe, expect, test } from "bun:test";
import { createSharedShardFixture } from "@/lib/testSharedShardHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { createTopic, getTopicsForThread, getTopicsForThreads, setThreadTopics } from "@/lib/topics";
import { POST } from "./route";

const origin = "http://localhost:3000";
const thread = "<topics-shared@example.test>";

async function fixture() {
  const pair = await createSharedShardFixture();
  const { a, b } = pair;
  await a.seed(a.message(thread));
  await b.seed(b.message(thread));
  const foreignTopic = await createTopic(b.accountId, "Private project B", "red");
  const ownTopic = await createTopic(a.accountId, "Own topic", "blue");
  const user = await createAuthenticatedTestSession();
  await user.addMembership(user.user.id, a.accountId, "editor");
  const post = (body: Record<string, unknown>) => POST(new Request(`${origin}/api/accounts/${a.accountId}/message-topics`, {
    method: "POST",
    headers: user.jar.headers({ origin, "content-type": "application/json" }),
    body: JSON.stringify({ threadId: thread, ...body })
  }), { params: Promise.resolve({ accountId: a.accountId }) });
  return { ...pair, foreignTopic, ownTopic, post };
}

describe("topic assignments in a shared shard", () => {
  test("a topic id of another mailbox cannot be assigned or read back", async () => {
    const { a, db, foreignTopic, ownTopic, post } = await fixture();
    const set = await post({ action: "set", topicIds: [foreignTopic.id, ownTopic.id] });
    expect(set.status).toBe(200);
    const text = await set.text();
    expect(text).not.toContain(foreignTopic.name);
    expect((JSON.parse(text) as { topics: Array<{ id: string }> }).topics.map(topic => topic.id)).toEqual([ownTopic.id]);
    expect((await post({ action: "add", topicId: foreignTopic.id })).status).toBe(404);
    expect(db.prepare("SELECT topicId FROM thread_topics WHERE accountId = ?").all(a.accountId)).toEqual([{ topicId: ownTopic.id }]);
  });

  test("reads join topics only within the mailbox even for stray rows", async () => {
    const { a, b, db, foreignTopic } = await fixture();
    // A row written before the fix (or by a direct write) must not expose B's topic.
    db.prepare("INSERT INTO thread_topics(threadId, topicId, accountId, assignedAt) VALUES (?, ?, ?, ?)")
      .run(thread, foreignTopic.id, a.accountId, 1);
    expect(await getTopicsForThread(a.accountId, thread)).toEqual([]);
    expect((await getTopicsForThreads(a.accountId, [thread])).get(thread)).toBeUndefined();
    expect(await setThreadTopics(a.accountId, thread, [])).toEqual([]);
    // B's own assignment keeps working.
    expect((await setThreadTopics(b.accountId, thread, [foreignTopic.id])).map(topic => topic.id)).toEqual([foreignTopic.id]);
  });
});
