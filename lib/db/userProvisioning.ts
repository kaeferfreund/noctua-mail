import type { Database } from "bun:sqlite";
import type { Account } from "../data";
import { AuthPolicyError } from "./authPolicy";
import { withDbWriteRetry } from "../dbWriteRetry";
import { persistAccountRow } from "./rowParsers";
import { insertUserAccountLinkRow } from "./users";
import { recordAdminAuditRow } from "./adminAudit";

export const ACTIVE_PROVISIONING = "('reserved','auth_created','cleanup_required')";
export type ProvisioningOperation = { id:string; userId:string; normalizedEmail:string; inviteCode:string|null; kind:string; state:string; createdAt:number };
export const enabledAdminSql = `(role='admin' AND NOT (COALESCE(banned,0)=1 AND (banExpires IS NULL OR julianday(banExpires)>julianday('now')))
  AND NOT EXISTS(SELECT 1 FROM user_provisioning op WHERE op.userId=auth_user.id AND op.kind='signup' AND op.state IN ${ACTIVE_PROVISIONING}))`;

export function assertNewIdentity(db:Database, email:string, account?:Account) {
  if (db.prepare(`SELECT 1 FROM users WHERE lower(trim(email))=? UNION ALL SELECT 1 FROM auth_user WHERE lower(trim(email))=?`).get(email,email)) throw new AuthPolicyError("user_exists",409);
  if (account && db.prepare(`SELECT 1 FROM accounts WHERE id=? OR lower(trim(email))=?`).get(account.id,account.email)) throw new AuthPolicyError("mailbox_exists",409);
  // A personal identity must not claim the address of an existing shared mailbox.
  if (db.prepare(`SELECT 1 FROM accounts a WHERE lower(trim(a.email))=? AND (a.ownerUserId IS NULL OR
    EXISTS(SELECT 1 FROM user_accounts ua WHERE ua.accountId=a.id AND ua.userId<>a.ownerUserId))`).get(email)) throw new AuthPolicyError("mailbox_exists",409);
}

/** Checked before network, in reservation, and again in the final transaction. */
export function assertInviteAuthority(db:Database, code:string, email:string) {
  const invite = db.prepare(`SELECT * FROM invite_codes WHERE code=?`).get(code) as {role:string;email:string|null;expiresAt:number|null;maxUses:number|null;uses:number;issuedByUserId:string|null;provenance:string;revokedAt:number|null}|null;
  if (!invite || invite.revokedAt !== null || (invite.email && invite.email.trim().toLowerCase() !== email) || (invite.expiresAt !== null && invite.expiresAt <= Date.now()) ||
      (invite.provenance === "admin" ? !invite.issuedByUserId || !db.prepare(`SELECT 1 FROM auth_user WHERE id=? AND ${enabledAdminSql}`).get(invite.issuedByUserId) : invite.provenance !== "operator" || invite.issuedByUserId !== null)) throw new AuthPolicyError("invalid_invite",403);
  return invite;
}

/** Read-only preflight also runs in the reservation transaction after network verification. */
export function validateSignupInvite(db:Database, code:string, email:string) {
  const invite = assertInviteAuthority(db,code,email);
  const reserved = db.prepare(`SELECT count(*) n FROM user_provisioning WHERE inviteCode=? AND kind='signup' AND state IN ${ACTIVE_PROVISIONING}`).get(code).n;
  if (invite.maxUses !== null && invite.uses + reserved >= invite.maxUses) throw new AuthPolicyError("invite_exhausted",409);
  const empty = !db.prepare(`SELECT 1 FROM users p WHERE NOT EXISTS(SELECT 1 FROM user_provisioning op WHERE op.userId=p.id AND op.kind='signup' AND op.state IN ${ACTIVE_PROVISIONING}) LIMIT 1`).get();
  if (empty) {
    if (invite.role !== "admin") throw new AuthPolicyError("bootstrap_invite_required",403);
    if (db.prepare(`SELECT 1 FROM user_provisioning WHERE kind='signup' AND state IN ${ACTIVE_PROVISIONING} LIMIT 1`).get()) throw new AuthPolicyError("bootstrap_pending",409);
  }
  if (!empty && invite.role==="admin" && !invite.email) throw new AuthPolicyError("bootstrap_invite_closed",403);
  if (!["admin","user"].includes(invite.role)) throw new AuthPolicyError("invalid_invite",403);
  return invite.role as "admin"|"user";
}

