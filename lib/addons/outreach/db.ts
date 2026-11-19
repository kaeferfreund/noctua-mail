import path from "path";
import { existsSync, mkdirSync } from "fs";
import type { Database } from "bun:sqlite";
import { getDataDir } from "@/lib/runtimePaths";
import { onShutdown } from "@/lib/server/shutdown";

/**
 * The addon keeps ALL of its data in one SQLite file of its own. It never adds a table or a
 * column to `db/main.db` or to an account shard, so the mail storage needs no migration for
 * it and removing the addon is: flag off, delete this file.
 */
export function getOutreachDbPath() {
  return path.join(getDataDir(), "db", "addons", "outreach.db");
}

/** The addon was used on this installation: its database file is there (also while the flag is off). */
export function outreachDbExists() {
  return existsSync(getOutreachDbPath());
}

/** Bump with every schema change and add the step to `migrate`. */
export const OUTREACH_SCHEMA_VERSION = 4;

/**
 * Schema v1. Every table carries `accountId` (the mailbox that owns the row); every query
 * must filter by it. Times are epoch milliseconds. JSON columns hold arrays/objects as text.
 * Tasks may add indexes in their own migration step, but a column or table change needs a
 * new schema version.
 */
const SCHEMA_V1 = `
  -- Per-mailbox activation and defaults. No row = addon not activated for the mailbox.
  CREATE TABLE IF NOT EXISTS account_settings (
    accountId TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    -- 'ses' | 'mailbox-smtp': transport for campaign and sequence mails (1:1 mail always uses the mailbox SMTP)
    transport TEXT NOT NULL DEFAULT 'ses',
    senderIdentityId TEXT,
    -- 1:1 mails: is the tracking switch in compose preselected?
    trackMailDefault INTEGER NOT NULL DEFAULT 0,
    ipRetentionDays INTEGER NOT NULL DEFAULT 90,
    sendRatePerMinute INTEGER NOT NULL DEFAULT 30,
    organizationName TEXT NOT NULL DEFAULT '',
    organizationAddress TEXT NOT NULL DEFAULT '',
    updatedAt INTEGER NOT NULL,
    updatedByUserId TEXT
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    email TEXT NOT NULL,
    emailLower TEXT NOT NULL,
    firstName TEXT NOT NULL DEFAULT '',
    lastName TEXT NOT NULL DEFAULT '',
    properties TEXT NOT NULL DEFAULT '{}',
    -- 'subscribed' | 'unsubscribed' | 'never': marketing consent for e-mail
    emailConsent TEXT NOT NULL DEFAULT 'never',
    consentAt INTEGER,
    consentSource TEXT,
    -- NULL | 'hard_bounce' | 'complaint' | 'manual': never mailed while set
    suppressedReason TEXT,
    suppressedAt INTEGER,
    source TEXT NOT NULL DEFAULT 'manual',
    externalId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE (accountId, emailLower)
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_account_external ON contacts (accountId, externalId);

  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    -- 'single' | 'double'
    optIn TEXT NOT NULL DEFAULT 'single',
    externalId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    archivedAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_lists_account ON lists (accountId, archivedAt);

  CREATE TABLE IF NOT EXISTS list_members (
    listId TEXT NOT NULL,
    contactId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    -- 'subscribed' | 'pending' (double opt-in not confirmed) | 'unsubscribed'
    status TEXT NOT NULL,
    subscribedAt INTEGER,
    unsubscribedAt INTEGER,
    source TEXT NOT NULL DEFAULT 'manual',
    PRIMARY KEY (listId, contactId)
  );
  CREATE INDEX IF NOT EXISTS idx_list_members_contact ON list_members (accountId, contactId);

  -- Bearer tokens for the server-to-server subscribe API (only the SHA-256 is stored).
  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    name TEXT NOT NULL,
    tokenHash TEXT NOT NULL UNIQUE,
    listIds TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL,
    createdByUserId TEXT NOT NULL,
    lastUsedAt INTEGER,
    revokedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    previewText TEXT NOT NULL DEFAULT '',
    html TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    externalId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    updatedByUserId TEXT,
    archivedAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_templates_account ON templates (accountId, archivedAt);

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    previewText TEXT NOT NULL DEFAULT '',
    senderIdentityId TEXT,
    templateId TEXT,
    html TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    listIds TEXT NOT NULL DEFAULT '[]',
    excludedListIds TEXT NOT NULL DEFAULT '[]',
    -- 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed'
    status TEXT NOT NULL DEFAULT 'draft',
    trackOpens INTEGER NOT NULL DEFAULT 1,
    trackClicks INTEGER NOT NULL DEFAULT 1,
    sendAt INTEGER,
    startedAt INTEGER,
    finishedAt INTEGER,
    createdByUserId TEXT,
    scheduledByUserId TEXT,
    externalId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns (accountId, status);
  CREATE INDEX IF NOT EXISTS idx_campaigns_due ON campaigns (status, sendAt);

  CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    name TEXT NOT NULL,
    triggerListId TEXT,
    senderIdentityId TEXT,
    -- 'draft' | 'live' | 'paused'
    status TEXT NOT NULL DEFAULT 'draft',
    trackOpens INTEGER NOT NULL DEFAULT 1,
    trackClicks INTEGER NOT NULL DEFAULT 1,
    statusChangedByUserId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sequences_trigger ON sequences (accountId, triggerListId, status);

  CREATE TABLE IF NOT EXISTS sequence_steps (
    id TEXT PRIMARY KEY,
    sequenceId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    position INTEGER NOT NULL,
    -- Wait after the previous step (after enrollment for the first step).
    delayMinutes INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    previewText TEXT NOT NULL DEFAULT '',
    templateId TEXT,
    html TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    UNIQUE (sequenceId, position)
  );

  CREATE TABLE IF NOT EXISTS sequence_enrollments (
    id TEXT PRIMARY KEY,
    sequenceId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    contactId TEXT NOT NULL,
    -- 'active' | 'completed' | 'cancelled'
    status TEXT NOT NULL DEFAULT 'active',
    nextStepPosition INTEGER,
    nextSendAt INTEGER,
    enrolledAt INTEGER NOT NULL,
    finishedAt INTEGER,
    UNIQUE (sequenceId, contactId)
  );
  CREATE INDEX IF NOT EXISTS idx_enrollments_due ON sequence_enrollments (status, nextSendAt);

  -- One row per tracked outgoing mail: per recipient for campaigns/sequences, per message for 1:1 mail.
  CREATE TABLE IF NOT EXISTS sends (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    -- 'mail' | 'campaign' | 'sequence' | 'test'
    kind TEXT NOT NULL,
    campaignId TEXT,
    sequenceId TEXT,
    sequenceStepId TEXT,
    contactId TEXT,
    -- kind 'mail': all To/Cc/Bcc addresses joined with ', '; otherwise the one recipient
    recipients TEXT NOT NULL DEFAULT '',
    -- RFC 5322 Message-ID including angle brackets
    messageId TEXT,
    providerMessageId TEXT,
    subject TEXT NOT NULL DEFAULT '',
    -- 'queued' | 'sending' | 'sent' | 'failed' | 'skipped'
    status TEXT NOT NULL,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    claimOwner TEXT,
    claimedAt INTEGER,
    trackOpens INTEGER NOT NULL DEFAULT 1,
    trackClicks INTEGER NOT NULL DEFAULT 1,
    userId TEXT,
    sendAt INTEGER,
    queuedAt INTEGER NOT NULL,
    sentAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sends_message ON sends (accountId, messageId);
  CREATE INDEX IF NOT EXISTS idx_sends_due ON sends (status, sendAt);
  CREATE INDEX IF NOT EXISTS idx_sends_campaign ON sends (campaignId, status);
  CREATE INDEX IF NOT EXISTS idx_sends_contact ON sends (accountId, contactId, queuedAt);
  CREATE INDEX IF NOT EXISTS idx_sends_provider ON sends (providerMessageId);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sends_campaign_contact ON sends (campaignId, contactId) WHERE campaignId IS NOT NULL AND kind = 'campaign';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sends_step_contact ON sends (sequenceStepId, contactId) WHERE sequenceStepId IS NOT NULL AND kind = 'sequence';

  -- Opaque public tokens of /t/o, /t/c and /t/u. The click target lives here, never in the URL.
  CREATE TABLE IF NOT EXISTS tracking_links (
    token TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    sendId TEXT NOT NULL,
    -- 'open' | 'click' | 'unsubscribe'
    kind TEXT NOT NULL,
    url TEXT,
    contactId TEXT,
    listId TEXT,
    createdAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tracking_links_send ON tracking_links (sendId);

  CREATE TABLE IF NOT EXISTS tracking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId TEXT NOT NULL,
    sendId TEXT,
    contactId TEXT,
    -- 'open' | 'click' | 'unsubscribe' | 'delivered' | 'bounce' | 'complaint'
    type TEXT NOT NULL,
    at INTEGER NOT NULL,
    ip TEXT,
    ipTruncated INTEGER NOT NULL DEFAULT 0,
    country TEXT,
    region TEXT,
    city TEXT,
    userAgent TEXT,
    clientName TEXT,
    clientOs TEXT,
    -- 'browser' | 'mobile' | 'mail-client' | 'proxy' | 'bot' | 'unknown'
    clientType TEXT,
    -- 1 = automatic fetch (Apple Mail Privacy Protection, image proxy, link scanner), not a person
    machine INTEGER NOT NULL DEFAULT 0,
    url TEXT,
    detail TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_send ON tracking_events (sendId, at);
  CREATE INDEX IF NOT EXISTS idx_events_contact ON tracking_events (accountId, contactId, at);
  CREATE INDEX IF NOT EXISTS idx_events_account ON tracking_events (accountId, at);
  CREATE INDEX IF NOT EXISTS idx_events_retention ON tracking_events (ipTruncated, at);
`;

