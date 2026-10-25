import { createHash, randomUUID } from "crypto";
import type { InviteCode } from "../data";
import { withDbWriteRetry } from "../dbWriteRetry";
import { recordAdminAuditRow } from "./adminAudit";
import { getDb } from "./connection";
import { mapInviteRow } from "./rowParsers";
import { ACTIVE_PROVISIONING } from "./userProvisioning";

export async function getInviteCodes() {
  const db = await getDb();
  const rows = db.prepare(`SELECT * FROM invite_codes`).all() as any[];
  return rows.map(mapInviteRow);
}

export type InviteStatus = "issued" | "redeemed" | "revoked" | "expired";
/** History status; only "issued" codes can still be redeemed. */
export function inviteStatus(invite: Pick<InviteCode, "uses" | "revokedAt" | "expiresAt">, now: number): InviteStatus {
  return invite.uses > 0 ? "redeemed" : invite.revokedAt != null ? "revoked" : invite.expiresAt != null && invite.expiresAt <= now ? "expired" : "issued";
}
// SQL twin of inviteStatus(...) === "issued"; the parameter is "now".
const ISSUED_SQL = "COALESCE(uses,0)=0 AND revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt>?)";

// Stable history identity, deliberately unrelated to the redeemable capability's format.
export function inviteHistoryId(code: string) {
  return createHash("sha256").update(`noctua-invite-history:${code}`).digest("hex");
}

export type InviteHistoryRow = InviteCode & { issuerName: string | null; issuerEmail: string | null };
/** Invite rows with the issuing user's name and email (null for operator codes or deleted issuers). */
export async function getInviteHistory(): Promise<InviteHistoryRow[]> {
  const db = await getDb();
  const rows = db.prepare(`SELECT i.*, u.name AS issuerName, u.email AS issuerEmail
    FROM invite_codes i LEFT JOIN auth_user u ON u.id=i.issuedByUserId`).all() as any[];
  return rows.map(row => ({ ...mapInviteRow(row), issuerName: row.issuerName || null, issuerEmail: row.issuerEmail || null }));
}

/**
 * Deletes redeemed, expired and revoked codes. Issued codes stay, and so does any
 * code an in-flight sign-up still has to claim.
 */
export async function deleteSettledInviteCodes(actorUserId: string, now = Date.now()) {
  return withDbWriteRetry("deleteSettledInviteCodes", async () => {
    const db = await getDb();
    return db.transaction(() => {
      const deleted = db.prepare(`DELETE FROM invite_codes WHERE NOT (${ISSUED_SQL})
        AND code NOT IN (SELECT inviteCode FROM user_provisioning WHERE inviteCode IS NOT NULL AND state IN ${ACTIVE_PROVISIONING})`).run(now).changes;
      if (deleted > 0) recordAdminAuditRow(db, { actorUserId, action: "invite.cleanup", payload: { count: deleted } });
      return deleted;
    }).immediate();
  });
}

/** Revokes one issued code by its history id; false if it is unknown or no longer issued. */
export async function revokeInviteCode(historyId: string, actorUserId: string, now = Date.now()) {
  return withDbWriteRetry("revokeInviteCode", async () => {
    const db = await getDb();
    return db.transaction(() => {
      const invite = (db.prepare(`SELECT code, email FROM invite_codes WHERE ${ISSUED_SQL}`).all(now) as { code: string; email: string | null }[])
        .find(row => inviteHistoryId(row.code) === historyId);
      if (!invite || db.prepare(`UPDATE invite_codes SET revokedAt=? WHERE code=? AND ${ISSUED_SQL}`).run(now, invite.code, now).changes !== 1) return false;
      recordAdminAuditRow(db, { actorUserId, action: "invite.revoke", payload: { reason: "admin_revoked", count: 1, email: invite.email } });
      return true;
    }).immediate();
  });
}

export async function createInviteCode(options?: {
  role?: InviteCode["role"];
  maxUses?: number | null;
  expiresAt?: number | null;
  email?: string | null;
}) {
  return withDbWriteRetry("createInviteCode", async () => {
    const db = await getDb();
    const maxUses =
      options?.maxUses === undefined
        ? 1
        : options.maxUses === null
          ? null
          : Math.max(1, Math.floor(options.maxUses));
    const expiresAt =
      typeof options?.expiresAt === "number" && Number.isFinite(options.expiresAt)
        ? Math.floor(options.expiresAt)
        : null;
    const invite: InviteCode = {
      code: randomUUID(),
      role: options?.role === "admin" ? "admin" : "user",
      maxUses,
      uses: 0,
      expiresAt,
      createdAt: Date.now(),
      usedByUserId: null,
      email: options?.email?.trim().toLowerCase() || null
    };
    db.prepare(
      `INSERT INTO invite_codes (code, role, maxUses, uses, expiresAt, createdAt, usedByUserId,email,issuedByUserId,provenance,revokedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invite.code,
      invite.role,
      invite.maxUses,
      invite.uses,
      invite.expiresAt,
      invite.createdAt,
      invite.usedByUserId,
      invite.email ?? null,
      null, "operator", null
    );
    return invite;
  });
}

export async function saveInviteCodes(items: InviteCode[]) {
  return withDbWriteRetry("saveInviteCodes", async () => {
    const db = await getDb();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO invite_codes
       (code, role, maxUses, uses, expiresAt, createdAt, usedByUserId,email,issuedByUserId,provenance,revokedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    db.transaction(() => {
      db.exec(`DELETE FROM invite_codes`);
      items.forEach((it) =>
        insert.run(
          it.code,
          it.role,
          it.maxUses,
          it.uses,
          it.expiresAt,
          Number.isFinite(it.createdAt) ? Math.floor(it.createdAt) : 0,
          it.usedByUserId ?? null,
          it.email ?? null,
          it.issuedByUserId ?? null,
          it.provenance ?? "operator",
          it.revokedAt ?? null
        )
      );
    })();
  });
}
