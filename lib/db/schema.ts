import { ACCOUNT_KEY_TABLE_SQL, ensureAccountKeySchema } from "./accountKeys";
import { assertCompleteShardFormat, assertSupportedShardFormat, installShardWriterGuards, prepareAccountShardConnection, SHARD_FORMAT_VERSION } from "./shardFormat";
import { ownAddressList, type OwnAddressInput } from "../ownAddresses";
import { seedSenderIdentityRow } from "./senderIdentities";
import { randomUUID } from "crypto";
import type { InviteCode } from "../data";
import {
  collectCalendarInviteMutationGroups
} from "../calendarInviteProcessing";
import {
  extractEmailCalendarEventStatusFromIcs,
  normalizeCalendarEventStatus
} from "../calendarEventStatus";
import {
  mergeCalendarParticipation,
  normalizeCalendarParticipationStatus,
  resolveCalendarParticipationFromPreview
} from "../calendarParticipation";
import { normalizeCalendarEventUidKey } from "../calendarEventUids";
import { mapInviteRow } from "./rowParsers";

// WeakMap trackers + string signatures used to gate idempotent runtime
// schema / data ensures. Each DB connection is tracked once per process.
const calendarReminderSchemaSignatureByDb = new WeakMap<object, string>();
const messageCalendarEventSchemaSignatureByDb = new WeakMap<object, string>();
const threadSchemaSignatureByDb = new WeakMap<object, string>();
// Keyed on (db, accountId) so a shard shared by multiple accounts still
// back-fills each one separately. Under today's one-dbPath-per-account
// deployment the inner map has exactly one entry; this is defense in depth
// against future multi-account shards.
const calendarEventRuntimeSignatureByDb = new WeakMap<object, Map<string, string>>();
const topicSchemaSignatureByDb = new WeakMap<object, string>();

const CALENDAR_REMINDER_SCHEMA_SIGNATURE = [
  "eventEndAtMs",
  "eventDescription",
  "eventUidKey"
].join("|");
const MESSAGE_CALENDAR_EVENT_SCHEMA_SIGNATURE = [
  "eventUidKey",
  "eventFirstStartAtMs",
  "eventLastEndAtMs",
  "inviteActionType",
  "processedAtMs",
  "processedByUserId",
  "processedAutomatically",
  "unprocessedReason",
  "snapshotJson",
  "snapshotVersion"
].join("|");
const THREAD_SCHEMA_SIGNATURE = ["latestReceivedDateValue"].join("|");
const TOPIC_SCHEMA_SIGNATURE = ["shortName"].join("|");
const CALENDAR_EVENT_RUNTIME_SIGNATURE = [
  "myPartstat",
  "myPartstatUpdatedAtMs",
  "myAttendeeEmail",
  "replyRequested",
  "occurrenceMessageIds",
  "occurrenceRecurrenceIds",
  "eventUidKey",
  "emailStatusBackfillV1",
  "emailParticipationBackfillV1"
].join("|");

export function ensureCalendarReminderTableSchema(db: any) {
  db.exec(`
    DROP TABLE IF EXISTS calendar_reminders;

    CREATE TABLE IF NOT EXISTS calendar_reminders (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      userId TEXT NOT NULL,
      messageId TEXT,
      eventUid TEXT,
      eventUidKey TEXT,
      eventTitle TEXT NOT NULL,
      eventLocation TEXT,
      eventDescription TEXT,
      eventStartAtMs INTEGER NOT NULL,
      eventEndAtMs INTEGER,
      startTimezone TEXT,
      recurrenceRule TEXT,
      recurrenceDates TEXT,
      excludedDates TEXT,
      leadMinutes INTEGER NOT NULL,
      leadLabel TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL,
      deletedAtMs INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_reminders_account_user_uid
      ON calendar_reminders(accountId, userId, eventUid);
    CREATE INDEX IF NOT EXISTS idx_calendar_reminders_account_user_updated
      ON calendar_reminders(accountId, userId, updatedAtMs DESC);
  `);
}

// PRAGMA doesn't accept bound parameters for identifiers, so the table
// name has to be interpolated. Keep the helper private and assert the
// identifier shape defensively — every caller in this file passes a
// constant string literal, but the guard rules out the injection footgun
// if that ever slips.
const TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function getDbTableColumns(db: any, tableName: string) {
  if (!TABLE_NAME_PATTERN.test(tableName)) {
    throw new Error(`Invalid SQLite table name: ${tableName}`);
  }
  return new Set(
    (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>).map((row) =>
      String(row.name ?? "")
    )
  );
}

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /duplicate column name/i.test(message);
}

/** Add provenance and revoke unidentified targeted invites in the same schema transaction. */
export function ensureInviteIssuerSchema(db:any) {
  db.transaction(()=>{
    const hadProvenance=(db.prepare(`PRAGMA table_info(invite_codes)`).all() as {name:string}[]).some(column=>column.name==="provenance");
    ensureTableColumns(db,"invite_codes",[["email","TEXT"],["issuedByUserId","TEXT"],["provenance","TEXT NOT NULL DEFAULT 'operator'"],["revokedAt","INTEGER"]]);
    if(!hadProvenance)db.prepare(`UPDATE invite_codes SET revokedAt=? WHERE email IS NOT NULL`).run(Date.now());
  }).immediate();
}

// Adds every listed column that is missing from `tableName`. Reads PRAGMA
// table_info at call time, so callers wrap it in an immediate transaction
// to make the read and the ALTERs one unit. "duplicate column name" is
// tolerated: a CLI script and a server restart can race on the same file
// and the loser must not fail its start-up over a column that now exists.
export function ensureTableColumns(
  db: any,
  tableName: string,
  columns: ReadonlyArray<readonly [name: string, ddl: string]>
) {
  const existing = getDbTableColumns(db, tableName);
  for (const [name, ddl] of columns) {
    if (!TABLE_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid SQLite column name: ${name}`);
    }
    if (existing.has(name)) continue;
    try {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${ddl}`).run();
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error;
    }
  }
}

// §3.1 team columns on the master tables. One immediate transaction makes
// the PRAGMA reads and the ALTERs a unit (see `ensureTableColumns`).
function ensureMasterTeamColumns(db: any) {
  db.transaction(() => {
    ensureTableColumns(db, "users", [["uiLocale", "TEXT CHECK(uiLocale IS NULL OR uiLocale IN ('de', 'en'))"]]);
    ensureTableColumns(db, "user_accounts", [
      // Links that predate roles were self-created, hence the default.
      ["role", "TEXT NOT NULL DEFAULT 'manager'"],
      ["grantedByUserId", "TEXT"],
      ["grantedAt", "INTEGER"]
    ]);
    // JSON array of MCP scopes, enforced on every tool call; NULL = legacy read+drafts, invalid = no permissions.
    ensureTableColumns(db, "mcp_tokens", [["scopes", "TEXT"]]);
  }).immediate();
}

const USERS_EMAIL_LOWER_INDEX = "idx_users_email_lower";

function getUsersEmailLowerIndexState(db: any): "missing" | "unique" | "non-unique" {
  const rows = db.prepare(`PRAGMA index_list(users)`).all() as Array<{
    name?: string;
    unique?: number;
  }>;
  const row = rows.find((entry) => entry.name === USERS_EMAIL_LOWER_INDEX);
  if (!row) return "missing";
  return Number(row.unique ?? 0) ? "unique" : "non-unique";
}

