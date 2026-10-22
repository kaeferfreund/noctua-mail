import { detachUserDomainRows, deleteUserProfileRow } from "./db/users";
import type { Database } from "bun:sqlite";
import type { NoctuaAuth } from "./betterAuth";
import { AuthPolicyError, consumeReauthGrant } from "./authPolicy";
import { strictFields } from "./authSecurity";
import { withAuthProof } from "./authPolicyContext";
import { withResetDelivery, resetCallback } from "./authRecoveryContext";
import { advanceSecurityGeneration, readSessionSecurity, type SessionSecurity } from "./db/authPolicy";
import { assertAdminActor, assertEnabledTarget, assertLifecycle, assertTargetPolicy, reserveLifecycle, takeLifecycleUserSlot, finishLifecycle, type LifecycleOperation } from "./db/userLifecycle";
import { assertNewIdentity, ACTIVE_PROVISIONING } from "./db/userProvisioning";
import { recordAdminAuditRow } from "./db/adminAudit";
import { personalEmailSchema } from "./userProvisioning";
import { withDbWriteRetry } from "./dbWriteRetry";
import { cleanupUserAccountAccess } from "./membershipCleanup";
import { revokeAuthStreams } from "./authStreams";

type Cleanup=typeof cleanupUserAccountAccess;
function parseName(value:unknown) {
  if (typeof value!=="string" || !value.trim() || value.trim().length>256) throw new AuthPolicyError("invalid_request",400);
  return value.trim();
}
export async function issueOnboardingInvite(db:Database,source:SessionSecurity,body:unknown) {
  strictFields(body,["email","name","role"]);
  const parsed=personalEmailSchema.safeParse(body.email),name=parseName(body.name);
  if (!parsed.success || !["admin","user"].includes(body.role as string)) throw new AuthPolicyError("invalid_request",400);
  return issueInvite(db,source,{email:parsed.data,name,role:body.role as "admin"|"user"});
}

export async function issueGenericInvite(db:Database,source:SessionSecurity,body:unknown) {
  strictFields(body,[]);
  return issueInvite(db,source,{email:null,role:"user"});
}

async function issueInvite(db:Database,source:SessionSecurity,input:{email:string|null;name?:string;role:"admin"|"user"}) {
  const op=await reserveLifecycle(db,source,"","user.invite",{});
  try {
    return await withDbWriteRetry("issueInvite",()=>db.transaction(()=>{
      assertAdminActor(db,source);assertLifecycle(db,op);
      if(input.email)assertNewIdentity(db,input.email);
      const invite={code:crypto.randomUUID(),email:input.email,role:input.role,maxUses:1,uses:0,createdAt:Date.now(),expiresAt:input.email?Date.now()+86400000:null,usedByUserId:null,issuedByUserId:source.userId,provenance:"admin" as const,revokedAt:null};
      db.prepare(`INSERT INTO invite_codes(code,email,role,maxUses,uses,createdAt,expiresAt,issuedByUserId,provenance) VALUES(?,?,?,1,0,?,?,?,'admin')`).run(invite.code,invite.email,invite.role,invite.createdAt,invite.expiresAt,source.userId);
      recordAdminAuditRow(db,{actorUserId:source.userId,action:"user.create",payload:{...input,stage:"invited"}});
      return {ok:true,invite};
    }).immediate());
  } finally { await finishLifecycle(db,op); }
}

async function markStarted(db:Database,op:LifecycleOperation) {
  await withDbWriteRetry("startLifecycle",()=>db.prepare(`UPDATE admin_lifecycle_operations SET state='applying',updatedAt=? WHERE id=?`).run(Date.now(),op.id));
}
async function revokeTarget(db:Database,userId:string) {
  await withDbWriteRetry("revokeLifecycleTarget",()=>db.transaction(()=>{advanceSecurityGeneration(db,userId);}).immediate());
  revokeAuthStreams({userId});
}

async function authorizeAdminSecurity(db:Database,op:LifecycleOperation,actor:SessionSecurity|"operator",request:Request|null) {
  if (actor!=="operator") {
    const actorSlot=await takeLifecycleUserSlot(db,op,actor.userId);
    await consumeReauthGrant(db,request?.headers.get("x-noctua-reauth")??null,actor,"admin.recovery",actorSlot);
  }
  if (actor==="operator" || actor.userId!==op.targetUserId) await takeLifecycleUserSlot(db,op);
}