/**
 * Schema v2 (consent bookkeeping that must survive a re-subscription and an erase).
 * `contacts.unsubscribedAt`: the newest global unsubscribe; a later consent for one list
 * does not clear it, so an older consent for another list can never be applied afterwards.
 * `erased_addresses`: what remains of an erased contact — a SHA-256 of the lower-cased address
 * and the dates, nothing else. Every erase writes it; the erase counts as an unsubscribe at its
 * time. A contact created later for the same address takes the block over.
 */
const SCHEMA_V2 = `
  ALTER TABLE contacts ADD COLUMN unsubscribedAt INTEGER;
  UPDATE contacts SET unsubscribedAt = consentAt WHERE emailConsent = 'unsubscribed';
  CREATE TABLE IF NOT EXISTS erased_addresses (
    accountId TEXT NOT NULL,
    emailHash TEXT NOT NULL,
    suppressedReason TEXT,
    suppressedAt INTEGER,
    unsubscribedAt INTEGER,
    erasedAt INTEGER NOT NULL,
    PRIMARY KEY (accountId, emailHash)
  );
`;

const SCHEMA_V3 = `
  ALTER TABLE tracking_events ADD COLUMN linkToken TEXT;
`;

/**
 * Schema v4: how a campaign was scheduled and how a sequence's status was last changed —
 * `'app'` or `'mcp:<label> (…<suffix>)'` (see `../via.ts`), a snapshot of the MCP token at that
 * moment. NULL for rows from before this version.
 */