// §3.1 e-mail normalisation. `users.email` is stored lowercased and trimmed
// and looked up through `lower(email)`. Legacy rows are rewritten one by one;
// a row whose normalised value collides with another row is left as is, the
// collision is logged with the ids involved (not the addresses), and the
// lower(email) index is created non-unique until an admin resolves the
// duplicates (identity activation must reject ambiguity). Once
// they are resolved, the next start replaces it with the unique index.
// Idempotent, runs on every start, and never throws: start-up must not fail
// because of this step.
function normalizeUserEmails(db: any) {
  try {
    db.transaction(() => {
      const candidates = db
        .prepare(`SELECT id FROM users WHERE email <> lower(trim(email))`)
        .all() as Array<{ id: string }>;
      const normalise = db.prepare(
        `UPDATE users SET email = lower(trim(email))
         WHERE id = ?
           AND NOT EXISTS (
             SELECT 1 FROM users other
             WHERE other.id <> users.id
               AND lower(trim(other.email)) = lower(trim(users.email))
           )`
      );
      candidates.forEach((row) => normalise.run(row.id));

      const duplicates = db
        .prepare(
          `SELECT lower(trim(email)) AS k, COUNT(*) AS n, json_group_array(id) AS ids
           FROM users
           GROUP BY k
           HAVING n > 1`
        )
        .all() as Array<{ k: string; n: number; ids: string }>;
      const indexState = getUsersEmailLowerIndexState(db);

      if (duplicates.length === 0) {
        if (indexState === "non-unique") {
          db.prepare(`DROP INDEX ${USERS_EMAIL_LOWER_INDEX}`).run();
        }
        db.prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${USERS_EMAIL_LOWER_INDEX} ON users(lower(email))`
        ).run();
        return;
      }

      console.warn(
        "[noctua] users share an e-mail address that differs only in case or whitespace; " +
          "the unique e-mail index is deferred until an admin resolves them",
        {
          duplicateUserIds: duplicates
            .map((entry) => (JSON.parse(entry.ids) as string[]).sort())
            .sort((left, right) => left[0].localeCompare(right[0]))
        }
      );
      if (indexState === "missing") {
        db.prepare(`CREATE INDEX ${USERS_EMAIL_LOWER_INDEX} ON users(lower(email))`).run();
      }
    }).immediate();
  } catch (error) {
    console.error(
      "[noctua] users e-mail normalisation failed; continuing without the lower(email) index",
      error
    );
  }
}

export function ensureCalendarReminderOptionalColumns(db: any) {
  const reminderColumns = getDbTableColumns(db, "calendar_reminders");
  if (reminderColumns.size === 0) return;
  if (!reminderColumns.has("eventEndAtMs")) {
    db.prepare(`ALTER TABLE calendar_reminders ADD COLUMN eventEndAtMs INTEGER`).run();
  }
  if (!reminderColumns.has("eventDescription")) {
    db.prepare(`ALTER TABLE calendar_reminders ADD COLUMN eventDescription TEXT`).run();
  }
  const hadEventUidKey = reminderColumns.has("eventUidKey");
  if (!hadEventUidKey) {
    db.prepare(`ALTER TABLE calendar_reminders ADD COLUMN eventUidKey TEXT`).run();
  }
  backfillCalendarReminderEventUidKeys(db);
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_calendar_reminders_account_user_uid_key
     ON calendar_reminders(accountId, userId, eventUidKey)`
  ).run();
}

export function ensureCalendarReminderRuntimeSchema(db: any) {
  if (calendarReminderSchemaSignatureByDb.get(db) === CALENDAR_REMINDER_SCHEMA_SIGNATURE) {
    return;
  }
  ensureCalendarReminderOptionalColumns(db);
  calendarReminderSchemaSignatureByDb.set(db, CALENDAR_REMINDER_SCHEMA_SIGNATURE);
}

function backfillMessageCalendarEventUidKeys(db: any) {
  const rows = db
    .prepare(
      `SELECT accountId, messageId, eventUid
       FROM message_calendar_events
       WHERE COALESCE(eventUid, '') <> ''
         AND COALESCE(eventUidKey, '') = ''`
    )
    .all() as Array<{
    accountId?: string | null;
    messageId?: string | null;
    eventUid?: string | null;
  }>;
  if (rows.length === 0) return;
  const updateStatement = db.prepare(
    `UPDATE message_calendar_events
     SET eventUidKey = ?
     WHERE accountId = ? AND messageId = ? AND eventUid = ?`
  );
  const runUpdate = db.transaction(
    (
      items: Array<{
        accountId?: string | null;
        messageId?: string | null;
        eventUid?: string | null;
      }>
    ) => {
      items.forEach((row) => {
        const accountId = String(row.accountId ?? "").trim();
        const messageId = String(row.messageId ?? "").trim();
        const eventUid = String(row.eventUid ?? "").trim();
        const eventUidKey = normalizeCalendarEventUidKey(eventUid);
        if (!accountId || !messageId || !eventUid || !eventUidKey) return;
        updateStatement.run(eventUidKey, accountId, messageId, eventUid);
      });
    }
  );
  runUpdate(rows);
}

export function ensureMessageCalendarEventOptionalColumns(db: any) {
  const messageCalendarColumns = getDbTableColumns(db, "message_calendar_events");
  if (messageCalendarColumns.size === 0) return;
  const hadEventUidKey = messageCalendarColumns.has("eventUidKey");
  if (!hadEventUidKey) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN eventUidKey TEXT`).run();
  }
  if (!messageCalendarColumns.has("eventFirstStartAtMs")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN eventFirstStartAtMs INTEGER`).run();
  }
  if (!messageCalendarColumns.has("eventLastEndAtMs")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN eventLastEndAtMs INTEGER`).run();
  }
  if (!messageCalendarColumns.has("inviteActionType")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN inviteActionType TEXT`).run();
  }
  if (!messageCalendarColumns.has("processedAtMs")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN processedAtMs INTEGER`).run();
  }
  if (!messageCalendarColumns.has("processedByUserId")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN processedByUserId TEXT`).run();
  }
  if (!messageCalendarColumns.has("processedAutomatically")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN processedAutomatically INTEGER`).run();
  }
  if (!messageCalendarColumns.has("unprocessedReason")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN unprocessedReason TEXT`).run();
  }
  if (!messageCalendarColumns.has("snapshotJson")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN snapshotJson TEXT`).run();
  }
  if (!messageCalendarColumns.has("snapshotVersion")) {
    db.prepare(`ALTER TABLE message_calendar_events ADD COLUMN snapshotVersion INTEGER`).run();
  }
  backfillMessageCalendarEventUidKeys(db);
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_message_calendar_events_account_uid_key
     ON message_calendar_events(accountId, eventUidKey)`
  ).run();
}

export function ensureMessageCalendarEventRuntimeSchema(db: any) {
  if (
    messageCalendarEventSchemaSignatureByDb.get(db) ===
    MESSAGE_CALENDAR_EVENT_SCHEMA_SIGNATURE
  ) {
    return;
  }
  ensureMessageCalendarEventOptionalColumns(db);
  messageCalendarEventSchemaSignatureByDb.set(db, MESSAGE_CALENDAR_EVENT_SCHEMA_SIGNATURE);
}

