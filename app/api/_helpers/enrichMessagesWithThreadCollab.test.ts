import { expect, test } from "bun:test";
import { enrichMessagesWithThreadCollab } from "./enrichMessagesWithThreadCollab";
import { getThreadCollabState } from "@/lib/threadCollab";
import { createCollabFixture } from "@/lib/testThreadCollabHarness";
test("collab enrichment batches unique threads, mutates payloads and isolates accounts", async () => {
  const f = await createCollabFixture();
  const items = [f.message("one"), f.message("one"), f.message("two"), f.message("one", { accountId: "different-account" })];
  const calls: string[][] = [];
  await enrichMessagesWithThreadCollab(items, {
    accountId: f.accountId, loadThreadCollabStates: async (accountId, ids) => {
      expect(accountId).toBe(f.accountId);
      calls.push(ids);
      return new Map([["one", { ...await getThreadCollabState(accountId, "one"), status: "waiting", assigneeUserId: "synthetic", commentCount: 3, updatedAt: 100 }]]);
    }
  });
  expect(calls).toEqual([["one", "two"]]);
  expect(items[0].collab).toEqual({ status: "waiting", assigneeUserId: "synthetic", commentCount: 3, updatedAt: 100 });
  expect(items[1].collab).toEqual(items[0].collab);
  expect(items[2].collab).toEqual({ status: "open", assigneeUserId: null, commentCount: 0, updatedAt: 0 });
  expect(items[3].collab).toBeUndefined();
  await enrichMessagesWithThreadCollab([], { accountId: f.accountId, loadThreadCollabStates: async () => { throw new Error("must not load"); } });
});
