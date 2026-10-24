import { promises as fs, existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { createHash, randomUUID } from "crypto";
import path from "path";
import type { Account, Folder, Message } from "./data";
import { buildMessageRowIdLookupCandidates } from "./messageIds";
import {
  getAttachmentMessageDir,
  getAttachmentsDir,
  getAttachmentsAccountDir,
  getDataDir,
  getSourcesAccountDir,
  getSourcesDir
} from "./runtimePaths";

const dataDir = getDataDir();
const sourcesDir = getSourcesDir();
const attachmentsDir = getAttachmentsDir();

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function ensureSourcesDir() {
  await ensureDataDir();
  await fs.mkdir(sourcesDir, { recursive: true });
}

async function ensureAttachmentsDir() {
  await ensureDataDir();
  await fs.mkdir(attachmentsDir, { recursive: true });
}

function sourceFileName(accountId: string, messageId: string) {
  const safeAccount = encodeURIComponent(accountId);
  const safeMessage = encodeURIComponent(messageId);
  return `${safeAccount}-${safeMessage}.eml`;
}

function attachmentFileName(accountId: string, messageId: string, attachmentId: string) {
  const safeAccount = encodeURIComponent(accountId);
  const safeMessage = encodeURIComponent(messageId);
  const safeAttachment = encodeURIComponent(attachmentId);
  return `${safeAccount}-${safeMessage}-${safeAttachment}.bin`;
}

function sourceObjectFileName(messageId: string) {
  return `${encodeURIComponent(messageId)}.eml`;
}

function attachmentObjectFileName(attachmentId: string) {
  return `${encodeURIComponent(attachmentId)}.bin`;
}

function sourceFilePath(accountId: string, messageId: string) {
  return path.join(getSourcesAccountDir(accountId), sourceObjectFileName(messageId));
}

/** Path of the retained source stored under exactly this final row id. */
export function getExactMessageSourcePath(accountId: string, messageId: string) {
  return sourceFilePath(accountId, messageId);
}

/** Ownership digest stored in `messages.sourceSha256` for a retained source. */
export function messageSourceSha256(source: string | Buffer) {
  return createHash("sha256").update(source).digest("hex");
}

function sourceLegacyFilePath(accountId: string, messageId: string) {
  return path.join(sourcesDir, sourceFileName(accountId, messageId));
}

function attachmentFilePath(accountId: string, messageId: string, attachmentId: string) {
  return path.join(getAttachmentMessageDir(accountId, messageId), attachmentObjectFileName(attachmentId));
}

function attachmentLegacyFilePath(accountId: string, messageId: string, attachmentId: string) {
  return path.join(attachmentsDir, attachmentFileName(accountId, messageId, attachmentId));
}

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function unlinkIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore missing files
  }
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  if (!("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "");
}

async function renameIfExists(fromPath: string, toPath: string) {
  if (fromPath === toPath) return;
  try {
    await fs.access(fromPath);
  } catch {
    return;
  }
  await ensureParentDir(toPath);
  await unlinkIfExists(toPath);
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    if (getErrorCode(error) !== "EXDEV") {
      throw error;
    }
    await fs.copyFile(fromPath, toPath);
    await unlinkIfExists(fromPath);
  }
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJson(fileName, fallback);
    return fallback;
  }
}

async function writeJson<T>(fileName: string, data: T) {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function getAccounts() {
  return readJson<Account[]>("accounts.json", []);
}

export async function saveAccounts(nextAccounts: Account[]) {
  await writeJson("accounts.json", nextAccounts);
}

export async function getFolders() {
  return readJson<Folder[]>("folders.json", []);
}

export async function saveFolders(nextFolders: Folder[]) {
  await writeJson("folders.json", nextFolders);
}

export async function getMessages() {
  const data = await readJson<Message[]>("messages.json", []);
  let mutated = false;

  const migrated = data.map((message) => {
    if (!message.id.startsWith("imap-") || !message.accountId) {
      return message;
    }
    const prefix = `imap-${message.accountId}-`;
    if (!message.id.startsWith(prefix)) {
      return message;
    }
    const suffix = message.id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) {
      return message;
    }
    const folderPart = message.folderId
      ? message.folderId.replace(`${message.accountId}:`, "")
      : "INBOX";
    const safeMailbox = folderPart.replace(/\//g, "_");
    const nextId = `${prefix}${safeMailbox}-${suffix}`;
    if (nextId !== message.id) {
      mutated = true;
      return { ...message, id: nextId };
    }
    return message;
  });

  const deduped = Array.from(new Map(migrated.map((msg) => [msg.id, msg])).values());
  if (mutated || deduped.length !== data.length) {
    await saveMessages(deduped);
  }
  return deduped;
}

export async function saveMessages(nextMessages: Message[]) {
  await writeJson("messages.json", nextMessages);
}

/** Writes the raw source and returns the number of bytes it occupies on disk. */
export async function saveMessageSource(
  accountId: string,
  messageId: string,
  source: string | Buffer
) {
  await ensureSourcesDir();
  const filePath = sourceFilePath(accountId, messageId);
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, source);
  return Buffer.byteLength(source);
}