export function ensureThreadOptionalColumns(db: any) {
  const threadColumns = getDbTableColumns(db, "threads");
  if (threadColumns.size === 0) return;
  if (!threadColumns.has("latestReceivedDateValue")) {
    db.prepare(`ALTER TABLE threads ADD COLUMN latestReceivedDateValue INTEGER`).run();
  }
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_threads_account_latest_received
     ON threads(accountId, latestReceivedDateValue DESC)`
  ).run();
}

export function ensureThreadRuntimeSchema(db: any) {
  if (threadSchemaSignatureByDb.get(db) === THREAD_SCHEMA_SIGNATURE) {
    return;
  }
  ensureThreadOptionalColumns(db);
  threadSchemaSignatureByDb.set(db, THREAD_SCHEMA_SIGNATURE);
}

export function ensureTopicOptionalColumns(db: any) {
  const topicColumns = getDbTableColumns(db, "topics");
  if (topicColumns.size === 0) return;
  if (!topicColumns.has("shortName")) {
    db.prepare(`ALTER TABLE topics ADD COLUMN shortName TEXT`).run();
  }
}

export function ensureTopicRuntimeSchema(db: any) {
  if (topicSchemaSignatureByDb.get(db) === TOPIC_SCHEMA_SIGNATURE) {
    return;
  }
  ensureTopicOptionalColumns(db);
  topicSchemaSignatureByDb.set(db, TOPIC_SCHEMA_SIGNATURE);
}

export function ensureCalendarEventOptionalColumns(db: any) {
  const calendarEventColumns = getDbTableColumns(db, "calendar_events");
  if (calendarEventColumns.size === 0) return;
  if (!calendarEventColumns.has("myPartstat")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN myPartstat TEXT`).run();
  }
  if (!calendarEventColumns.has("myPartstatUpdatedAtMs")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN myPartstatUpdatedAtMs INTEGER`).run();
  }
  if (!calendarEventColumns.has("myAttendeeEmail")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN myAttendeeEmail TEXT`).run();
  }
  if (!calendarEventColumns.has("replyRequested")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN replyRequested INTEGER`).run();
  }
  if (!calendarEventColumns.has("occurrenceMessageIds")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN occurrenceMessageIds TEXT`).run();
  }
  // Source email snapshot columns (Topic 2, Calendar-Improvements.md).
  // These capture the standard fields of the email that spawned the event
  // so the snapshot survives deletion of the original message.
  if (!calendarEventColumns.has("sourceSubject")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceSubject TEXT`).run();
  }
  if (!calendarEventColumns.has("sourceFromAddr")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceFromAddr TEXT`).run();
  }
  if (!calendarEventColumns.has("sourceToAddr")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceToAddr TEXT`).run();
  }
  if (!calendarEventColumns.has("sourceCcAddr")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceCcAddr TEXT`).run();
  }
  if (!calendarEventColumns.has("sourceBccAddr")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceBccAddr TEXT`).run();
  }
  if (!calendarEventColumns.has("sourceDateMs")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceDateMs INTEGER`).run();
  }
  if (!calendarEventColumns.has("sourceBodyText")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceBodyText TEXT`).run();
  }
  if (!calendarEventColumns.has("sourceBodyHtml")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN sourceBodyHtml TEXT`).run();
  }
  // Per-occurrence source email snapshots (Topic 2, Option C extension).
  // Stored as JSON keyed by occurrence startAtMs, mirroring occurrenceMessageIds.
  if (!calendarEventColumns.has("occurrenceSnapshots")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN occurrenceSnapshots TEXT`).run();
  }
  // Maps current occurrence startAtMs -> original RECURRENCE-ID it supersedes,
  // so a later reschedule of the same RECURRENCE-ID can evict the stale RDATE
  // instead of duplicating it.
  if (!calendarEventColumns.has("occurrenceRecurrenceIds")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN occurrenceRecurrenceIds TEXT`).run();
  }
  // Normalized UID key that strips Google's per-anchor `_R<YYYYMMDDTHHMMSS>`
  // suffix, mirroring what message_calendar_events / calendar_reminders
  // already do. This lets the invite processor recognize that two rows with
  // different UIDs (e.g. `_R20260320T094500@google.com` and
  // `_R20260403T084500@google.com`) belong to the same logical series so
  // the prior anchor can be UNTIL-capped when a new one arrives.
  const hadCalendarEventUidKey = calendarEventColumns.has("eventUidKey");
  if (!hadCalendarEventUidKey) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN eventUidKey TEXT`).run();
  }
  // Dirty flag for CalDAV write-back: change time (ms) of a local edit not
  // yet pushed to the remote server. Cleared once sync pushes the row.
  if (!calendarEventColumns.has("pendingRemoteSync")) {
    db.prepare(`ALTER TABLE calendar_events ADD COLUMN pendingRemoteSync INTEGER`).run();
  }
  backfillCalendarEventUidKeys(db);
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_calendar_events_account_uid_key
     ON calendar_events(accountId, eventUidKey)`
  ).run();
}

function backfillCalendarEventUidKeys(db: any) {
  const rows = db
    .prepare(
      `SELECT id, eventUid
       FROM calendar_events
       WHERE COALESCE(eventUid, '') <> ''
         AND COALESCE(eventUidKey, '') = ''`
    )
    .all() as Array<{ id?: string | null; eventUid?: string | null }>;
  if (rows.length === 0) return;
  const updateStatement = db.prepare(
    `UPDATE calendar_events SET eventUidKey = ? WHERE id = ?`
  );
  const runUpdate = db.transaction(
    (items: Array<{ id?: string | null; eventUid?: string | null }>) => {
      items.forEach((row) => {
        const id = String(row.id ?? "").trim();
        const eventUid = String(row.eventUid ?? "").trim();
        const eventUidKey = normalizeCalendarEventUidKey(eventUid);
        if (!id || !eventUidKey) return;
        updateStatement.run(eventUidKey, id);
      });
    }
  );
  runUpdate(rows);
}

function backfillEmailCalendarEventStatuses(db: any) {
  const rows = db
    .prepare(
      `SELECT id, eventUid, status, rawIcs
       FROM calendar_events
       WHERE sourceType = 'email'
         AND deletedAtMs IS NULL
         AND COALESCE(rawIcs, '') <> ''`
    )
    .all() as Array<{
    id?: string | null;
    eventUid?: string | null;
    status?: string | null;
    rawIcs?: string | null;
  }>;
  if (rows.length === 0) return;

  const updates = rows.flatMap((row) => {
    const id = String(row.id ?? "").trim();
    const eventUid = String(row.eventUid ?? "").trim();
    const rawIcs = String(row.rawIcs ?? "");
    if (!id || !eventUid || !rawIcs.trim()) return [];

    const nextStatus = extractEmailCalendarEventStatusFromIcs(rawIcs, eventUid) ?? null;
    const currentStatus = normalizeCalendarEventStatus(row.status);
    if ((nextStatus ?? null) === (currentStatus ?? null)) return [];
    return [{ id, status: nextStatus }];
  });
  if (updates.length === 0) return;

  const updateStatement = db.prepare(
    `UPDATE calendar_events
     SET status = ?, updatedAtMs = ?
     WHERE id = ?`
  );
  const now = Date.now();
  const runUpdate = db.transaction((items: Array<{ id: string; status: string | null }>) => {
    items.forEach((item) => {
      updateStatement.run(item.status, now, item.id);
    });
  });
  runUpdate(updates);
}