export type AdminSecurityAction="mfa-reset"|"passkey-remove"|"sessions-revoke";
export async function mutateAdminSecurity(db:Database,source:SessionSecurity,request:Request,userId:string,body:unknown,action:AdminSecurityAction,passkeyId?:string) {
  strictFields(body,action==="mfa-reset"?["confirmedTarget"]:[]);
  if (action==="mfa-reset" && body.confirmedTarget!==true) throw new AuthPolicyError("target_verification_required",400);
  const op=await reserveLifecycle(db,source,userId,`user.${action}`,{});
  let started=false;
  try {
    assertTargetPolicy(db,op,{});
    await authorizeAdminSecurity(db,op,source,request);
    if (action==="passkey-remove" && !db.prepare(`SELECT 1 FROM auth_passkey WHERE userId=? AND id=?`).get(userId,passkeyId??"")) throw new AuthPolicyError("passkey_not_found",404);
    await markStarted(db,op);started=true;
    await withDbWriteRetry("mutateAdminSecurity",()=>db.transaction(()=>{
      assertLifecycle(db,op);
      if (action==="passkey-remove" && !db.prepare(`SELECT 1 FROM auth_passkey WHERE userId=? AND id=?`).get(userId,passkeyId??"")) throw new AuthPolicyError("passkey_not_found",404);
      advanceSecurityGeneration(db,userId);
      if (action==="mfa-reset") {
        db.prepare(`DELETE FROM auth_two_factor WHERE userId=?`).run(userId);
        db.prepare(`UPDATE auth_user SET twoFactorEnabled=0 WHERE id=?`).run(userId);
        db.prepare(`INSERT OR IGNORE INTO noctua_auth_migrations(id) VALUES(?)`).run(`mfa-enrolled:${userId}`);
      }
      if (action==="passkey-remove") db.prepare(`DELETE FROM auth_passkey WHERE userId=? AND id=?`).run(userId,passkeyId!);
      recordAdminAuditRow(db,{actorUserId:source.userId,action:action==="mfa-reset"?"user.mfa_reset":action==="passkey-remove"?"user.passkey_remove":"user.sessions_revoke",targetUserId:userId,payload:{operationId:op.id,...(action==="mfa-reset"?{confirmedTarget:true}:{})}});
    }).immediate());
    revokeAuthStreams({userId});
    await finishLifecycle(db,op);
    return {ok:true,...(action==="mfa-reset"?{enrollmentRequired:true}:{})};
  } catch(error) {if(!started)await finishLifecycle(db,op,"cancelled");throw error;}
}

/** The user security slot gates mail/MCP throughout library awaits and failed finalizers. */
export async function updateUserLifecycle(auth:NoctuaAuth,db:Database,source:SessionSecurity,request:Request,userId:string,body:unknown) {
  strictFields(body,["name","role","disabled"]);
  if (!Object.keys(body).length || (body.role!==undefined && !["admin","user"].includes(body.role as string)) || (body.disabled!==undefined && typeof body.disabled!=="boolean")) throw new AuthPolicyError("invalid_request",400);
  const changes:{name?:string;role?:"admin"|"user";disabled?:boolean}={
    ...(body.name===undefined?{}:{name:parseName(body.name)}),
    ...(body.role===undefined?{}:{role:body.role as "admin"|"user"}),
    ...(body.disabled===undefined?{}:{disabled:body.disabled as boolean})};
  const op=await reserveLifecycle(db,source,userId,"user.update",changes);
  let started=false;
  try {
    assertTargetPolicy(db,op,changes);
    await takeLifecycleUserSlot(db,op);
    assertAdminActor(db,source);
    await markStarted(db,op);started=true;
    await withAuthProof({db,internal:true,source,authenticatedAt:source.authenticatedAt,method:source.method,createdSessionIds:[]},async()=>{
      if (changes.name!==undefined) await auth.api.adminUpdateUser({headers:request.headers,body:{userId,data:{name:changes.name}}});
      if (changes.role!==undefined) await auth.api.setRole({headers:request.headers,body:{userId,role:changes.role as "admin"|"user"}});
      if (changes.disabled===true) await auth.api.banUser({headers:request.headers,body:{userId,banReason:"Disabled by administrator"}});
      if (changes.disabled===false) await auth.api.unbanUser({headers:request.headers,body:{userId}});
    });
    await revokeTarget(db,userId);
    await withDbWriteRetry("auditUserLifecycle",()=>db.transaction(()=>{
      assertLifecycle(db,op);
      // A disable is permanent, including a user who previously had a temporary ban.
      if (changes.disabled===true) db.prepare(`UPDATE auth_user SET banExpires=NULL WHERE id=?`).run(userId);
      recordAdminAuditRow(db,{actorUserId:source.userId,action:changes.disabled===true?"user.disable":changes.disabled===false?"user.enable":"user.update",targetUserId:userId,payload:changes});
    }).immediate());
    await finishLifecycle(db,op);
    return {ok:true};
  } catch (error) {
    if (!started) await finishLifecycle(db,op,"cancelled");
    throw error;
  }
}

