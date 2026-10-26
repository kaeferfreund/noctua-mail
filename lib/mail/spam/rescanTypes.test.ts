import { expect, test } from "bun:test";
import { spamRescanSince } from "./rescanTypes";

test("rescan periods start at the local day boundary and twelve months include leap day", () => {
  expect(spamRescanSince("12m", new Date(2024, 2, 1, 15, 30).getTime())).toBe(new Date(2023, 2, 1).getTime());
  expect(spamRescanSince("12m", new Date(2024, 1, 29, 18).getTime())).toBe(new Date(2023, 1, 28).getTime());
  expect(spamRescanSince("30d", new Date(2024, 3, 15, 15).getTime())).toBe(new Date(2024, 2, 16).getTime());
  expect(spamRescanSince("all")).toBeNull();
});
