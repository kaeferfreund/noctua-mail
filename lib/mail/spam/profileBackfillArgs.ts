import path from "node:path";

/** Command line of scripts/spam-profiles-backfill.ts: dry run unless `--write`, data dir only from `--data`. */
export const PROFILE_BACKFILL_USAGE = `Usage: bun scripts/spam-profiles-backfill.ts --data <data dir> [--account <accountId>] [--out <profiles.json>]
       bun scripts/spam-profiles-backfill.ts --data <data dir> --write [--account <accountId>]

Builds the trusted-sender profiles from the stored rows of every account.
Default is a dry run: the data dir is opened read-only (mode=ro) and the
plan is printed; --out writes the sender histories for spam-eval --trust-profiles
(outside the data dir). --write replaces the stored profiles; it needs an
explicit --data (NOCTUA_DATA_DIR from the environment is never used) and shards
that already have the spam schema (the deployed app creates it).`;

export type ProfileBackfillArgs =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "run"; write: boolean; dataDir: string; out: string | null; account: string | null };

const VALUE_OPTIONS = new Set(["--data", "--out", "--account"]);
const FLAGS = new Set(["--write", "--dry-run"]);

export function parseProfileBackfillArgs(argv: readonly string[]): ProfileBackfillArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help" };
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (FLAGS.has(option)) {
      flags.add(option);
    } else if (VALUE_OPTIONS.has(option)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { kind: "error", message: `${option} needs a value` };
      values.set(option, value);
      index += 1;
    } else {
      return { kind: "error", message: `Unknown option: ${option}` };
    }
  }
  const write = flags.has("--write");
  if (write && flags.has("--dry-run")) return { kind: "error", message: "--write and --dry-run exclude each other" };
  const data = values.get("--data");
  if (!data) return { kind: "error", message: "Pass --data <data dir> (the environment's NOCTUA_DATA_DIR is never used)" };
  const dataDir = path.resolve(data);
  const out = values.has("--out") ? path.resolve(values.get("--out")!) : null;
  if (out && write) return { kind: "error", message: "--out is only available in the dry run" };
  if (out && !path.relative(dataDir, out).startsWith("..")) return { kind: "error", message: "--out must not point into the data dir" };
  return { kind: "run", write, dataDir, out, account: values.get("--account") ?? null };
}
