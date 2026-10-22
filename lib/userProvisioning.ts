import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { NoctuaAuth } from "./betterAuth";
import { newMailboxSchema } from "./adminMailbox";
import { accountIdFromEmail } from "./accountId";
import { AuthPolicyError } from "./authPolicy";
import { withAuthProof } from "./authPolicyContext";
import { assertNewIdentity, validateSignupInvite, reserveProvisioning, finalizeProvisioning, compensateProvisioning } from "./db/userProvisioning";
import { withDbWriteRetry } from "./dbWriteRetry";
import { verifyImapCredentials } from "./mail/imapAuth";
import { verifySmtpCredentials } from "./mail/smtp";
import type { CredentialVerification } from "./mailboxCredentials";

export const personalEmailSchema=z.string().trim().toLowerCase().max(320).pipe(z.email());
const signupSchema=z.object({inviteCode:z.string().trim().min(1).max(128),email:personalEmailSchema,
  password:z.string().min(10).max(256),name:z.string().trim().min(1).max(256),account:newMailboxSchema.optional()}).strict();

/** No network or async library writes while an immediate master transaction is open. */
export async function provisionUser(auth:NoctuaAuth, db:Database, body:unknown,
  verification:CredentialVerification={imap:verifyImapCredentials,smtp:verifySmtpCredentials}) {
  const parsed=signupSchema.safeParse(body);
  if (!parsed.success) throw new AuthPolicyError("invalid_request",400);
  const input=parsed.data;
  const account=input.account?{...input.account,id:accountIdFromEmail(input.account.email)}:undefined;
  assertNewIdentity(db,input.email,account);
  validateSignupInvite(db,input.inviteCode,input.email);
  if (account && (!await verification.imap(account,account.imap.password) || !await verification.smtp(account))) throw new AuthPolicyError("mailbox_credentials_invalid",400);
  const op=await reserveProvisioning(db,input.email,input.inviteCode,account);
  try {
    await withAuthProof({db,internal:true,creation:{userId:op.userId,email:input.email,role:op.role},authenticatedAt:Date.now(),method:"provisioning",createdSessionIds:[]},()=>
      auth.api.createUser({body:{email:input.email,name:input.name,password:input.password,role:op.role}}));
    await withDbWriteRetry("markAuthCreated",()=>db.prepare(`UPDATE user_provisioning SET state='auth_created',updatedAt=? WHERE id=? AND state='reserved'`).run(Date.now(),op.id));
    await finalizeProvisioning(db,op,account);
  } catch (error) {
    try { await compensateProvisioning(db,op.id); }
    catch {
      await withDbWriteRetry("retainProvisioningCleanup",()=>db.prepare(`UPDATE user_provisioning SET state='cleanup_required',updatedAt=? WHERE id=? AND state NOT IN ('complete','cancelled')`).run(Date.now(),op.id));
    }
    if (error instanceof AuthPolicyError) throw error;
    throw new AuthPolicyError("provisioning_failed",503);
  }
  return {userId:op.userId,accountId:account?.id??null};
}