/**
 * Stage bytes without publishing them under a message id. Upsert installs them
 * only after resolving the final row identity in its immediate transaction.
 * Renames are synchronous so no other writer can interleave between id
 * assignment, file publication and the ownership digest stored in that row.
 */
export async function stageMessageFiles(accountId: string, messages: Array<{
  source?: string;
  attachments: Array<{ id: string; data: Buffer }>;
}>) {
  type StagedFile = { path: string; attachmentId?: string };
  const temporaryPaths = new Set<string>();
  const installed: Array<{ target: string; backup: string; published: boolean; hadPrevious: boolean }> = [];
  const stage = async (directory: string, data: string | Buffer, attachmentId?: string): Promise<StagedFile> => {
    await fs.mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `.pending-${randomUUID()}`);
    temporaryPaths.add(temporary);
    await fs.writeFile(temporary, data, { flag: "wx" });
    return { path: temporary, attachmentId };
  };
  const cleanup = async () => {
    await Promise.all(Array.from(temporaryPaths, temporary => fs.rm(temporary, { force: true })));
  };
  const rollback = () => {
    for (const entry of installed.reverse()) {
      if (entry.published) unlinkSync(entry.target);
      if (entry.hadPrevious) renameSync(entry.backup, entry.target);
    }
    installed.length = 0;
  };
  try {
    const entries: Array<{ source: StagedFile | null; sourceSha256: string | null; attachments: StagedFile[] }> = [];
    for (const message of messages) {
      const source = message.source !== undefined
        ? await stage(getSourcesAccountDir(accountId), message.source) : null;
      const attachments: StagedFile[] = [];
      for (const attachment of message.attachments) {
        attachments.push(await stage(getAttachmentsAccountDir(accountId), attachment.data, attachment.id));
      }
      entries.push({
        source,
        sourceSha256: message.source !== undefined ? messageSourceSha256(message.source) : null,
        attachments
      });
    }
    const publish = (file: StagedFile, target: string) => {
      mkdirSync(path.dirname(target), { recursive: true });
      const backup = `${file.path}.previous`;
      const entry = { target, backup, published: false, hadPrevious: false };
      installed.push(entry);
      temporaryPaths.add(backup);
      if (existsSync(target)) {
        renameSync(target, backup);
        entry.hadPrevious = true;
      }
      renameSync(file.path, target);
      entry.published = true;
    };
    // Attachment message directories depend on final row ids. Preparing them
    // inside the transaction is synchronous; all bulk byte IO happened above.
    return { entries, cleanup, rollback, install(index: number, finalId: string) {
      const entry = entries[index];
      if (entry.source) publish(entry.source, sourceFilePath(accountId, finalId));
      for (const file of entry.attachments) {
        publish(file, attachmentFilePath(accountId, finalId, file.attachmentId!));
      }
    } };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** Concurrent stat calls per chunk while walking an account's source directory. */
const SOURCE_STAT_CONCURRENCY = 64;

/**
 * `decodeURIComponent` throws on malformed percent-escapes, and the sources
 * directory can hold files this code never wrote. One stray name must not
 * abort the whole walk, so an undecodable one is skipped.
 */
function decodeSourceFileName(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return null;
  }
}

/**
 * Byte size of every stored source for an account, keyed by the message id its
 * filename encodes. One directory walk instead of a stat per database row, so
 * rows whose source is long gone cost a map miss rather than a failed syscall.
 */
export async function listMessageSourceSizes(accountId: string) {
  const dir = getSourcesAccountDir(accountId);
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(dir);
  } catch {
    return new Map<string, number>();
  }
  const sizes = new Map<string, number>();
  const sourceFiles = fileNames.filter((name) => name.endsWith(".eml"));
  for (let start = 0; start < sourceFiles.length; start += SOURCE_STAT_CONCURRENCY) {
    const chunk = sourceFiles.slice(start, start + SOURCE_STAT_CONCURRENCY);
    const stats = await Promise.all(
      chunk.map(async (name) => {
        try {
          return await fs.stat(path.join(dir, name));
        } catch {
          return null;
        }
      })
    );
    chunk.forEach((name, index) => {
      const stat = stats[index];
      if (!stat?.isFile()) return;
      const messageId = decodeSourceFileName(name.slice(0, -".eml".length));
      if (messageId === null) return;
      sizes.set(messageId, stat.size);
    });
  }
  return sizes;
}