function backfillEmailCalendarEventParticipation(
  db: any,
  accountId: string,
  accountEmail?: OwnAddressInput
) {
  const normalizedAccountId = accountId?.trim();
  const normalizedAccountEmail = ownAddressList(accountEmail);
  if (!normalizedAccountId || !normalizedAccountEmail.length) return;
  const rows = db
    .prepare(
      `SELECT id, eventUid, attendees, myPartstat, myPartstatUpdatedAtMs, myAttendeeEmail, replyRequested, rawIcs
       FROM calendar_events
       WHERE accountId = ?
         AND deletedAtMs IS NULL
         AND COALESCE(rawIcs, '') <> ''`
    )
    .all(normalizedAccountId) as Array<{
    id?: string | null;
    eventUid?: string | null;
    attendees?: string | null;
    myPartstat?: string | null;
    myPartstatUpdatedAtMs?: number | null;
    myAttendeeEmail?: string | null;
    replyRequested?: number | null;
    rawIcs?: string | null;
  }>;
  if (rows.length === 0) return;

  const updateStatement = db.prepare(
    `UPDATE calendar_events
     SET attendees = ?, myPartstat = ?, myPartstatUpdatedAtMs = ?, myAttendeeEmail = ?, replyRequested = ?, updatedAtMs = ?
     WHERE id = ?`
  );
  const now = Date.now();
  const updates = rows.flatMap((row) => {
    const id = String(row.id ?? "").trim();
    const eventUid = String(row.eventUid ?? "").trim();
    const rawIcs = String(row.rawIcs ?? "");
    if (!id || !eventUid || !rawIcs.trim()) return [];
    const group = collectCalendarInviteMutationGroups(rawIcs).find(
      (item) => item.eventUid.trim().toLowerCase() === eventUid.toLowerCase()
    );
    const participation = mergeCalendarParticipation(
      {
        attendees: row.attendees ?? undefined,
        myPartstat: normalizeCalendarParticipationStatus(row.myPartstat),
        myPartstatUpdatedAtMs:
          typeof row.myPartstatUpdatedAtMs === "number" ? row.myPartstatUpdatedAtMs : undefined,
        myAttendeeEmail: row.myAttendeeEmail ?? undefined,
        replyRequested:
          row.replyRequested == null ? undefined : Boolean(row.replyRequested)
      },
      resolveCalendarParticipationFromPreview(group?.baseEvent ?? {}, normalizedAccountEmail),
      now
    );
    const nextReplyRequested =
      typeof participation.replyRequested === "boolean" ? Number(participation.replyRequested) : null;
    const currentReplyRequested = row.replyRequested == null ? null : Number(Boolean(row.replyRequested));
    if (
      (participation.attendees ?? null) === (row.attendees ?? null) &&
      (participation.myPartstat ?? null) === (row.myPartstat ?? null) &&
      (participation.myPartstatUpdatedAtMs ?? null) === (row.myPartstatUpdatedAtMs ?? null) &&
      (participation.myAttendeeEmail ?? null) === (row.myAttendeeEmail ?? null) &&
      nextReplyRequested === currentReplyRequested
    ) {
      return [];
    }
    return [{
      id,
      attendees: participation.attendees ?? null,
      myPartstat: participation.myPartstat ?? null,
      myPartstatUpdatedAtMs: participation.myPartstatUpdatedAtMs ?? null,
      myAttendeeEmail: participation.myAttendeeEmail ?? null,
      replyRequested: nextReplyRequested
    }];
  });
  if (updates.length === 0) return;

  const runUpdate = db.transaction(
    (
      items: Array<{
        id: string;
        attendees: string | null;
        myPartstat: string | null;
        myPartstatUpdatedAtMs: number | null;
        myAttendeeEmail: string | null;
        replyRequested: number | null;
      }>
    ) => {
      items.forEach((item) => {
        updateStatement.run(
          item.attendees,
          item.myPartstat,
          item.myPartstatUpdatedAtMs,
          item.myAttendeeEmail,
          item.replyRequested,
          now,
          item.id
        );
      });
    }
  );
  runUpdate(updates);
}

export async function ensureCalendarEventRuntimeData(db: any, accountId: string) {
  // Runs on every getAccountDb: read only the own addresses (email + sender
  // identities), not the full account row with its decrypted secrets. Lazy
  // import to avoid a top-level cycle with lib/db.ts (which re-exports this module).
  const { getAccountOwnAddresses } = await import("./senderIdentities");
  const ownAddresses = await getAccountOwnAddresses(accountId);
  const signature = `${CALENDAR_EVENT_RUNTIME_SIGNATURE}:${ownAddresses.join(",")}`;
  const perAccount = calendarEventRuntimeSignatureByDb.get(db);
  if (perAccount?.get(accountId) === signature) {
    return;
  }
  ensureCalendarEventOptionalColumns(db);
  backfillEmailCalendarEventStatuses(db);
  backfillEmailCalendarEventParticipation(db, accountId, ownAddresses);
  const nextPerAccount = perAccount ?? new Map<string, string>();
  nextPerAccount.set(accountId, signature);
  if (!perAccount) calendarEventRuntimeSignatureByDb.set(db, nextPerAccount);
}

