import { describe, expect, test } from "bun:test";
import path from "node:path";
import { parseProfileBackfillArgs } from "./profileBackfillArgs";

const data = path.resolve("/srv/noctua-data");

describe("spam-profiles-backfill arguments", () => {
  test("--help wins over everything else, also unknown options", () => {
    expect(parseProfileBackfillArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseProfileBackfillArgs(["--write", "--bogus", "-h"])).toEqual({ kind: "help" });
  });

  test("the default is a dry run; --data is required and never taken from the environment", () => {
    expect(parseProfileBackfillArgs([])).toMatchObject({ kind: "error", message: expect.stringContaining("--data") });
    expect(parseProfileBackfillArgs(["--write"])).toMatchObject({ kind: "error", message: expect.stringContaining("--data") });
    expect(parseProfileBackfillArgs(["--data", data])).toEqual({ kind: "run", write: false, dataDir: data, out: null, account: null });
    expect(parseProfileBackfillArgs(["--data", data, "--dry-run", "--account", "acc-1"])).toMatchObject({ write: false, account: "acc-1" });
  });

  test("writing needs --write together with --data", () => {
    expect(parseProfileBackfillArgs(["--write", "--data", data])).toEqual({ kind: "run", write: true, dataDir: data, out: null, account: null });
    expect(parseProfileBackfillArgs(["--write", "--dry-run", "--data", data])).toMatchObject({ kind: "error" });
  });

  test("unknown options, missing values and --out misuse are errors", () => {
    expect(parseProfileBackfillArgs(["--data", data, "--force"])).toMatchObject({ kind: "error", message: "Unknown option: --force" });
    expect(parseProfileBackfillArgs(["--data"])).toMatchObject({ kind: "error", message: "--data needs a value" });
    expect(parseProfileBackfillArgs(["--data", "--write"])).toMatchObject({ kind: "error", message: "--data needs a value" });
    expect(parseProfileBackfillArgs(["--data", data, "positional"])).toMatchObject({ kind: "error" });
    expect(parseProfileBackfillArgs(["--data", data, "--write", "--out", "/tmp/p.json"])).toMatchObject({ kind: "error" });
    expect(parseProfileBackfillArgs(["--data", data, "--out", path.join(data, "p.json")])).toMatchObject({ kind: "error" });
    expect(parseProfileBackfillArgs(["--data", data, "--out", "/tmp/p.json"])).toMatchObject({ kind: "run", out: path.resolve("/tmp/p.json") });
  });
});