type DeletePayload={reassignOwnerTo?:string;accountIds:string[]};
async function cleanDeletedUser(db:Database,op:LifecycleOperation,cleanup:Cleanup) {
  const payload=JSON.parse(op.payload) as DeletePayload;
  await withDbWriteRetry("detachDeletedUser",()=>db.transaction(()=>{
    assertLifecycle(db,op);
    db.prepare(`UPDATE auth_user SET banned=1,banExpires=NULL WHERE id=?`).run(op.targetUserId);
    if (db.prepare(`SELECT 1 FROM auth_security_state WHERE userId=?`).get(op.targetUserId)) advanceSecurityGeneration(db,op.targetUserId);
    if (payload.reassignOwnerTo) {
      // Recheck the recorded replacement at every retry; never leave a dangling owner.
      try {assertEnabledTarget(db,payload.reassignOwnerTo);} catch {throw new AuthPolicyError("invalid_owner",409);}
    }
    if (!payload.reassignOwnerTo && db.prepare(`SELECT 1 FROM accounts WHERE ownerUserId=?`).get(op.targetUserId)) throw new AuthPolicyError("owner_reassignment_required",409);
    detachUserDomainRows(db,op.targetUserId,payload.reassignOwnerTo);
    db.prepare(`UPDATE admin_lifecycle_operations SET state='cleanup_pending',updatedAt=? WHERE id=?`).run(Date.now(),op.id);
  }).immediate());
  revokeAuthStreams({userId:op.targetUserId});
  for (const accountId of payload.accountIds) await cleanup(accountId,op.targetUserId,{userId:op.actorUserId==="operator"?null:op.actorUserId,clientId:"system"});
}

async function completeDeletion(db:Database,op:LifecycleOperation) {
  await withDbWriteRetry("completeUserDeletion",()=>db.transaction(()=>{
    if (db.prepare(`SELECT state FROM admin_lifecycle_operations WHERE id=?`).get(op.id)?.state==="deleted") return;
    deleteUserProfileRow(db,op.targetUserId);
    recordAdminAuditRow(db,{actorUserId:op.actorUserId,action:"user.delete",targetUserId:op.targetUserId,payload:{operationId:op.id}});
    db.prepare(`UPDATE admin_lifecycle_operations SET state='deleted',updatedAt=? WHERE id=?`).run(Date.now(),op.id);
  }).immediate());
  await finishLifecycle(db,op);
}

export async function removeUserLifecycle(auth:NoctuaAuth,db:Database,source:SessionSecurity,request:Request,userId:string,body:unknown,cleanup:Cleanup=cleanupUserAccountAccess) {
  strictFields(body,["reassignOwnerTo"]);
  if (body.reassignOwnerTo!==undefined && (typeof body.reassignOwnerTo!=="string" || body.reassignOwnerTo===userId)) throw new AuthPolicyError("invalid_owner",400);
  const op=await reserveLifecycle(db,source,userId,"user.delete",{});
  let started=false;
  try {
    assertTargetPolicy(db,op,{},true);
    if (body.reassignOwnerTo) {
      try {assertEnabledTarget(db,body.reassignOwnerTo as string);} catch {throw new AuthPolicyError("invalid_owner",400);}
    }
    if (!body.reassignOwnerTo && db.prepare(`SELECT 1 FROM accounts WHERE ownerUserId=?`).get(userId)) throw new AuthPolicyError("owner_reassignment_required",409);
    const accountIds=(db.prepare(`SELECT DISTINCT a.id FROM accounts a LEFT JOIN user_accounts ua ON ua.accountId=a.id WHERE a.ownerUserId=? OR ua.userId=?`).all(userId,userId) as {id:string}[]).map(row=>row.id);
    op.payload=JSON.stringify({reassignOwnerTo:body.reassignOwnerTo,accountIds});
    await withDbWriteRetry("recordDeleteCleanup",()=>db.prepare(`UPDATE admin_lifecycle_operations SET payload=? WHERE id=?`).run(op.payload,op.id));
    await takeLifecycleUserSlot(db,op);
    assertAdminActor(db,source);
    await markStarted(db,op);started=true;
    await withAuthProof({db,internal:true,source,authenticatedAt:source.authenticatedAt,method:source.method,createdSessionIds:[]},async()=>{
      await auth.api.banUser({headers:request.headers,body:{userId,banReason:"Deletion pending"}});
      await cleanDeletedUser(db,op,cleanup);
      await auth.api.removeUser({headers:request.headers,body:{userId}});
    });
    await completeDeletion(db,op);
    return {ok:true};
  } catch (error) {
    if (!started) await finishLifecycle(db,op,"cancelled");
    throw error;
  }
}

