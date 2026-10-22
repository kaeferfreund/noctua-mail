import { startIdentityRecomputeJob, getIdentityRecomputeJob } from "./threadRecomputeJobs";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import type { SenderIdentity } from "./data";
import { getDb } from "./db/connection";
import { listSenderIdentityRows, getIdentitySignatureIds, persistSenderIdentityMutation } from "./db/senderIdentities";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { withDbWriteRetry } from "./dbWriteRetry";
import { normalizeIdentityEmail } from "./ownAddresses";

const address = z.string().max(254).transform(value => normalizeIdentityEmail(value))
  .refine((value): value is string => value !== null, "Expected one valid email address");
const text = z.string().max(256).refine(value => !/[\x00-\x1f\x7f]/.test(value));
const optionalId = z.string().min(1).max(256);
export const createSenderIdentitySchema = z.object({
  email: address, displayName: text, replyTo: address.optional(), signatureId: optionalId.optional(),
  isDefault: z.boolean().optional(), enabled: z.boolean().optional()
}).strict();
export const updateSenderIdentitySchema = z.object({
  displayName: text.optional(), replyTo: address.nullable().optional(), signatureId: optionalId.nullable().optional(),
  isDefault: z.boolean().optional(), enabled: z.boolean().optional()
}).strict();
export class SenderIdentityError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export type IdentityActor = { userId: string; clientId?: string };

export function assertIdentitySignaturesAvailable(db: Database, accountId: string, signatureIds: readonly string[]) {
  const used = listSenderIdentityRows(db, accountId).find(identity => identity.signatureId && !signatureIds.includes(identity.signatureId));
  if (used) throw new SenderIdentityError("signature_in_use", 409, "Unlink the identity's signature before removing its template");
}

/** Authorization, validation, promotion and audit share one master immediate transaction. */
async function mutate(accountId: string, identityId: string | null, input: unknown, actor: IdentityActor, database?: Database) {
  const db = database ?? await getDb();
  return withDbWriteRetry("mutateSenderIdentity", () => db.transaction(() => {
    if (resolveAccountRoleRow(db, actor.userId, accountId) !== "manager") {
      throw new SenderIdentityError("forbidden", 403, "Manager role required");
    }
    if (identityId && identityId.length > 256) throw new SenderIdentityError("invalid_identity", 400, "Invalid identity id");
    const identities = listSenderIdentityRows(db, accountId);
    const previous = identityId ? identities.find(identity => identity.id === identityId) : undefined;
    if (identityId && !previous) throw new SenderIdentityError("identity_not_found", 404, "Identity not found");
    if (identityId && input && typeof input === "object" && ["email", "id", "accountId", "createdBy", "createdAt"].some(key => key in input)) {
      throw new SenderIdentityError("immutable_identity_field", 400, "Identity address and attribution are immutable");
    }
    const parsed = (identityId ? updateSenderIdentitySchema : createSenderIdentitySchema).safeParse(input);
    if (!parsed.success) throw new SenderIdentityError("invalid_identity", 400, "Invalid identity configuration");
    const patch = parsed.data;
    const now = Date.now();
    const next: SenderIdentity = {
      ...(previous ?? { id: crypto.randomUUID(), accountId, email: (patch as z.infer<typeof createSenderIdentitySchema>).email,
        displayName: "", enabled: true, isDefault: false, createdBy: actor.userId, createdAt: now, updatedAt: now }),
      ...patch, replyTo: patch.replyTo === null ? undefined : patch.replyTo ?? previous?.replyTo,
      signatureId: patch.signatureId === null ? undefined : patch.signatureId ?? previous?.signatureId
    };
    if (!next.enabled && next.isDefault || previous?.isDefault && patch.isDefault === false) {
      throw new SenderIdentityError("default_identity_required", 409, "Promote another enabled identity before disabling or unsetting the default");
    }
    if (identities.some(identity => identity.id !== next.id && identity.email === next.email)) {
      throw new SenderIdentityError("identity_exists", 409, "This mailbox already has that address");
    }
    if (next.signatureId) {
      if (!getIdentitySignatureIds(db, accountId).includes(next.signatureId)) {
        throw new SenderIdentityError("invalid_identity", 400, "Choose a signature template from this mailbox");
      }
    }
    const fields = ["displayName", "replyTo", "signatureId", "enabled", "isDefault"] as const;
    const changedFields = previous ? fields.filter(key => previous[key] !== next[key]) : ["email", ...fields];
    if (!changedFields.length) return next;
    persistSenderIdentityMutation(db, next, previous, identities, changedFields, actor);
    return next;
  }).immediate());
}
export async function createSenderIdentity(accountId: string, input: unknown, actor: IdentityActor, db?: Database) {
  const identity = await mutate(accountId, null, input, actor, db);
  // Explicit isolated databases are used by offline callers/tests; production uses the account worker.
  if (!db) startIdentityRecomputeJob(accountId);
  return identity;
}
export const updateSenderIdentity = (accountId: string, identityId: string, patch: unknown, actor: IdentityActor, db?: Database) => mutate(accountId, identityId, patch, actor, db);
export const disableSenderIdentity = (accountId: string, identityId: string, actor: IdentityActor, db?: Database) => updateSenderIdentity(accountId, identityId, { enabled: false }, actor, db);
export const setDefaultSenderIdentity = (accountId: string, identityId: string, actor: IdentityActor, db?: Database) => updateSenderIdentity(accountId, identityId, { isDefault: true }, actor, db);
export { listSenderIdentities } from "./db/senderIdentities";

/** Commit configuration first; a failed rebuild is exposed for retry and never undoes it. */
export async function createSenderIdentityWithRecompute(accountId: string, input: unknown, actor: IdentityActor) {
  const identity = await createSenderIdentity(accountId, input, actor);
  const recomputeJob = getIdentityRecomputeJob(accountId);
  return { identity, recomputeJob };
}
