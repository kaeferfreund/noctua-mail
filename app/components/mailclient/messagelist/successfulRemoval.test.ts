import { expect, test } from "bun:test";
import type { Message } from "@/lib/data";
import { nextMessageAfterRemoval } from "./successfulRemoval";
const rows = ["third", "first", "second"].map(id => ({ id }) as Message);
test("removal follows rendered order with previous and exhausted fallbacks", () => {
  expect(nextMessageAfterRemoval(rows, new Set(["first"]))?.id).toBe("second");
  expect(nextMessageAfterRemoval(rows, new Set(["second"]))?.id).toBe("first");
  expect(nextMessageAfterRemoval(rows, new Set(["first", "second"]))?.id).toBe("third");
  expect(nextMessageAfterRemoval(rows, new Set(rows.map(row => row.id)))).toBeNull();
  expect(nextMessageAfterRemoval(rows, new Set(["absent"]))).toBeNull();
});
