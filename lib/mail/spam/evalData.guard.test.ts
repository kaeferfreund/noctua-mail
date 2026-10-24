import { expect, test } from "bun:test";
import { assertShardsInsideDataDir } from "./evalData";

test("shards outside the data dir are refused, inside and relative ones pass", () => {
  expect(() => assertShardsInsideDataDir([{ id: "a", dbPath: "/srv/other/db/accounts/a.db" }], "/tmp/copy")).toThrow("outside /tmp/copy");
  expect(() => assertShardsInsideDataDir([{ id: "a", dbPath: "/tmp/copy-live/db/accounts/a.db" }], "/tmp/copy")).toThrow("outside");
  expect(() => assertShardsInsideDataDir([{ id: "a", dbPath: "/tmp/copy/db/accounts/a.db" }, { id: "b", dbPath: "db/accounts/b.db" }, { id: "c", dbPath: null }], "/tmp/copy")).not.toThrow();
});