const SCHEMA_V4 = `
  ALTER TABLE campaigns ADD COLUMN scheduledVia TEXT;
  ALTER TABLE sequences ADD COLUMN statusChangedVia TEXT;
`;

function schemaVersion(db: Database) {
  const current = Number((db.prepare("PRAGMA user_version").get() as { user_version?: number } | null)?.user_version ?? 0);
  if (current > OUTREACH_SCHEMA_VERSION) {
    throw new Error(`outreach.db has schema version ${current}; this build supports up to ${OUTREACH_SCHEMA_VERSION}`);
  }
  return current;
}

function migrate(db: Database) {
  if (schemaVersion(db) === OUTREACH_SCHEMA_VERSION) return;
  db.transaction(() => {
    // Read again under the write lock: another process may have migrated the file meanwhile.
    const current = schemaVersion(db);
    if (current === OUTREACH_SCHEMA_VERSION) return;
    if (current < 1) db.exec(SCHEMA_V1);
    if (current < 2) db.exec(SCHEMA_V2);
    if (current < 3) db.exec(SCHEMA_V3);
    if (current < 4) db.exec(SCHEMA_V4);
    db.exec(`PRAGMA user_version = ${OUTREACH_SCHEMA_VERSION}`);
  }).immediate();
}

const key = Symbol.for("noctua.outreachDb");
const openingKey = Symbol.for("noctua.outreachDb.opening");
type Opening = { path: string; promise: Promise<Database> };
const host = globalThis as typeof globalThis & { [key]?: { path: string; db: Database }; [openingKey]?: Opening };
let shutdownHookRegistered = false;

/** Test seam: open the addon schema on any handle (for example `new Database(":memory:")`). */
export function initOutreachSchema(db: Database) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 15000;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

/**
 * The process-wide handle of the addon database. bun:sqlite is synchronous, so a
 * `db.transaction(...)` here never interleaves with another request of this process.
 * Only the server process (and operator scripts) opens this file; sync workers never do.
 */
export async function getOutreachDb(): Promise<Database> {
  const dbPath = getOutreachDbPath();
  const open = host[key];
  if (open && open.path === dbPath) return open.db;
  // Concurrent first calls share one opening, so they get one handle.
  const opening = host[openingKey];
  if (opening && opening.path === dbPath) return opening.promise;
  if (open || opening) closeOutreachDb();
  const pending = { path: dbPath } as Opening;
  pending.promise = openOutreachDb(pending);
  host[openingKey] = pending;
  return pending.promise;
}

async function openOutreachDb(pending: Opening): Promise<Database> {
  const dbPath = pending.path;
  try {
    const { Database: DatabaseCtor } = await import("bun:sqlite" /* webpackIgnore: true */);
    mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = initOutreachSchema(new DatabaseCtor(dbPath));
    if (host[openingKey] !== pending) {
      // Closed (or the path changed) while opening: hand out the current handle instead.
      db.close();
      return getOutreachDb();
    }
    host[key] = { path: dbPath, db };
    if (!shutdownHookRegistered) {
      shutdownHookRegistered = true;
      onShutdown("outreach:db", "close", () => closeOutreachDb());
    }
    return db;
  } finally {
    if (host[openingKey] === pending) host[openingKey] = undefined;
  }
}

export function closeOutreachDb() {
  host[openingKey] = undefined;
  const open = host[key];
  if (!open) return;
  host[key] = undefined;
  try { open.db.close(); } catch { /* Already closed during shutdown. */ }
}
