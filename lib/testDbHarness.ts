import { mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

type SharedDbHarnessState = {
  dataDir: string;
  previousDataDir?: string;
  previousIdleMs?: string;
};

const GLOBAL_KEY = "__mywebmailSharedDbHarness";
const DATA_DIR_PREFIX = "mywebmail-test-db-";
const DATA_DIR_OWNER = new RegExp(`^${DATA_DIR_PREFIX}(\\d+)-`);

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Bun's test runner never emits process "exit" (serial or --isolate/--parallel),
// and a file-level afterAll fires before --rerun-each repeats of the same global
// are done, so no hook can safely remove a data dir at the end of its own run.
// Each dir carries its creator's pid instead, and a new harness removes the dirs
// whose creator has finished: an earlier isolated global of this process, or a
// process that no longer exists. At most one dir per test process outlives a run.
function removeFinishedDataDirs(root: string) {
  for (const name of readdirSync(root)) {
    const owner = Number(DATA_DIR_OWNER.exec(name)?.[1]);
    if (!owner || (owner !== process.pid && isProcessAlive(owner))) continue;
    try {
      rmSync(path.join(root, name), { recursive: true, force: true });
    } catch {
      // Another user's dir in a shared tmp: not ours to remove.
    }
  }
}

function getSharedDbHarnessState(): SharedDbHarnessState {
  const globalWithHarness = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: SharedDbHarnessState;
  };
  const existing = globalWithHarness[GLOBAL_KEY];
  if (existing) {
    process.env.NOCTUA_DATA_DIR = existing.dataDir;
    process.env.ACCOUNT_DB_IDLE_MS = "0";
    return existing;
  }

  removeFinishedDataDirs(tmpdir());
  const dataDir = mkdtempSync(path.join(tmpdir(), `${DATA_DIR_PREFIX}${process.pid}-`));
  const state: SharedDbHarnessState = {
    dataDir,
    previousDataDir: process.env.NOCTUA_DATA_DIR,
    previousIdleMs: process.env.ACCOUNT_DB_IDLE_MS
  };
  process.env.NOCTUA_DATA_DIR = dataDir;
  process.env.ACCOUNT_DB_IDLE_MS = "0";
  process.once("exit", () => {
    if (state.previousDataDir === undefined) {
      delete process.env.NOCTUA_DATA_DIR;
    } else {
      process.env.NOCTUA_DATA_DIR = state.previousDataDir;
    }
    if (state.previousIdleMs === undefined) {
      delete process.env.ACCOUNT_DB_IDLE_MS;
    } else {
      process.env.ACCOUNT_DB_IDLE_MS = state.previousIdleMs;
    }
    rmSync(dataDir, { recursive: true, force: true });
  });
  globalWithHarness[GLOBAL_KEY] = state;
  return state;
}

getSharedDbHarnessState();

// Use a dedicated module specifier so Bun's global mock.module("@/lib/db", ...)
// hooks in unrelated test files cannot replace the harness db module during
// parallel test-file loading.
const DB_HARNESS_SPECIFIER = "./db.ts?test-harness";

export const dbModulePromise: Promise<typeof import("./db")> = import(DB_HARNESS_SPECIFIER);
