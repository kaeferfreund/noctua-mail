type ServerDbModule = typeof import("./db");
type ResolveThreadingMessage = Parameters<ServerDbModule["resolveThreadingForAccountMessages"]>[1][number];

const SERVER_DB_SPECIFIER = "./db.ts?server-runtime";

function loadServerDb(): Promise<ServerDbModule> {
  return import(SERVER_DB_SPECIFIER);
}

export async function listAdminAudit(...args: Parameters<ServerDbModule["listAdminAudit"]>) {
  return (await loadServerDb()).listAdminAudit(...args);
}

export { clampAuditLimit, decodeAdminAuditCursor, encodeAdminAuditCursor } from "./db/adminAudit";

export async function listAccountMemberCandidates(...args: Parameters<ServerDbModule["listAccountMemberCandidates"]>) {
  return (await loadServerDb()).listAccountMemberCandidates(...args);
}

export async function listAdminUserPasskeys() {
  return (await loadServerDb()).listAdminUserPasskeys();
}

export async function getAccountById(...args: Parameters<ServerDbModule["getAccountById"]>) {
  const db = await loadServerDb();
  return db.getAccountById(...args);
}

export async function getAccounts(...args: Parameters<ServerDbModule["getAccounts"]>) {
  const db = await loadServerDb();
  return db.getAccounts(...args);
}

export async function getAccountsForUser(
  ...args: Parameters<ServerDbModule["getAccountsForUser"]>
) {
  const db = await loadServerDb();
  return db.getAccountsForUser(...args);
}

export async function getFolders(...args: Parameters<ServerDbModule["getFolders"]>) {
  const db = await loadServerDb();
  return db.getFolders(...args);
}

export async function deleteMessageById(...args: Parameters<ServerDbModule["deleteMessageById"]>) {
  const db = await loadServerDb();
  return db.deleteMessageById(...args);
}

export async function getMcpTokenByHash(...args: Parameters<ServerDbModule["getMcpTokenByHash"]>) {
  const db = await loadServerDb();
  return db.getMcpTokenByHash(...args);
}

export async function recordDraftTombstone(
  ...args: Parameters<ServerDbModule["recordDraftTombstone"]>
) {
  const db = await loadServerDb();
  return db.recordDraftTombstone(...args);
}

export async function getMessageById(...args: Parameters<ServerDbModule["getMessageById"]>) {
  const db = await loadServerDb();
  return db.getMessageById(...args);
}

export async function insertMcpToken(...args: Parameters<ServerDbModule["insertMcpToken"]>) {
  const db = await loadServerDb();
  return db.insertMcpToken(...args);
}

export async function listMcpTokens(...args: Parameters<ServerDbModule["listMcpTokens"]>) {
  const db = await loadServerDb();
  return db.listMcpTokens(...args);
}

export async function resolveThreadingForAccountMessages<T extends ResolveThreadingMessage>(
  accountId: string,
  messages: readonly T[]
) {
  const db = await loadServerDb();
  return db.resolveThreadingForAccountMessages(accountId, messages);
}

export async function listMessages(...args: Parameters<ServerDbModule["listMessages"]>) {
  const db = await loadServerDb();
  return db.listMessages(...args);
}

export async function listRelatedMessages(
  ...args: Parameters<ServerDbModule["listRelatedMessages"]>
) {
  const db = await loadServerDb();
  return db.listRelatedMessages(...args);
}

export async function listThreadMessages(
  ...args: Parameters<ServerDbModule["listThreadMessages"]>
) {
  const db = await loadServerDb();
  return db.listThreadMessages(...args);
}

export async function listThreadMessageWindow(
  ...args: Parameters<ServerDbModule["listThreadMessageWindow"]>
) {
  const db = await loadServerDb();
  return db.listThreadMessageWindow(...args);
}

export async function deleteMcpToken(...args: Parameters<ServerDbModule["deleteMcpToken"]>) {
  const db = await loadServerDb();
  return db.deleteMcpToken(...args);
}

