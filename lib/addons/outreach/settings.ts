import { OUTREACH_DEFAULT_IP_RETENTION_DAYS, OUTREACH_DEFAULT_SEND_RATE_PER_MINUTE } from "./config";
import { getOutreachDb } from "./db";
import { OUTREACH_TRANSPORTS, type OutreachAccountSettings, type OutreachSettingsPatch, type OutreachTransport } from "./types";

type Row = {
  accountId: string; enabled: number; transport: string; senderIdentityId: string | null; trackMailDefault: number;
  ipRetentionDays: number; sendRatePerMinute: number; organizationName: string; organizationAddress: string; updatedAt: number;
};

export function defaultOutreachSettings(accountId: string): OutreachAccountSettings {
  return { accountId, enabled: false, transport: "ses", senderIdentityId: null, trackMailDefault: false,
    ipRetentionDays: OUTREACH_DEFAULT_IP_RETENTION_DAYS, sendRatePerMinute: OUTREACH_DEFAULT_SEND_RATE_PER_MINUTE,
    organizationName: "", organizationAddress: "", updatedAt: null };
}

function fromRow(row: Row): OutreachAccountSettings {
  return { accountId: row.accountId, enabled: row.enabled === 1,
    transport: (OUTREACH_TRANSPORTS as readonly string[]).includes(row.transport) ? row.transport as OutreachTransport : "ses",
    senderIdentityId: row.senderIdentityId, trackMailDefault: row.trackMailDefault === 1, ipRetentionDays: row.ipRetentionDays,
    sendRatePerMinute: row.sendRatePerMinute, organizationName: row.organizationName, organizationAddress: row.organizationAddress,
    updatedAt: row.updatedAt };
}

/** Settings of one mailbox; defaults (not activated) when the mailbox has no row. */
export async function getOutreachSettings(accountId: string): Promise<OutreachAccountSettings> {
  const db = await getOutreachDb();
  const row = db.prepare("SELECT * FROM account_settings WHERE accountId = ?").get(accountId) as Row | null;
  return row ? fromRow(row) : defaultOutreachSettings(accountId);
}

/** Whether the addon is activated for the mailbox. The server flag is checked by the caller. */
export async function isOutreachEnabledForAccount(accountId: string): Promise<boolean> {
  return (await getOutreachSettings(accountId)).enabled;
}

export async function listOutreachSettings(accountIds: readonly string[]): Promise<OutreachAccountSettings[]> {
  if (!accountIds.length) return [];
  const db = await getOutreachDb();
  const rows = db.prepare(`SELECT * FROM account_settings WHERE accountId IN (${accountIds.map(() => "?").join(",")})`).all(...accountIds) as Row[];
  return rows.map(fromRow);
}

export class OutreachSettingsError extends Error {}

/** Validates and normalizes a patch; throws `OutreachSettingsError` with a user-facing message. */
export function normalizeOutreachSettingsPatch(input: unknown): OutreachSettingsPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OutreachSettingsError("Invalid settings");
  const source = input as Record<string, unknown>;
  const patch: OutreachSettingsPatch = {};
  const bool = (name: "enabled" | "trackMailDefault") => {
    if (source[name] === undefined) return;
    if (typeof source[name] !== "boolean") throw new OutreachSettingsError(`${name} must be a boolean`);
    patch[name] = source[name];
  };
  const text = (name: "organizationName" | "organizationAddress", max: number) => {
    if (source[name] === undefined) return;
    if (typeof source[name] !== "string" || source[name].length > max) throw new OutreachSettingsError(`${name} must be a string of at most ${max} characters`);
    patch[name] = source[name].trim();
  };
  const int = (name: "ipRetentionDays" | "sendRatePerMinute", min: number, max: number) => {
    if (source[name] === undefined) return;
    const value = source[name];
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new OutreachSettingsError(`${name} must be an integer from ${min} to ${max}`);
    patch[name] = value;
  };
  bool("enabled");
  bool("trackMailDefault");
  text("organizationName", 200);
  text("organizationAddress", 500);
  int("ipRetentionDays", 0, 730);
  int("sendRatePerMinute", 1, 600);
  if (source.transport !== undefined) {
    if (!(OUTREACH_TRANSPORTS as readonly unknown[]).includes(source.transport)) throw new OutreachSettingsError("transport must be 'ses' or 'mailbox-smtp'");
    patch.transport = source.transport as OutreachTransport;
  }
  if (source.senderIdentityId !== undefined) {
    if (source.senderIdentityId !== null && (typeof source.senderIdentityId !== "string" || !source.senderIdentityId.trim() || source.senderIdentityId.length > 256)) {
      throw new OutreachSettingsError("senderIdentityId must be a sender identity id or null");
    }
    patch.senderIdentityId = source.senderIdentityId === null ? null : (source.senderIdentityId as string).trim();
  }
  return patch;
}

export async function saveOutreachSettings(accountId: string, patch: OutreachSettingsPatch, userId: string, now = Date.now()): Promise<OutreachAccountSettings> {
  const db = await getOutreachDb();
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM account_settings WHERE accountId = ?").get(accountId) as Row | null;
    const next = { ...(row ? fromRow(row) : defaultOutreachSettings(accountId)), ...patch, updatedAt: now };
    db.prepare(`INSERT INTO account_settings (accountId, enabled, transport, senderIdentityId, trackMailDefault, ipRetentionDays,
        sendRatePerMinute, organizationName, organizationAddress, updatedAt, updatedByUserId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(accountId) DO UPDATE SET enabled = excluded.enabled, transport = excluded.transport,
        senderIdentityId = excluded.senderIdentityId, trackMailDefault = excluded.trackMailDefault,
        ipRetentionDays = excluded.ipRetentionDays, sendRatePerMinute = excluded.sendRatePerMinute,
        organizationName = excluded.organizationName, organizationAddress = excluded.organizationAddress,
        updatedAt = excluded.updatedAt, updatedByUserId = excluded.updatedByUserId`)
      .run(accountId, next.enabled ? 1 : 0, next.transport, next.senderIdentityId, next.trackMailDefault ? 1 : 0, next.ipRetentionDays,
        next.sendRatePerMinute, next.organizationName, next.organizationAddress, now, userId);
    return next;
  }).immediate();
}