export async function reserveProvisioning(db:Database, email:string, code:string, account?:Account) {
  return withDbWriteRetry("reserveProvisioning",()=>db.transaction(()=>{
    assertNewIdentity(db,email,account);
    if (db.prepare(`SELECT 1 FROM user_provisioning WHERE normalizedEmail=? AND state IN ${ACTIVE_PROVISIONING}`).get(email)) throw new AuthPolicyError("provisioning_pending",409);
    const role=validateSignupInvite(db,code,email);
    const id=crypto.randomUUID(), userId=crypto.randomUUID(), now=Date.now();
    db.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,inviteCode,kind,state,createdAt,updatedAt) VALUES(?,?,?,?,'signup','reserved',?,?)`).run(id,userId,email,code,now,now);
    return {id,userId,normalizedEmail:email,inviteCode:code,kind:"signup",state:"reserved",createdAt:now,role};
  }).immediate());
}

export async function finalizeProvisioning(db:Database, op:ProvisioningOperation, account?:Account) {
  await withDbWriteRetry("finalizeProvisioning",()=>db.transaction(()=>{
    const live=db.prepare(`SELECT state FROM user_provisioning WHERE id=? AND userId=?`).get(op.id,op.userId);
    if (live?.state === "complete") return;
    if (live?.state !== "auth_created" || !db.prepare(`SELECT 1 FROM auth_user a JOIN users p ON p.id=a.id JOIN auth_account c ON c.userId=a.id WHERE a.id=? AND c.providerId='credential' AND c.password IS NOT NULL`).get(op.userId)) throw new AuthPolicyError("provisioning_incomplete",409);
    assertInviteAuthority(db,op.inviteCode!,op.normalizedEmail);
    if (account) {
      if (db.prepare(`SELECT 1 FROM accounts WHERE id=? OR lower(trim(email))=?`).get(account.id,account.email)) throw new AuthPolicyError("mailbox_exists",409);
      persistAccountRow(db,{...account,ownerUserId:op.userId},undefined,true);
      insertUserAccountLinkRow(db,op.userId,account.id,"manager");
    }
    if (db.prepare(`UPDATE invite_codes SET uses=uses+1,usedByUserId=COALESCE(usedByUserId,?) WHERE code=? AND (expiresAt IS NULL OR expiresAt>?) AND (maxUses IS NULL OR uses<maxUses)`).run(op.userId,op.inviteCode,Date.now()).changes!==1) throw new AuthPolicyError("invalid_invite",409);
    recordAdminAuditRow(db,{actorUserId:op.userId,action:"user.create",targetUserId:op.userId,payload:{operationId:op.id}});
    db.prepare(`UPDATE user_provisioning SET state='complete',updatedAt=? WHERE id=?`).run(Date.now(),op.id);
  }).immediate());
}

/** Exact reserved ID only; complete operations and their invite claims are never compensated. */
export async function compensateProvisioning(db:Database, operationId:string) {
  return withDbWriteRetry("compensateProvisioning",()=>db.transaction(()=>{
    const op=db.prepare(`SELECT * FROM user_provisioning WHERE id=? AND kind='signup' AND state IN ${ACTIVE_PROVISIONING}`).get(operationId) as ProvisioningOperation|null;
    if (!op) return;
    // Final mailbox/member/claim writes are atomic with complete, so no shard ever exists here.
    db.prepare(`DELETE FROM auth_user WHERE id=?`).run(op.userId);
    db.prepare(`DELETE FROM users WHERE id=?`).run(op.userId);
    db.prepare(`UPDATE user_provisioning SET state='cancelled',updatedAt=? WHERE id=?`).run(Date.now(),op.id);
  }).immediate());
}

export async function reconcileProvisioning(db:Database, before:number) {
  const pending=db.prepare(`SELECT id FROM user_provisioning WHERE kind='signup' AND state IN ${ACTIVE_PROVISIONING} AND createdAt<?`).all(before) as {id:string}[];
  for (const op of pending) await compensateProvisioning(db,op.id);
}