export async function touchMcpTokenLastUsed(
  ...args: Parameters<ServerDbModule["touchMcpTokenLastUsed"]>
) {
  const db = await loadServerDb();
  return db.touchMcpTokenLastUsed(...args);
}

export async function updateMessageFlags(
  ...args: Parameters<ServerDbModule["updateMessageFlags"]>
) {
  const db = await loadServerDb();
  return db.updateMessageFlags(...args);
}

export async function bulkUpdateMessageFlags(
  ...args: Parameters<ServerDbModule["bulkUpdateMessageFlags"]>
) {
  const db = await loadServerDb();
  return db.bulkUpdateMessageFlags(...args);
}

export async function recomputeThreadsForAccount(
  ...args: Parameters<ServerDbModule["recomputeThreadsForAccount"]>
) {
  const db = await loadServerDb();
  return db.recomputeThreadsForAccount(...args);
}

export async function upsertMessages(...args: Parameters<ServerDbModule["upsertMessages"]>) {
  const db = await loadServerDb();
  return db.upsertMessages(...args);
}

export async function getAttachmentIds(
  ...args: Parameters<ServerDbModule["getAttachmentIds"]>
) {
  const db = await loadServerDb();
  return db.getAttachmentIds(...args);
}

export async function getUserById(...args: Parameters<ServerDbModule["getUserById"]>) {
  return (await loadServerDb()).getUserById(...args);
}

export async function deleteSessionProofState(...args: Parameters<ServerDbModule["deleteSessionProofState"]>) {
  return (await loadServerDb()).deleteSessionProofState(...args);
}

export async function getUserAccountPrefs(...args: Parameters<ServerDbModule["getUserAccountPrefs"]>) {
  return (await loadServerDb()).getUserAccountPrefs(...args);
}
export async function mergeUserAccountPrefs(...args: Parameters<ServerDbModule["mergeUserAccountPrefs"]>) {
  return (await loadServerDb()).mergeUserAccountPrefs(...args);
}
export async function recordAdminAudit(...args: Parameters<ServerDbModule["recordAdminAudit"]>) {
  return (await loadServerDb()).recordAdminAudit(...args);
}

export { AccountDeletionForbiddenError } from "./db/accounts";
export async function deleteAccountControlPlane(...args: Parameters<ServerDbModule["deleteAccountControlPlane"]>) {
  return (await loadServerDb()).deleteAccountControlPlane(...args);
}

export async function getLatestMessageUid(...args: Parameters<ServerDbModule["getLatestMessageUid"]>) {
  return (await loadServerDb()).getLatestMessageUid(...args);
}
export async function getMailboxState(...args: Parameters<ServerDbModule["getMailboxState"]>) {
  return (await loadServerDb()).getMailboxState(...args);
}
export async function saveMailboxState(...args: Parameters<ServerDbModule["saveMailboxState"]>) {
  return (await loadServerDb()).saveMailboxState(...args);
}
export async function deleteMessageByFolderUid(...args: Parameters<ServerDbModule["deleteMessageByFolderUid"]>) {
  return (await loadServerDb()).deleteMessageByFolderUid(...args);
}
export async function saveFoldersForAccount(...args: Parameters<ServerDbModule["saveFoldersForAccount"]>) {
  return (await loadServerDb()).saveFoldersForAccount(...args);
}
export async function getMailboxSummaries(...args: Parameters<ServerDbModule["getMailboxSummaries"]>) {
  return (await loadServerDb()).getMailboxSummaries(...args);
}

export { InvalidAccountPreferencesError } from "./db/userAccountPrefs";
export async function listSenderIdentities(...args: Parameters<ServerDbModule["listSenderIdentities"]>) {
  return (await loadServerDb()).listSenderIdentities(...args);
}
export async function getAccountOwnAddresses(...args: Parameters<ServerDbModule["getAccountOwnAddresses"]>) {
  return (await loadServerDb()).getAccountOwnAddresses(...args);
}

export async function setUserUiLocale(...args: Parameters<ServerDbModule["setUserUiLocale"]>) {
  return (await loadServerDb()).setUserUiLocale(...args);
}
