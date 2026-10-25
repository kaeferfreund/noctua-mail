import { withDbWriteRetry } from "../dbWriteRetry";
import { getDb } from "./connection";
import { recordAdminAuditRow } from "./adminAudit";

/** One admin-uploaded domain icon; the PNG bytes live in the data dir. */
export type DomainIconRow = {
  domain: string;
  /** sha256 hex of the stored PNG bytes. */
  hash: string;
  size: number;
  updatedAt: number;
  updatedByUserId: string | null;
};

const COLUMNS = "domain, hash, size, updatedAt, updatedByUserId";

export async function getDomainIconRow(domain: string): Promise<DomainIconRow | null> {
  const db = await getDb();
  return (db.prepare(`SELECT ${COLUMNS} FROM domain_icons WHERE domain = ?`).get(domain) as DomainIconRow | undefined) ?? null;
}

export async function listDomainIconRows(): Promise<DomainIconRow[]> {
  const db = await getDb();
  return db.prepare(`SELECT ${COLUMNS} FROM domain_icons ORDER BY domain`).all() as DomainIconRow[];
}

/** Upserts the row and writes the admin-log entry in one transaction. */
export async function saveDomainIconRow(input: { domain: string; hash: string; size: number; userId: string }) {
  const db = await getDb();
  return withDbWriteRetry("saveDomainIconRow", () => db.transaction(() => {
    db.prepare(`INSERT INTO domain_icons (domain, hash, size, updatedAt, updatedByUserId) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET hash = excluded.hash, size = excluded.size,
        updatedAt = excluded.updatedAt, updatedByUserId = excluded.updatedByUserId`)
      .run(input.domain, input.hash, input.size, Date.now(), input.userId);
    recordAdminAuditRow(db, { actorUserId: input.userId, action: "domain_icon.upload", payload: { domain: input.domain, size: input.size } });
  }).immediate());
}

/** Removes the row (and logs it) when one exists; returns whether it did. */
export async function deleteDomainIconRow(domain: string, userId: string): Promise<boolean> {
  const db = await getDb();
  return withDbWriteRetry("deleteDomainIconRow", () => db.transaction(() => {
    const removed = db.prepare(`DELETE FROM domain_icons WHERE domain = ?`).run(domain).changes > 0;
    if (removed) recordAdminAuditRow(db, { actorUserId: userId, action: "domain_icon.reset", payload: { domain } });
    return removed;
  }).immediate());
}