/** Admin grants prove the actor; confirmedTarget records personal out-of-band identity verification. */
export async function issueRecovery(auth:NoctuaAuth,db:Database,actor:SessionSecurity|"operator",request:Request|null,userId:string,body:unknown) {
  strictFields(body,["confirmedTarget"]);
  if (body.confirmedTarget!==true) throw new AuthPolicyError("target_verification_required",400);
  const op=await reserveLifecycle(db,actor,userId,"user.recovery_issue",{});
  let journalId:string|undefined;
  try {
    const user=db.prepare(`SELECT id,email FROM auth_user WHERE id=?`).get(userId) as {id:string;email:string}|null;
    if (!user) throw new AuthPolicyError("user_not_found",404);
    await authorizeAdminSecurity(db,op,actor,request);
    journalId=crypto.randomUUID();
    const id=journalId;
    await withDbWriteRetry("reserveRecovery",()=>db.transaction(()=>{
      assertLifecycle(db,op);
      db.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'recovery','reserved',?,?)`).run(id,userId,user.email.trim().toLowerCase(),Date.now(),Date.now());
      // Reissue invalidates every older handover before a new capability is minted.
      db.prepare(`DELETE FROM auth_verification WHERE value=? AND identifier LIKE 'reset-password:%'`).run(userId);
      advanceSecurityGeneration(db,userId);
    }).immediate());
    revokeAuthStreams({userId});
    let link:string|undefined;
    const baseURL=(await auth.$context).options.baseURL as string;
    await withResetDelivery({userId,deliver:url=>{if (link) throw new Error("Duplicate reset delivery");link=url;}},()=>
      auth.api.requestPasswordReset({body:{email:user.email,redirectTo:resetCallback(baseURL)}}));
    if (!link) throw new AuthPolicyError("recovery_delivery_failed",503);
    await withDbWriteRetry("completeRecovery",()=>db.transaction(()=>{
      assertLifecycle(db,op);
      recordAdminAuditRow(db,{actorUserId:op.actorUserId,action:"user.recovery_issue",targetUserId:userId,payload:{confirmedTarget:true,operationId:op.id,delivery:"personal_handover"}});
      db.prepare(`UPDATE user_provisioning SET state='complete',updatedAt=? WHERE id=?`).run(Date.now(),id);
    }).immediate());
    await finishLifecycle(db,op);
    return {ok:true,url:link,expiresIn:900};
  } catch (error) {
    // No un-audited link may escape. Interrupted issuance is reconciled before login.
    if (!journalId) await finishLifecycle(db,op,"cancelled");
    throw error;
  }
}

/** Startup/operator only; cutoff excludes live requests from other Next module graphs. */
export async function reconcileLifecycle(auth:NoctuaAuth,db:Database,before:number,cleanup:Cleanup=cleanupUserAccountAccess) {
  const operations=db.prepare(`SELECT * FROM admin_lifecycle_operations WHERE slot='admin-lifecycle' AND createdAt<?`).all(before) as LifecycleOperation[];
  for (const op of operations) {
    if (op.action==="user.delete" && op.state!=="reserved") {
      if (op.state==="deleted") {await finishLifecycle(db,op);continue;}
      await cleanDeletedUser(db,op,cleanup);
      // There is no browser admin session at restart. Use the same pinned adapter deletion
      // under local startup authority, after all domain/shard cleanup, never a synthetic session.
      await (await auth.$context).internalAdapter.deleteUser(op.targetUserId);
      await completeDeletion(db,op);
      continue;
    }
    await withDbWriteRetry("reconcileLifecycle",()=>db.transaction(()=>{
      if (db.prepare(`SELECT 1 FROM auth_security_state WHERE userId=?`).get(op.targetUserId)) advanceSecurityGeneration(db,op.targetUserId);
      db.prepare(`DELETE FROM auth_verification WHERE value=? AND identifier LIKE 'reset-password:%'`).run(op.targetUserId);
      db.prepare(`UPDATE user_provisioning SET state='cancelled',updatedAt=? WHERE userId=? AND kind='recovery' AND state IN ${ACTIVE_PROVISIONING}`).run(Date.now(),op.targetUserId);
      recordAdminAuditRow(db,{actorUserId:op.actorUserId,action:"user.update",targetUserId:op.targetUserId||null,payload:{operationId:op.id,reconciled:true,interruptedAction:op.action}});
    }).immediate());
    await finishLifecycle(db,op,"cancelled");
    revokeAuthStreams({userId:op.targetUserId});
  }
}