function createAdminInvite(db: any): InviteCode {
  const adminInvite: InviteCode = {
    code: randomUUID(),
    role: "admin",
    maxUses: 1,
    uses: 0,
    expiresAt: null,
    createdAt: Date.now(),
    usedByUserId: null
  };
  db.prepare(
    `INSERT INTO invite_codes (code, role, maxUses, uses, expiresAt, createdAt, usedByUserId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    adminInvite.code,
    adminInvite.role,
    adminInvite.maxUses,
    adminInvite.uses,
    adminInvite.expiresAt,
    adminInvite.createdAt,
    adminInvite.usedByUserId
  );
  return adminInvite;
}

function getUsableAdminInvite(db: any): InviteCode | null {
  const row = db
    .prepare(
      `SELECT code, role, maxUses, uses, expiresAt, createdAt, usedByUserId
       FROM invite_codes
       WHERE role = 'admin'
         AND (expiresAt IS NULL OR expiresAt >= ?)
         AND (maxUses IS NULL OR uses < maxUses)
       ORDER BY uses ASC, code ASC
       LIMIT 1`
    )
    .get(Date.now()) as any;
  if (!row) return null;
  return mapInviteRow(row);
}

function ensureAdminInvite(db: any): InviteCode {
  return getUsableAdminInvite(db) ?? createAdminInvite(db);
}

export function initMasterSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_worker_leases (
      slot INTEGER PRIMARY KEY, jobId TEXT UNIQUE NOT NULL, accountId TEXT NOT NULL, ownerInstance TEXT NOT NULL,
      ownerPid INTEGER NOT NULL, pid INTEGER, expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_worker_owners (
      ownerInstance TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_worker_queue (
      jobId TEXT PRIMARY KEY, accountId TEXT NOT NULL, ownerInstance TEXT NOT NULL, ownerPid INTEGER NOT NULL,
      priority INTEGER NOT NULL, queuedAt INTEGER NOT NULL, bypasses INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mailbox_watcher_auth (
      accountId TEXT PRIMARY KEY, identity TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mailbox_watcher_lease (
      slot INTEGER PRIMARY KEY CHECK(slot=1), ownerInstance TEXT NOT NULL,
      pid INTEGER NOT NULL, expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      avatar TEXT NOT NULL,
      ownerUserId TEXT,
      settings TEXT,
      dbPath TEXT,
      imapHost TEXT NOT NULL,
      imapPort INTEGER NOT NULL,
      imapSecure INTEGER NOT NULL,
      imapUser TEXT NOT NULL,
      imapPassword TEXT NOT NULL,
      smtpHost TEXT NOT NULL,
      smtpPort INTEGER NOT NULL,
      smtpSecure INTEGER NOT NULL,
      smtpUser TEXT NOT NULL,
      smtpPassword TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sender_identities (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE,
      displayName TEXT NOT NULL,
      replyTo TEXT,
      signatureId TEXT,
      isDefault INTEGER NOT NULL DEFAULT 0 CHECK(isDefault IN (0,1)),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      createdBy TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      CHECK(isDefault = 0 OR enabled = 1)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sender_identity_address ON sender_identities(accountId,email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sender_identity_default ON sender_identities(accountId) WHERE isDefault=1;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      PRIMARY KEY (userId, accountId)
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      maxUses INTEGER,
      uses INTEGER DEFAULT 0,
      expiresAt INTEGER,
      createdAt INTEGER NOT NULL,
      usedByUserId TEXT
    );

    CREATE TABLE IF NOT EXISTS mcp_tokens (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      createdByUserId TEXT NOT NULL,
      label TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      tokenSuffix TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER,
      lastUsedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS mcp_token_accounts (
      tokenId TEXT NOT NULL REFERENCES mcp_tokens(id) ON DELETE CASCADE,
      accountId TEXT NOT NULL,
      PRIMARY KEY (tokenId, accountId)
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_token_accounts_account ON mcp_token_accounts(accountId, tokenId);
    CREATE TRIGGER IF NOT EXISTS mcp_token_accounts_delete_token AFTER DELETE ON mcp_tokens
    BEGIN
      DELETE FROM mcp_token_accounts WHERE tokenId=OLD.id;
    END;

    CREATE TABLE IF NOT EXISTS user_account_prefs (
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      prefs TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (userId, accountId)
    );

    CREATE TABLE IF NOT EXISTS admin_audit (
      id TEXT PRIMARY KEY,
      actorUserId TEXT NOT NULL,
      action TEXT NOT NULL,
      targetUserId TEXT,
      targetAccountId TEXT,
      payload TEXT,
      createdAt INTEGER NOT NULL
    );

    -- Spam detection settings (doc/SPAM-DETECTION.md): scope 'global' or an account id.
    CREATE TABLE IF NOT EXISTS spam_settings (
      scope TEXT PRIMARY KEY,
      settings TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      updatedByUserId TEXT
    );

    -- Admin-uploaded sidebar icons per mail domain (lib/domainIcons.ts). The
    -- normalised PNG lives at domain-icons/<sha256(domain)>.png in the data dir;
    -- hash is the sha256 of those bytes (ETag and client cache key).
    CREATE TABLE IF NOT EXISTS domain_icons (
      domain TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      size INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      updatedByUserId TEXT
    );

    -- Web Push devices (doc/PUSH-NOTIFICATIONS.md); settings is a PushDeviceSettings JSON.
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      userAgent TEXT,
      settings TEXT NOT NULL,
      createdAt INTEGER,
      lastSeenAt INTEGER,
      lastSentAt INTEGER,
      failures INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(userId);
  `);

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_mcp_tokens_account_created
     ON mcp_tokens(accountId, createdAt DESC)`
  ).run();
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_admin_audit_created
     ON admin_audit(createdAt DESC)`
  ).run();

  db.transaction(() => {
    for (const account of db.prepare("SELECT id,email,name FROM accounts").all()) seedSenderIdentityRow(db, account);
  }).immediate();
  ensureMasterTeamColumns(db);
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_user_accounts_account
     ON user_accounts(accountId)`
  ).run();
  normalizeUserEmails(db);

  const inviteColumns = new Set(
    (db.prepare(`PRAGMA table_info(invite_codes)`).all() as Array<{ name?: string }>).map((row) =>
      String(row.name ?? "")
    )
  );
  if (!inviteColumns.has("createdAt")) {
    db.prepare(`ALTER TABLE invite_codes ADD COLUMN createdAt INTEGER`).run();
    db.prepare(`UPDATE invite_codes SET createdAt = ? WHERE createdAt IS NULL`).run(Date.now());
  }
  if (!inviteColumns.has("usedByUserId")) {
    db.prepare(`ALTER TABLE invite_codes ADD COLUMN usedByUserId TEXT`).run();
  }
  if (!inviteColumns.has("email")) db.prepare(`ALTER TABLE invite_codes ADD COLUMN email TEXT`).run();
  ensureInviteIssuerSchema(db);

  const accountColumns = new Set(
    (db.prepare(`PRAGMA table_info(accounts)`).all() as Array<{ name?: string }>).map((row) =>
      String(row.name ?? "")
    )
  );
  if (!accountColumns.has("caldavUrl")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN caldavUrl TEXT`).run();
  }
  if (!accountColumns.has("caldavUser")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN caldavUser TEXT`).run();
  }
  if (!accountColumns.has("caldavPassword")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN caldavPassword TEXT`).run();
  }
  if (!accountColumns.has("caldavCalendarPath")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN caldavCalendarPath TEXT`).run();
  }
  if (!accountColumns.has("caldavSyncIntervalMs")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN caldavSyncIntervalMs INTEGER`).run();
  }
  if (!accountColumns.has("deeplApiKey")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN deeplApiKey TEXT`).run();
  }
  if (!accountColumns.has("deeplEnabled")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN deeplEnabled INTEGER`).run();
  }
  if (!accountColumns.has("deeplTargetLang")) {
    db.prepare(`ALTER TABLE accounts ADD COLUMN deeplTargetLang TEXT`).run();
  }

  const userCount = db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number };
  if (userCount.count === 0) {
    ensureAdminInvite(db);
    console.info("[noctua] Bootstrap invite ready; retrieve locally with scripts/recoverTeamAuth.ts --bootstrap-invite (personal handover).");
  }
}

