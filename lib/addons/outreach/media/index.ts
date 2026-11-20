import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/runtimePaths";
import { OUTREACH_IMAGE_FREE_SPACE_RESERVE_BYTES, OUTREACH_IMAGE_QUOTA_BYTES, OUTREACH_IMAGE_TOTAL_QUOTA_BYTES, type OutreachImage, type OutreachImageType, type OutreachImageUploadResponse } from "../types";
import { imageExtensions, imageUrl, OutreachImageError, prepareImage } from "./format";

export { base64ImageLimit, decodeImageBase64, imageFilename, imageFilenameLimit, imagePathPrefix, imageUrl,
  OutreachImageError, prepareImage } from "./format";

type ImageRow = Omit<OutreachImage, "id" | "url"> & { hash: string };
const imageFields = "hash, accountId, contentType, bytes, width, height, filename, createdAt";

function imageFromRow({ hash, ...row }: ImageRow): OutreachImage {
  return { ...row, id: hash, url: imageUrl(hash, row.contentType) };
}

export function outreachMediaDir() {
  return path.join(getDataDir(), "addons", "outreach", "media");
}

export function outreachImageFile(directory: string, hash: string, contentType: OutreachImageType) {
  // Media is provisioned at runtime in the data directory.
  return path.join(/* turbopackIgnore: true */ directory, `${hash}.${imageExtensions[contentType]}`);
}

export function listOutreachImages(db: Database, accountId: string): OutreachImage[] {
  return db.query(`SELECT ${imageFields} FROM images
    WHERE accountId = ? ORDER BY createdAt DESC, hash`).all(accountId).map(imageFromRow);
}

/** A new image of this mailbox must fit its quota; one it already has costs nothing. */
function assertImageQuota(db: Database, accountId: string, hash: string, size: number, quota: number) {
  if (db.query("SELECT 1 FROM images WHERE accountId = ? AND hash = ?").get(accountId, hash)) return;
  const { used } = db.query("SELECT COALESCE(SUM(bytes), 0) AS used FROM images WHERE accountId = ?").get(accountId) as { used: number };
  if (used + size > quota) {
    throw new OutreachImageError(413, "Der Bildspeicher dieses Postfachs ist voll.", "image_quota_exceeded");
  }
}

function storageFull(): never {
  throw new OutreachImageError(413, "Der Bildspeicher des Servers ist voll.", "image_storage_full");
}

/** A file no mailbox has stored yet must fit the limit for all mailboxes together. */
function assertTotalImageQuota(db: Database, hash: string, size: number, totalBytes: number) {
  if (!Number.isFinite(totalBytes) || db.query("SELECT 1 FROM images WHERE hash = ? LIMIT 1").get(hash)) return;
  const { used } = db.query(`SELECT COALESCE(SUM(bytes), 0) AS used
    FROM (SELECT MAX(bytes) AS bytes FROM images GROUP BY hash)`).get() as { used: number };
  if (used + size > totalBytes) storageFull();
}

/** Free bytes of the volume holding `directory` (or its nearest existing parent). */
async function freeBytes(directory: string): Promise<number> {
  for (let current = directory; ; current = path.dirname(current)) {
    try {
      const stats = await statfs(current);
      return stats.bavail * stats.bsize;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || path.dirname(current) === current) throw error;
    }
  }
}

export type OutreachImageStorageLimits = {
  /** All mailboxes together; `Infinity` for operator tooling. */
  totalBytes?: number;
  /** Free space that must remain on the volume after writing a new file. */
  reserveBytes?: number;
  freeBytes?: (directory: string) => Promise<number>;
};

export async function saveOutreachImage(db: Database, accountId: string, image: ReturnType<typeof prepareImage>,
  userId: string | null, directory = outreachMediaDir(), quota = OUTREACH_IMAGE_QUOTA_BYTES,
  storage: OutreachImageStorageLimits = {}): Promise<OutreachImageUploadResponse> {
  const { bytes, contentType, filename, hash, width, height } = image;
  const totalBytes = storage.totalBytes ?? OUTREACH_IMAGE_TOTAL_QUOTA_BYTES;
  // Checked before the file is written and again atomically with the insert (concurrent uploads).
  assertImageQuota(db, accountId, hash, bytes.byteLength, quota);
  assertTotalImageQuota(db, hash, bytes.byteLength, totalBytes);
  const target = outreachImageFile(directory, hash, contentType);
  const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  // Concurrent first uploads may both rename, but they publish identical bytes.
  // Publish the file before creating any reference to it in SQLite.
  if (!existing?.isFile() || existing.size !== bytes.byteLength) {
    const reserve = storage.reserveBytes ?? OUTREACH_IMAGE_FREE_SPACE_RESERVE_BYTES;
    if (await (storage.freeBytes ?? freeBytes)(directory) - bytes.byteLength < reserve) storageFull();
    await mkdir(directory, { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
      await rename(temp, target);
    } finally {
      await rm(temp, { force: true });
    }
  }
  const inserted = db.transaction(() => {
    assertImageQuota(db, accountId, hash, bytes.byteLength, quota);
    assertTotalImageQuota(db, hash, bytes.byteLength, totalBytes);
    return db.query(
      `INSERT INTO images (accountId, hash, contentType, bytes, width, height, filename, createdAt, createdByUserId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (accountId, hash) DO NOTHING RETURNING ${imageFields}`
    ).get(accountId, hash, contentType, bytes.byteLength, width, height, filename, Date.now(), userId) as ImageRow | null;
  }).immediate();
  const row = inserted ?? db.query(
    `SELECT ${imageFields} FROM images WHERE accountId = ? AND hash = ?`
  ).get(accountId, hash) as ImageRow;
  return { ok: true, image: imageFromRow(row), created: Boolean(inserted) };
}
