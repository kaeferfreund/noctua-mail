import path from "path";
import { mkdirSync, promises as fs } from "fs";
import {
  getAttachmentsAccountDir,
  getDefaultAccountDbPath,
  getDataDir,
  getMainDbPath,
  getSourcesAccountDir
} from "../runtimePaths";
import {
  ensureCalendarEventRuntimeData,
  ensureCalendarReminderRuntimeSchema,
  ensureMessageCalendarEventRuntimeSchema,
  ensureThreadRuntimeSchema,
  ensureSenderIdentityMessageRuntimeSchema,
  ensureTopicRuntimeSchema,
  initAccountSchema,
  initMasterSchema
} from "./schema";
import { ensureTopicLearningRuntimeData } from "./topics";
import { withDbWriteRetry } from "../dbWriteRetry";

const sqliteModulePromise = () => import("bun:sqlite" /* webpackIgnore: true */);
let DatabaseCtor: any | null = null;
let startupStoragePathLogged = false;

// Memoized so `getAccountDb` doesn't allocate a new promise + pay the
// await hop on every call. The module itself is cached by the runtime;
// this caches the promise that resolves to it. On rejection the memo
// is cleared so a transient failure (e.g. bundler hiccup) doesn't
// permanently poison every subsequent `getAccountDb` call.
let threadsModulePromise: Promise<typeof import("./threads")> | null = null;
function loadThreadsModule() {
  if (!threadsModulePromise) {
    threadsModulePromise = import("./threads").catch((err) => {
      threadsModulePromise = null;
      throw err;
    });
  }
  return threadsModulePromise;
}

let masterDbInstance: any | null = null;
let masterInitialized = false;
const accountDbInstances = new Map<string, any>();
const accountDbInitialized = new Set<string>();
const accountDbIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ACCOUNT_DB_IDLE_MS = (() => {
  const raw = process.env.ACCOUNT_DB_IDLE_MS?.trim();
  if (!raw) return 5 * 60 * 1000; // 5 minutes: releases SQLite page cache sooner after syncs
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 5 * 60 * 1000;
  return parsed;
})();
let shutdownHooksRegistered = false;

async function ensureDatabaseCtor() {
  if (DatabaseCtor) return;
  try {
    const sqliteModule = await sqliteModulePromise();
    DatabaseCtor = sqliteModule.Database as any;
  } catch {
    throw new Error("bun:sqlite is unavailable in this runtime. Run the app with Bun (not Node).");
  }
}