// Collaboration shard schema. Kept separate from watcher summary/lastSyncAt changes.
const threadCollabSchemaByDb = new WeakSet<object>();
export function ensureThreadCollabRuntimeSchema(db: any, inTransaction = false) {
  if (threadCollabSchemaByDb.has(db)) return;
  // A cold reader of an initialized shard must not acquire SQLite's writer
  // lock. Include indexes so a partially initialized schema is repaired too.
  const requiredObjects = [
    "thread_collab_state", "thread_comments", "sent_by", "thread_activity",
    "idx_thread_collab_state_assignee", "idx_thread_collab_state_status",
    "idx_thread_collab_state_summary",
    "idx_thread_comments_thread", "idx_thread_activity_thread"
  ];
  const existing = new Set((db.prepare(`SELECT name FROM sqlite_master
    WHERE type IN ('table', 'index') AND name IN (${requiredObjects.map(() => "?").join(",")})`)
    .all(...requiredObjects) as Array<{ name: string }>).map(row => row.name));
  if (requiredObjects.every(name => existing.has(name)) &&
    ["thread_collab_state", "thread_comments"].every(table =>
      db.prepare(`PRAGMA table_info(${table})`).all().some((column: { name: string }) => column.name === "revision"))) {
    if (!inTransaction) threadCollabSchemaByDb.add(db);
    return;
  }
  const install = () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS thread_collab_state (
        accountId TEXT NOT NULL, threadId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open', assigneeUserId TEXT,
        assignedByUserId TEXT, assignedAt INTEGER, statusChangedAt INTEGER,
        statusChangedByUserId TEXT, commentCount INTEGER NOT NULL DEFAULT 0,
        lastActivityAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, updatedByUserId TEXT,
        revision INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (accountId, threadId)
      );
      CREATE TABLE IF NOT EXISTS thread_comments (
        id TEXT PRIMARY KEY, accountId TEXT NOT NULL, threadId TEXT NOT NULL,
        authorUserId TEXT NOT NULL, body TEXT NOT NULL, createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL, deletedAt INTEGER, revision INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sent_by (
        accountId TEXT NOT NULL, messageId TEXT NOT NULL, userId TEXT NOT NULL, sentAt INTEGER NOT NULL,
        PRIMARY KEY (accountId, messageId)
      );
      CREATE TABLE IF NOT EXISTS thread_activity (
        id TEXT PRIMARY KEY, accountId TEXT NOT NULL, threadId TEXT NOT NULL,
        type TEXT NOT NULL, actorUserId TEXT, actorClientId TEXT, payload TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_thread_collab_state_assignee
        ON thread_collab_state(accountId, assigneeUserId);
      CREATE INDEX IF NOT EXISTS idx_thread_collab_state_status
        ON thread_collab_state(accountId, status);
      CREATE INDEX IF NOT EXISTS idx_thread_collab_state_summary
        ON thread_collab_state(accountId, assigneeUserId, status);
      CREATE INDEX IF NOT EXISTS idx_thread_comments_thread
        ON thread_comments(accountId, threadId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_thread_activity_thread
        ON thread_activity(accountId, threadId, createdAt);
    `);
    // Re-read under the writer lock: another connection may have migrated first.
    for (const table of ["thread_collab_state", "thread_comments"]) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      if (!columns.some(column => column.name === "revision"))
        db.exec(`ALTER TABLE ${table} ADD COLUMN revision INTEGER NOT NULL DEFAULT 0`);
    }
  };
  if (inTransaction) install();
  else {
    db.transaction(install).immediate();
    threadCollabSchemaByDb.add(db);
  }
}

export function initAccountSchema(db: any) {
  prepareAccountShardConnection(db);
  assertCompleteShardFormat(db);
  if (assertSupportedShardFormat(db) === 3) return initAccountSchemaBody(db, false);
  // Additive initialization and both historical/current migrations commit as one
  // unit. The audited parent-table rebuild requires FK OFF before BEGIN.
  const foreignKeys = Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys);
  const rebuildKeys = assertSupportedShardFormat(db) < 2;
  if (rebuildKeys) db.exec("PRAGMA foreign_keys=OFF");
  try {
    if (rebuildKeys && Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) !== 0) {
      throw new Error("Account shard initialization must run outside a transaction");
    }
    const result = db.transaction(() => {
      assertCompleteShardFormat(db);
      return initAccountSchemaBody(db, true);
    }).immediate();
    threadCollabSchemaByDb.add(db);
    senderIdentityMessageSchemaByDb.add(db);
    spamSchemaByDb.add(db);
    if (result.droppedFtsOrphans) console.warn(`[shard-format-v3] dropped ${result.droppedFtsOrphans} orphan FTS rows`);
    return result;
  } finally {
    if (rebuildKeys) db.exec(`PRAGMA foreign_keys=${foreignKeys}`);
  }
}

function initAccountSchemaBody(db: any, inTransaction: boolean) {
  ensureThreadCollabRuntimeSchema(db, inTransaction);
  db.exec(`
    CREATE TABLE IF NOT EXISTS mailbox_summary (
      accountId TEXT PRIMARY KEY,
      lastSyncAt INTEGER,
      watcherState TEXT NOT NULL DEFAULT 'disabled'
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parentId TEXT,
      accountId TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      specialUse TEXT,
      flags TEXT,
      delimiter TEXT
    );

    ${ACCOUNT_KEY_TABLE_SQL.messages}

    ${ACCOUNT_KEY_TABLE_SQL.attachments}

    ${ACCOUNT_KEY_TABLE_SQL.message_translations}

    ${ACCOUNT_KEY_TABLE_SQL.message_calendar_events}

    ${ACCOUNT_KEY_TABLE_SQL.threads}

    CREATE TABLE IF NOT EXISTS mailbox_state (
      folderId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      mailboxPath TEXT NOT NULL,
      uidValidity TEXT,
      highestModSeq TEXT,
      highestUid INTEGER,
      supportsQresync INTEGER
    );

    CREATE TABLE IF NOT EXISTS category_model_state (
      accountId TEXT PRIMARY KEY,
      modelJson TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_feedback_events (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      previousCategory TEXT,
      nextCategory TEXT,
      featureJson TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      name TEXT NOT NULL,
      shortName TEXT,
      color TEXT NOT NULL,
      imapKeyword TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipient_aliases (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      name TEXT NOT NULL,
      recipients TEXT NOT NULL,
      normalizedRecipients TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    ${ACCOUNT_KEY_TABLE_SQL.thread_topics}

    CREATE TABLE IF NOT EXISTS thread_signals (
      accountId TEXT NOT NULL,
      threadId TEXT NOT NULL,
      signalType TEXT NOT NULL,
      signalValue TEXT NOT NULL,
      PRIMARY KEY (accountId, threadId, signalType, signalValue)
    );

    CREATE TABLE IF NOT EXISTS topic_learning_signals (
      accountId TEXT NOT NULL,
      topicId TEXT NOT NULL,
      threadId TEXT NOT NULL,
      signalType TEXT NOT NULL,
      signalValue TEXT NOT NULL,
      PRIMARY KEY (accountId, topicId, threadId, signalType, signalValue)
    );

    CREATE TABLE IF NOT EXISTS topic_signal_exclusions (
      accountId TEXT NOT NULL,
      topicId TEXT NOT NULL,
      signalType TEXT NOT NULL,
      signalValue TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (accountId, topicId, signalType, signalValue)
    );

    CREATE TABLE IF NOT EXISTS calendar_reminders (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      userId TEXT NOT NULL,
      messageId TEXT,
      eventUid TEXT,
      eventUidKey TEXT,
      eventTitle TEXT NOT NULL,
      eventLocation TEXT,
      eventDescription TEXT,
      eventStartAtMs INTEGER NOT NULL,
      eventEndAtMs INTEGER,
      startTimezone TEXT,
      recurrenceRule TEXT,
      recurrenceDates TEXT,
      excludedDates TEXT,
      leadMinutes INTEGER NOT NULL,
      leadLabel TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL,
      deletedAtMs INTEGER
    );

    -- The key/format migration below reserves this legacy name as a read-only
    -- view and builds message_fts_v3 plus its identity map atomically.
    CREATE VIRTUAL TABLE IF NOT EXISTS message_fts
    USING fts5(accountId UNINDEXED, messageId UNINDEXED, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview);

    CREATE INDEX IF NOT EXISTS idx_messages_live_thread_summary
      ON messages(accountId, threadId, dateValue DESC) WHERE COALESCE(deleted, 0) = 0;
    CREATE INDEX IF NOT EXISTS idx_messages_unread_mailbox_summary
      ON messages(accountId, folderId) WHERE unread = 1 AND COALESCE(deleted, 0) = 0;
    CREATE INDEX IF NOT EXISTS idx_messages_account_folder_date
      ON messages(accountId, folderId, dateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_account_date
      ON messages(accountId, dateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_thread
      ON messages(threadId);
    CREATE INDEX IF NOT EXISTS idx_messages_account_thread_date
      ON messages(accountId, threadId, dateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_account_flagged_thread
      ON messages(accountId, flagged, threadId);
    CREATE INDEX IF NOT EXISTS idx_messages_account_flagged_date
      ON messages(accountId, flagged DESC, dateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_account_folder_flagged_date
      ON messages(accountId, folderId, flagged DESC, dateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_category
      ON messages(accountId, category, dateValue DESC);
    -- Expression index for from:<term> searches. buildAddressSearchClause
    -- emits lower(COALESCE(fromAddr, '')) LIKE ?; the indexed expression
    -- must match the WHERE expression character-for-character for SQLite
    -- to use it. With this index the planner does a per-account index
    -- scan on the precomputed lowered value (~13x faster on a 7k-row DB)
    -- instead of a full-table scan that re-evaluates lower(COALESCE(...))
    -- per row.
    --
    -- Deliberately not adding analogous indexes for toAddr/ccAddr/bccAddr:
    -- recipient/participant searches OR across multiple columns, and
    -- SQLite's planner does not match expression-index expressions to
    -- WHERE expressions when picking between equally-narrowing indexes.
    -- With multiple competing expression indexes the planner picks the
    -- smallest one (typically bcc, mostly NULL), which doesn't match the
    -- column being filtered, and the LIKE falls back to per-row
    -- evaluation. Improving recipient/participant search needs an FTS5
    -- redesign, not more expression indexes — see CLEANUP/pass4-risk.md.
    --
    -- Also: do not run ANALYZE on this table without re-validating; with
    -- selectivity stats present, the planner prefers a full SCAN over
    -- this index because LIKE '%term%' cannot use it for a seek.
    CREATE INDEX IF NOT EXISTS idx_messages_account_from_lower
      ON messages(accountId, lower(COALESCE(fromAddr, '')));
    CREATE INDEX IF NOT EXISTS idx_threads_account_latest
      ON threads(accountId, latestDateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_message
      ON attachments(messageId);
    CREATE INDEX IF NOT EXISTS idx_message_calendar_events_account_uid
      ON message_calendar_events(accountId, eventUid);
    CREATE INDEX IF NOT EXISTS idx_message_calendar_events_account_message
      ON message_calendar_events(accountId, messageId);
    CREATE INDEX IF NOT EXISTS idx_calendar_reminders_account_user_uid
      ON calendar_reminders(accountId, userId, eventUid);
    CREATE INDEX IF NOT EXISTS idx_calendar_reminders_account_user_updated
      ON calendar_reminders(accountId, userId, updatedAtMs DESC);
    CREATE INDEX IF NOT EXISTS idx_category_feedback_events_account_created
      ON category_feedback_events(accountId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_topics_account
      ON topics(accountId);
    CREATE INDEX IF NOT EXISTS idx_recipient_aliases_account
      ON recipient_aliases(accountId);
    CREATE INDEX IF NOT EXISTS idx_recipient_aliases_account_normalized_recipients
      ON recipient_aliases(accountId, normalizedRecipients);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_recipient_aliases_account_name
      ON recipient_aliases(accountId, lower(name));
    CREATE INDEX IF NOT EXISTS idx_thread_topics_thread
      ON thread_topics(threadId);
    CREATE INDEX IF NOT EXISTS idx_thread_topics_topic
      ON thread_topics(topicId);
    CREATE INDEX IF NOT EXISTS idx_thread_signals_account_thread
      ON thread_signals(accountId, threadId);
    CREATE INDEX IF NOT EXISTS idx_thread_signals_account_signal
      ON thread_signals(accountId, signalType, signalValue, threadId);
    CREATE INDEX IF NOT EXISTS idx_topic_learning_signals_account_topic
      ON topic_learning_signals(accountId, topicId, threadId);
    CREATE INDEX IF NOT EXISTS idx_topic_learning_signals_account_signal
      ON topic_learning_signals(accountId, signalType, signalValue, topicId, threadId);
    CREATE INDEX IF NOT EXISTS idx_topic_signal_exclusions_account_topic
      ON topic_signal_exclusions(accountId, topicId);
    CREATE INDEX IF NOT EXISTS idx_topic_signal_exclusions_account_signal
      ON topic_signal_exclusions(accountId, signalType, signalValue, topicId);

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      calendarId TEXT,
      eventUid TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT,
      location TEXT,
      startAtMs INTEGER NOT NULL,
      endAtMs INTEGER,
      allDay INTEGER NOT NULL DEFAULT 0,
      startTimezone TEXT,
      endTimezone TEXT,
      recurrenceRule TEXT,
      recurrenceDates TEXT,
      excludedDates TEXT,
      status TEXT,
      organizer TEXT,
      attendees TEXT,
      myPartstat TEXT,
      myPartstatUpdatedAtMs INTEGER,
      myAttendeeEmail TEXT,
      replyRequested INTEGER,
      remoteEtag TEXT,
      remoteHref TEXT,
      rawIcs TEXT,
      pendingRemoteSync INTEGER,
      sourceType TEXT NOT NULL DEFAULT 'local',
      messageId TEXT,
      occurrenceMessageIds TEXT,
      sourceSubject TEXT,
      sourceFromAddr TEXT,
      sourceToAddr TEXT,
      sourceCcAddr TEXT,
      sourceBccAddr TEXT,
      sourceDateMs INTEGER,
      sourceBodyText TEXT,
      sourceBodyHtml TEXT,
      occurrenceSnapshots TEXT,
      occurrenceRecurrenceIds TEXT,
      eventUidKey TEXT,
      createdAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL,
      deletedAtMs INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_calendar_events_account_start
      ON calendar_events(accountId, startAtMs);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_account_uid
      ON calendar_events(accountId, eventUid);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_account_source
      ON calendar_events(accountId, sourceType);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_account_calendar
      ON calendar_events(accountId, calendarId);

    CREATE TABLE IF NOT EXISTS calendar_participation_overrides (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      eventUid TEXT NOT NULL,
      occurrenceStartAtMs INTEGER NOT NULL,
      partstat TEXT NOT NULL,
      attendeeEmail TEXT,
      updatedAtMs INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_participation_overrides_account_uid_occurrence
      ON calendar_participation_overrides(accountId, eventUid, occurrenceStartAtMs);

    CREATE TABLE IF NOT EXISTS draft_tombstones (
      accountId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      mailboxPath TEXT,
      createdAtMs INTEGER NOT NULL,
      PRIMARY KEY (accountId, messageId)
    );

    CREATE TABLE IF NOT EXISTS calendar_event_suppressions (
      accountId TEXT NOT NULL,
      eventUidKey TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL,
      PRIMARY KEY (accountId, eventUidKey)
    );

    -- Unresolved CalDAV write-back conflicts: a row exists only while an
    -- event changed both locally and on the server since the last sync.
    -- baseIcs/localIcs/remoteIcs are the three full snapshots needed to
    -- render the resolution diff and apply either side without re-fetching.
    CREATE TABLE IF NOT EXISTS calendar_event_conflicts (
      eventId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      eventUid TEXT NOT NULL,
      summary TEXT,
      timeZone TEXT,
      allDay INTEGER NOT NULL DEFAULT 0,
      baseIcs TEXT,
      localIcs TEXT NOT NULL,
      remoteIcs TEXT NOT NULL,
      remoteEtag TEXT,
      localChangedAtMs INTEGER,
      remoteChangedAtMs INTEGER,
      detectedAtMs INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_calendar_event_conflicts_account
      ON calendar_event_conflicts(accountId);
  `);

  ensureSenderIdentityMessageRuntimeSchema(db, inTransaction);
  ensureSpamRuntimeSchema(db, inTransaction);

  // Lightweight schema migration for existing account DBs.
  const messageColumns = new Set(
    (db.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name?: string }>).map((row) =>
      String(row.name ?? "")
    )
  );
  if (!messageColumns.has("sourceSha256")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN sourceSha256 TEXT`).run();
  }
  if (!messageColumns.has("senderKey")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN senderKey TEXT`).run();
  }
  if (!messageColumns.has("categorySignals")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN categorySignals TEXT`).run();
  }
  if (!messageColumns.has("categoryManualState")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN categoryManualState TEXT`).run();
    db.prepare(
      `UPDATE messages
       SET categoryManualState = 'cleared'
       WHERE category IS NULL
         AND COALESCE(categorySignals, '') LIKE '%manual-category:cleared%'`
    ).run();
  }
  if (!messageColumns.has("listUnsubscribe")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN listUnsubscribe TEXT`).run();
  }
  if (!messageColumns.has("listId")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN listId TEXT`).run();
  }
  if (!messageColumns.has("xComposeFormat")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN xComposeFormat TEXT`).run();
  }
  if (!messageColumns.has("quotedHtmlEdited")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN quotedHtmlEdited INTEGER DEFAULT 0`).run();
  }
  if (!messageColumns.has("pendingMoveSourceFolderId")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN pendingMoveSourceFolderId TEXT`).run();
  }
  if (!messageColumns.has("pendingMoveSourceMailboxPath")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN pendingMoveSourceMailboxPath TEXT`).run();
  }
  if (!messageColumns.has("pendingMoveSourceUid")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN pendingMoveSourceUid INTEGER`).run();
  }
  if (!messageColumns.has("pendingMoveStartedAt")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN pendingMoveStartedAt INTEGER`).run();
  }
  if (!messageColumns.has("replyToAddr")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN replyToAddr TEXT`).run();
  }
  if (!messageColumns.has("sizeBytes")) {
    db.prepare(`ALTER TABLE messages ADD COLUMN sizeBytes INTEGER`).run();
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_account_pending_move_source
      ON messages(accountId, pendingMoveSourceFolderId, pendingMoveSourceUid);
    CREATE INDEX IF NOT EXISTS idx_messages_account_pending_move_destination
      ON messages(accountId, folderId, pendingMoveSourceFolderId);
    CREATE INDEX IF NOT EXISTS idx_messages_account_size
      ON messages(accountId, sizeBytes DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_account_folder_size
      ON messages(accountId, folderId, sizeBytes DESC);

    -- perf-sqlite quick-win indexes
    CREATE INDEX IF NOT EXISTS idx_messages_account_folder_messageid
      ON messages(accountId, folderId, messageId);
    CREATE INDEX IF NOT EXISTS idx_messages_account_msgid_date
      ON messages(accountId, lower(messageId), dateValue DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_account_folder_unread
      ON messages(accountId, folderId, unread);
  `);
  ensureThreadOptionalColumns(db);
  ensureTopicOptionalColumns(db);
  ensureMessageCalendarEventOptionalColumns(db);

  // `marker` makes the translation cache content-addressed. Add the column on
  // shards created before it existed; pre-existing rows keep a NULL marker, so
  // they simply miss the marker-matched lookup and are retranslated once.
  const translationColumns = getDbTableColumns(db, "message_translations");
  if (translationColumns.size > 0 && !translationColumns.has("marker")) {
    db.prepare(`ALTER TABLE message_translations ADD COLUMN marker TEXT`).run();
  }

  const reminderColumns = getDbTableColumns(db, "calendar_reminders");
  if (reminderColumns.size > 0) {
    const requiredColumns = [
      "id",
      "accountId",
      "userId",
      "eventTitle",
      "eventStartAtMs",
      "startTimezone",
      "recurrenceRule",
      "recurrenceDates",
      "excludedDates",
      "leadMinutes",
      "leadLabel",
      "createdAtMs",
      "updatedAtMs",
      "deletedAtMs"
    ];
    const requiresRecreate = requiredColumns.some((column) => !reminderColumns.has(column));
    if (requiresRecreate) {
      ensureCalendarReminderTableSchema(db);
    }
    ensureCalendarReminderOptionalColumns(db);
  }
  return ensureAccountKeySchema(db, { inTransaction });
}

function normalizeReminderEventUidKey(uid?: string | null) {
  return normalizeCalendarEventUidKey(uid);
}

function backfillCalendarReminderEventUidKeys(db: any) {
  const rows = db
    .prepare(
      `SELECT id, eventUid
       FROM calendar_reminders
       WHERE COALESCE(eventUid, '') <> ''
         AND COALESCE(eventUidKey, '') = ''`
    )
    .all() as Array<{ id?: string | null; eventUid?: string | null }>;
  if (rows.length === 0) return;
  const updateStatement = db.prepare(
    `UPDATE calendar_reminders
     SET eventUidKey = ?
     WHERE id = ?`
  );
  const runUpdate = db.transaction((items: Array<{ id?: string | null; eventUid?: string | null }>) => {
    items.forEach((row) => {
      const reminderId = (row.id ?? "").trim();
      if (!reminderId) return;
      const eventUidKey = normalizeReminderEventUidKey(row.eventUid ?? undefined);
      if (!eventUidKey) return;
      updateStatement.run(eventUidKey, reminderId);
    });
  });
  runUpdate(rows);
}

const senderIdentityMessageSchemaByDb = new WeakSet<object>();
/** Additive on fresh, legacy, and shared message shards, once per live handle. */
export function ensureSenderIdentityMessageRuntimeSchema(db: any, inTransaction = false) {
  if (senderIdentityMessageSchemaByDb.has(db)) return;
  // Cold readers of migrated shards must never acquire a writer lock.
  const columns = new Set((db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>).map(row => row.name));
  if (!["deliveredTo", "originalTo", "senderIdentityId"].every(name => columns.has(name))) {
    // Recheck under the writer lock: another connection may have migrated first.
    const install = () => ensureTableColumns(db, "messages", [
      ["deliveredTo", "TEXT"], ["originalTo", "TEXT"], ["senderIdentityId", "TEXT"]
    ]);
    if (inTransaction) install();
    else db.transaction(install).immediate();
  }
  if (!inTransaction) senderIdentityMessageSchemaByDb.add(db);
}

const SPAM_MESSAGE_COLUMNS: Array<[string, string]> = [
  ["spamVerdict", "TEXT"], ["spamConfidence", "REAL"], ["spamReasons", "TEXT"], ["spamCheckedAt", "INTEGER"]
];
const spamSchemaByDb = new WeakSet<object>();
/**
 * Additive spam-detection schema (doc/SPAM-DETECTION.md): nullable verdict
 * columns on messages plus the account-scoped `spam_examples` and
 * `spam_sender_profiles` tables. On a v3 shard new tables get their writer
 * guards in the same immediate transaction, so the shard never looks
 * incomplete to another connection.
 */
export function ensureSpamRuntimeSchema(db: any, inTransaction = false) {
  if (spamSchemaByDb.has(db)) return;
  // Cold readers of migrated shards must never acquire a writer lock.
  const installed = () => {
    const columns = getDbTableColumns(db, "messages");
    return SPAM_MESSAGE_COLUMNS.every(([name]) => columns.has(name)) && getDbTableColumns(db, "spam_examples").size > 0
      && getDbTableColumns(db, "spam_sender_profiles").size > 0
      && !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_messages_account_spam'`).get();
  };
  if (!installed()) {
    const install = () => {
      if (installed()) return;
      ensureTableColumns(db, "messages", SPAM_MESSAGE_COLUMNS);
      db.exec(`
        CREATE TABLE IF NOT EXISTS spam_examples (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          messageId TEXT,
          senderEmail TEXT,
          senderDomain TEXT,
          subject TEXT NOT NULL,
          snippet TEXT NOT NULL,
          label TEXT NOT NULL,
          source TEXT NOT NULL,
          decidedByUserId TEXT,
          createdAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_spam_examples_sender ON spam_examples(accountId, senderEmail, createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_spam_examples_domain ON spam_examples(accountId, senderDomain, createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_spam_examples_created ON spam_examples(accountId, createdAt DESC);
        -- Learned sender profiles (lib/mail/spam/senderProfile.ts); patterns is JSON.
        CREATE TABLE IF NOT EXISTS spam_sender_profiles (
          accountId TEXT NOT NULL,
          senderKey TEXT NOT NULL,
          count INTEGER NOT NULL,
          firstSeenAt INTEGER NOT NULL,
          lastSeenAt INTEGER NOT NULL,
          lastUserSpamAt INTEGER,
          patterns TEXT NOT NULL,
          updatedAt INTEGER NOT NULL,
          PRIMARY KEY (accountId, senderKey)
        );
        -- Partial: only checked rows, so it stays tiny and builds instantly on large shards.
        CREATE INDEX IF NOT EXISTS idx_messages_account_spam ON messages(accountId, spamVerdict)
          WHERE spamVerdict IS NOT NULL;
      `);
      // Older shards get their guards from the v3 migration that follows.
      if (assertSupportedShardFormat(db) === SHARD_FORMAT_VERSION) installShardWriterGuards(db);
    };
    if (inTransaction) install();
    else db.transaction(install).immediate();
  }
  if (!inTransaction) spamSchemaByDb.add(db);
}
