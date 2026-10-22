import { getDb } from "./db/connection";

/** Flag and actual verified factor must agree; a flag alone never grants access. */
export async function isMfaEnrollmentComplete(userId: string) {
  const db = await getDb();
  const row = db.prepare(`SELECT u.twoFactorEnabled,
    (SELECT COUNT(*) FROM auth_two_factor f WHERE f.userId=u.id) AS factors,
    (SELECT COUNT(*) FROM auth_two_factor f WHERE f.userId=u.id AND f.verified=1 AND length(trim(f.secret))>0) AS verified
    FROM auth_user u WHERE u.id=?`).get(userId) as { twoFactorEnabled: number; factors: number; verified: number } | undefined;
  const complete = row?.twoFactorEnabled === 1 && row.factors === 1 && row.verified === 1;
  const inconsistent = !!row && ((row.twoFactorEnabled === 1) !== (row.verified === 1) || row.factors > 1);
  return { complete, inconsistent };
}
