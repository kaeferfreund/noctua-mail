import type { AccountSettings } from "./data";
import { getDb } from "./db/connection";
import { updateMailboxCredentials, type CredentialActor } from "./mailboxCredentials";
import type { OutboundWriteAuthorization } from "./outboundAuthorization";
import { SenderIdentityError } from "./senderIdentityError";

export type SignatureTemplate = NonNullable<AccountSettings["signatures"]>[number];
export type SignatureTemplateActor = CredentialActor & { beforeWrite?: OutboundWriteAuthorization };
type TemplateSettings = { signatures: SignatureTemplate[]; defaultSignatureId: string };

export function listSignatureTemplates(settings: AccountSettings | undefined) {
  return { signatures: settings?.signatures ?? [], defaultSignatureId: settings?.defaultSignatureId || undefined };
}

const notFound = () => new SenderIdentityError("signature_not_found", 404, "Signature template not found");

/**
 * Read-modify-write through the mailbox settings service, so templates get the settings PUT's
 * manager check, body validation, signature_in_use guard, conflict detection and audit.
 */
async function writeSignatureTemplates(accountId: string, actor: SignatureTemplateActor, change: (current: TemplateSettings) => Partial<TemplateSettings>) {
  const db = await getDb();
  const authorization = await actor.beforeWrite?.();
  const account = await updateMailboxCredentials(accountId, original => ({ teamDefaults: true, settings: change({
    signatures: original.settings?.signatures ?? [], defaultSignatureId: original.settings?.defaultSignatureId ?? "" }) }),
  actor, { authorize: authorization ? () => authorization.assertCurrent(db) : undefined }, db);
  return listSignatureTemplates(account.settings);
}

/** Creates a template when signatureId is omitted, otherwise replaces name and body of an existing one. */
export async function saveSignatureTemplate(accountId: string, input: { signatureId?: string; name: string; body: string }, actor: SignatureTemplateActor) {
  const saved: SignatureTemplate = { id: input.signatureId ?? crypto.randomUUID(), name: input.name, body: input.body };
  const result = await writeSignatureTemplates(accountId, actor, current => {
    if (input.signatureId && !current.signatures.some(item => item.id === input.signatureId)) throw notFound();
    return { signatures: input.signatureId ? current.signatures.map(item => item.id === saved.id ? saved : item) : [...current.signatures, saved] };
  });
  return { ...result, signature: saved };
}

/** Like the settings UI, deleting the mailbox default also clears the default. */
export function deleteSignatureTemplate(accountId: string, signatureId: string, actor: SignatureTemplateActor) {
  return writeSignatureTemplates(accountId, actor, current => {
    if (!current.signatures.some(item => item.id === signatureId)) throw notFound();
    return { signatures: current.signatures.filter(item => item.id !== signatureId),
      ...(current.defaultSignatureId === signatureId ? { defaultSignatureId: "" } : {}) };
  });
}

/** An empty id or null means no mailbox default. */
export function setDefaultSignatureTemplate(accountId: string, signatureId: string | null, actor: SignatureTemplateActor) {
  return writeSignatureTemplates(accountId, actor, current => {
    if (signatureId && !current.signatures.some(item => item.id === signatureId)) throw notFound();
    return { defaultSignatureId: signatureId ?? "" };
  });
}