export async function getMessageSource(accountId: string, messageId: string, options: { exact?: boolean } = {}) {
  await ensureSourcesDir();
  const candidates = options.exact ? [messageId] : buildMessageRowIdLookupCandidates(messageId);
  for (const candidateId of candidates) {
    try {
      return await fs.readFile(sourceFilePath(accountId, candidateId), "utf-8");
    } catch {
      // try next candidate
    }
  }
  return null;
}

// Raw-bytes variant of getMessageSource. Rewriting a message's MIME must
// operate on the exact bytes (binary/8bit parts included); reading as utf-8
// would mangle them before the surgery even runs.
export async function getMessageSourceBuffer(accountId: string, messageId: string) {
  await ensureSourcesDir();
  const candidates = buildMessageRowIdLookupCandidates(messageId);
  for (const candidateId of candidates) {
    try {
      return await fs.readFile(sourceFilePath(accountId, candidateId));
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function statMessageSource(
  accountId: string,
  messageId: string
): Promise<{ size: number; mtimeMs: number } | null> {
  await ensureSourcesDir();
  const candidates = buildMessageRowIdLookupCandidates(messageId);
  for (const candidateId of candidates) {
    try {
      const stat = await fs.stat(sourceFilePath(accountId, candidateId));
      if (!stat.isFile()) continue;
      return { size: stat.size, mtimeMs: stat.mtimeMs };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function saveAttachmentData(
  accountId: string,
  messageId: string,
  attachmentId: string,
  data: Buffer
) {
  await ensureAttachmentsDir();
  const filePath = attachmentFilePath(accountId, messageId, attachmentId);
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, data);
}

export async function getAttachmentData(
  accountId: string,
  messageId: string,
  attachmentId: string
) {
  await ensureAttachmentsDir();
  const candidates = buildMessageRowIdLookupCandidates(messageId);
  for (const candidateId of candidates) {
    try {
      return await fs.readFile(attachmentFilePath(accountId, candidateId, attachmentId));
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function statAttachmentData(
  accountId: string,
  messageId: string,
  attachmentId: string
): Promise<{ size: number; mtimeMs: number } | null> {
  await ensureAttachmentsDir();
  const candidates = buildMessageRowIdLookupCandidates(messageId);
  for (const candidateId of candidates) {
    try {
      const stat = await fs.stat(attachmentFilePath(accountId, candidateId, attachmentId));
      if (!stat.isFile()) continue;
      return { size: stat.size, mtimeMs: stat.mtimeMs };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function deleteMessageSource(accountId: string, messageId: string) {
  await ensureSourcesDir();
  await Promise.all([
    unlinkIfExists(sourceFilePath(accountId, messageId)),
    unlinkIfExists(sourceLegacyFilePath(accountId, messageId))
  ]);
}

export async function deleteAttachmentData(
  accountId: string,
  messageId: string,
  attachmentId: string
) {
  await ensureAttachmentsDir();
  await Promise.all([
    unlinkIfExists(attachmentFilePath(accountId, messageId, attachmentId)),
    unlinkIfExists(attachmentLegacyFilePath(accountId, messageId, attachmentId))
  ]);
}

export async function deleteMessageFiles(
  accountId: string,
  messageId: string,
  attachmentIds: string[]
) {
  await Promise.all([
    deleteMessageSource(accountId, messageId),
    ...attachmentIds.map((id) => deleteAttachmentData(accountId, messageId, id))
  ]);
}

export async function moveMessageFiles(
  accountId: string,
  previousMessageId: string,
  nextMessageId: string,
  attachmentIds: string[]
) {
  if (!previousMessageId || !nextMessageId || previousMessageId === nextMessageId) return;
  await Promise.all([
    renameIfExists(
      sourceFilePath(accountId, previousMessageId),
      sourceFilePath(accountId, nextMessageId)
    ),
    renameIfExists(
      sourceLegacyFilePath(accountId, previousMessageId),
      sourceLegacyFilePath(accountId, nextMessageId)
    ),
    ...attachmentIds.flatMap((attachmentId) => [
      renameIfExists(
        attachmentFilePath(accountId, previousMessageId, attachmentId),
        attachmentFilePath(accountId, nextMessageId, attachmentId)
      ),
      renameIfExists(
        attachmentLegacyFilePath(accountId, previousMessageId, attachmentId),
        attachmentLegacyFilePath(accountId, nextMessageId, attachmentId)
      )
    ])
  ]);

  await fs.rm(getAttachmentMessageDir(accountId, previousMessageId), {
    recursive: true,
    force: true
  });
}
