import type { Database } from "bun:sqlite";
import { withDbWriteRetry } from "../dbWriteRetry";
import { AuthPolicyError, enrollmentState, readGeneration, readSessionSecurity, type SessionSecurity } from "./authPolicy";
import { enabledAdminSql } from "./userProvisioning";

export type LifecycleOperation={id:string;actorUserId:string;targetUserId:string;action:string;payload:string;state:string;createdAt:number};
export function assertAdminActor(db:Database, source:SessionSecurity) {
  const live=readSessionSecurity(db,source.sessionId);
  if (live.userId!==source.userId || live.assurance!=="mfa" || !enrollmentState(db,source.userId).complete || !db.prepare(`SELECT 1 FROM auth_user WHERE id=? AND ${enabledAdminSql}`).get(source.userId)) throw new AuthPolicyError("admin_required");
}

/** Global slot is acquired first; user slots cannot invert the admin/security lock order. */
export async function reserveLifecycle(db:Database, actor:SessionSecurity|"operator", targetUserId:string, action:string, payload:Record<string,unknown>) {
  return withDbWriteRetry("reserveLifecycle",()=>db.transaction(()=>{
    if (actor!=="operator") assertAdminActor(db,actor);
    if (db.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot='admin-lifecycle'`).get()) throw new AuthPolicyError("admin_operation_pending",409);
    const id=crypto.randomUUID(),now=Date.now(),actorUserId=actor==="operator"?"operator":actor.userId;
    db.prepare(`INSERT INTO admin_lifecycle_operations(id,slot,actorUserId,targetUserId,action,payload,state,createdAt,updatedAt) VALUES(?,'admin-lifecycle',?,?,?,?,'reserved',?,?)`).run(id,actorUserId,targetUserId,action,JSON.stringify(payload),now,now);
    return {id,actorUserId,targetUserId,action,payload:JSON.stringify(payload),state:"reserved",createdAt:now};
  }).immediate());
}

export async function takeLifecycleUserSlot(db:Database, op:LifecycleOperation, userId=op.targetUserId) {
  return withDbWriteRetry("takeLifecycleUserSlot",()=>db.transaction(()=>{
    assertLifecycle(db,op);
    if (db.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot=?`).get(`security:${userId}`)) throw new AuthPolicyError("security_operation_pending",409);
    const generation=db.prepare(`SELECT generation FROM auth_security_state WHERE userId=?`).get(userId)?.generation;
    if (!Number.isSafeInteger(generation)) throw new AuthPolicyError("user_not_found",404);
    const id=crypto.randomUUID(),now=Date.now();
    db.prepare(`INSERT INTO admin_lifecycle_operations(id,slot,actorUserId,targetUserId,action,payload,state,createdAt,updatedAt) VALUES(?,?,?,?,?,?,'reserved',?,?)`).run(id,`security:${userId}`,op.actorUserId,userId,"lifecycle.security",JSON.stringify({parentId:op.id}),now,now);
    return {id,userId,generation,action:"lifecycle.security"};
  }).immediate());
}
export function assertLifecycle(db:Database,op:LifecycleOperation) {
  if (!db.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE id=? AND slot='admin-lifecycle'`).get(op.id)) throw new AuthPolicyError("admin_state_changed",409);
}
export async function finishLifecycle(db:Database,op:LifecycleOperation,state="complete") {
  await withDbWriteRetry("finishLifecycle",()=>db.transaction(()=>{
    db.prepare(`UPDATE admin_lifecycle_operations SET slot=NULL,state=?,updatedAt=? WHERE id=? OR (action='lifecycle.security' AND json_extract(payload,'$.parentId')=?)`).run(state,Date.now(),op.id,op.id);
  }).immediate());
}
export function assertTargetPolicy(db:Database,op:LifecycleOperation,changes:{role?:unknown;disabled?:unknown},deleting=false) {
  const target=db.prepare(`SELECT id,role,${enabledAdminSql} AS enabledAdmin FROM auth_user WHERE id=?`).get(op.targetUserId);
  if (!target) throw new AuthPolicyError("user_not_found",404);
  const losingAdmin=deleting || changes.disabled===true || changes.role==="user";
  if (op.actorUserId===op.targetUserId && losingAdmin) throw new AuthPolicyError("self_admin_mutation_forbidden");
  if (target.enabledAdmin && losingAdmin && db.prepare(`SELECT count(*) n FROM auth_user WHERE ${enabledAdminSql}`).get().n<=1) throw new AuthPolicyError("last_admin");
  return target;
}
export function assertEnabledTarget(db:Database,userId:string) { readGeneration(db,userId); }