export function configureDb(db: any, busyTimeoutMs = 15000) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs};`);
  db.exec("PRAGMA foreign_keys = ON;");
}

let authDbInstance: any | null = null;
let connectionGeneration = 0;
export function getDbConnectionGeneration() { return connectionGeneration; }

/** Separate writer: never let Noctua writes join an awaited adapter transaction. */
export async function getAuthDb() {
  await getDb();
  if (!authDbInstance) {
    authDbInstance = new DatabaseCtor(getMainDbPath());
    configureDb(authDbInstance, 0);
  }
  return authDbInstance;
}

function ensureDbParentDir(dbPath: string) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
}

function clearAccountDbIdleTimer(dbPath: string) {
  const timer = accountDbIdleTimers.get(dbPath);
  if (timer) {
    clearTimeout(timer);
    accountDbIdleTimers.delete(dbPath);
  }
}

export function closeAccountDbConnection(dbPath: string) {
  clearAccountDbIdleTimer(dbPath);
  const db = accountDbInstances.get(dbPath);
  if (!db) return;
  try {
    db.close();
  } catch {
    // ignore close failures during shutdown/eviction
  }
  accountDbInstances.delete(dbPath);
  accountDbInitialized.delete(dbPath);
}

async function unlinkIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code !== "ENOENT") {
      console.warn("[account-lifecycle] failed to delete file", { filePath, error });
    }
  }
}

export async function areEquivalentDbPaths(leftPath: string, rightPath: string) {
  try {
    const [leftRealPath, rightRealPath] = await Promise.all([
      fs.realpath(leftPath),
      fs.realpath(rightPath)
    ]);
    return leftRealPath === rightRealPath;
  } catch {
    return leftPath === rightPath;
  }
}

export async function cleanupAccountLifecycleArtifacts(
  accountId: string,
  dbPath: string,
  deleteShardFile: boolean
) {
  await Promise.all([
    fs.rm(getSourcesAccountDir(accountId), { recursive: true, force: true }).catch((error) => {
      console.warn("[account-lifecycle] failed to delete source cache dir", { accountId, error });
    }),
    fs.rm(getAttachmentsAccountDir(accountId), { recursive: true, force: true }).catch((error) => {
      console.warn("[account-lifecycle] failed to delete attachment cache dir", { accountId, error });
    })
  ]);

  if (!deleteShardFile) return;
  await Promise.all([
    unlinkIfExists(dbPath),
    unlinkIfExists(`${dbPath}-wal`),
    unlinkIfExists(`${dbPath}-shm`)
  ]);
}

function scheduleAccountDbIdleClose(dbPath: string) {
  if (ACCOUNT_DB_IDLE_MS <= 0) return;
  clearAccountDbIdleTimer(dbPath);
  const timer = setTimeout(() => {
    closeAccountDbConnection(dbPath);
  }, ACCOUNT_DB_IDLE_MS);
  timer.unref?.();
  accountDbIdleTimers.set(dbPath, timer);
}

export function closeAllDbConnections() {
  connectionGeneration++;
  if (authDbInstance) {
    try { authDbInstance.close(); } catch { /* Already closed during shutdown. */ }
    authDbInstance = null;
  }
  const accountPaths = Array.from(accountDbInstances.keys());
  accountPaths.forEach((dbPath) => closeAccountDbConnection(dbPath));
  if (masterDbInstance) {
    try {
      masterDbInstance.close();
    } catch {
      // ignore close failures during shutdown
    }
    masterDbInstance = null;
    masterInitialized = false;
  }
}

function registerDbShutdownHooks() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;
  process.once("SIGINT", closeAllDbConnections);
  process.once("SIGTERM", closeAllDbConnections);
  process.once("beforeExit", closeAllDbConnections);
}

export async function getDb() {
  registerDbShutdownHooks();
  if (!masterDbInstance) {
    await ensureDatabaseCtor();
    // A concurrent startup may have opened the handle during the import.
    if (masterDbInstance) return masterDbInstance;
    const dbPath = getMainDbPath();
    ensureDbParentDir(dbPath);
    masterDbInstance = new DatabaseCtor(dbPath);
    configureDb(masterDbInstance, 0);
    if (!startupStoragePathLogged) {
      console.info("[startup] opened storage", {
        dataDir: getDataDir(),
        dbPath
      });
      startupStoragePathLogged = true;
    }
  }
  if (!masterInitialized && masterDbInstance) {
    await withDbWriteRetry("initMasterSchema", () => initMasterSchema(masterDbInstance));
    masterInitialized = true;
  }
  return masterDbInstance;
}

export async function initializeMasterDb() {
  await getDb();
}

async function resolveAccountDbPath(accountId: string) {
  const master = await getDb();
  const row = master
    .prepare(`SELECT id, dbPath FROM accounts WHERE id = ?`)
    .get(accountId) as { id?: string; dbPath?: string | null } | undefined;
  const defaultPath = getDefaultAccountDbPath(accountId);
  if (!row?.id) {
    return defaultPath;
  }
  if (row.dbPath && row.dbPath.trim().length > 0) {
    return row.dbPath;
  }
  return withDbWriteRetry("resolveAccountDbPath", () => master.transaction(() => {
    master.prepare(`UPDATE accounts SET dbPath = ? WHERE id = ? AND (dbPath IS NULL OR trim(dbPath) = '')`)
      .run(defaultPath, accountId);
    const current = master.prepare(`SELECT dbPath FROM accounts WHERE id = ?`).get(accountId) as
      { dbPath?: string | null } | undefined;
    return current?.dbPath?.trim() ? current.dbPath : defaultPath;
  }).immediate());
}

export async function getAccountDb(accountId: string) {
  const dbPath = await resolveAccountDbPath(accountId);
  if (!accountDbInstances.has(dbPath)) {
    await ensureDatabaseCtor();
    ensureDbParentDir(dbPath);
    const accountDb = new DatabaseCtor(dbPath);
    configureDb(accountDb);
    accountDbInstances.set(dbPath, accountDb);
  }
  const accountDb = accountDbInstances.get(dbPath)!;
  if (!accountDbInitialized.has(dbPath)) {
    initAccountSchema(accountDb);
    accountDbInitialized.add(dbPath);
  }
  ensureSenderIdentityMessageRuntimeSchema(accountDb);
  ensureThreadRuntimeSchema(accountDb);
  ensureTopicRuntimeSchema(accountDb);
  ensureMessageCalendarEventRuntimeSchema(accountDb);
  ensureCalendarReminderRuntimeSchema(accountDb);
  await ensureCalendarEventRuntimeData(accountDb, accountId);
  // `./threads` imports `./accounts`, which imports this module, so its
  // runtime-data ensure has to be loaded via a deferred import to break
  // the load-time cycle. `./topics` has no such dependency and is
  // imported statically at the top.
  const threadsModule = await loadThreadsModule();
  await threadsModule.ensureThreadSignalRuntimeData(accountDb, accountId);
  await threadsModule.ensureThreadLatestReceivedDateValues(accountDb, accountId);
  ensureTopicLearningRuntimeData(accountDb, accountId);
  scheduleAccountDbIdleClose(dbPath);
  return accountDb;
}

export async function withAccountDb<T>(accountId: string, fn: (db: any) => T | Promise<T>): Promise<T> {
  const db = await getAccountDb(accountId);
  return fn(db);
}
