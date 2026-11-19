import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/runtimePaths";
import type { OutreachImage, OutreachImageType, OutreachImageUploadResponse } from "../types";
import { imageExtensions, imageUrl, prepareImage } from "./format";

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

export async function saveOutreachImage(db: Database, accountId: string, image: ReturnType<typeof prepareImage>,
  userId: string | null, directory = outreachMediaDir()): Promise<OutreachImageUploadResponse> {
  const { bytes, contentType, filename, hash, width, height } = image;
  const target = outreachImageFile(directory, hash, contentType);
  const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  // Concurrent first uploads may both rename, but they publish identical bytes.
  // Publish the file before creating any reference to it in SQLite.
  if (!existing?.isFile() || existing.size !== bytes.byteLength) {
    await mkdir(directory, { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
      await rename(temp, target);
    } finally {
      await rm(temp, { force: true });
    }
  }
  const inserted = db.query(
    `INSERT INTO images (accountId, hash, contentType, bytes, width, height, filename, createdAt, createdByUserId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (accountId, hash) DO NOTHING RETURNING ${imageFields}`
  ).get(accountId, hash, contentType, bytes.byteLength, width, height, filename, Date.now(), userId) as ImageRow | null;
  const row = inserted ?? db.query(
    `SELECT ${imageFields} FROM images WHERE accountId = ? AND hash = ?`
  ).get(accountId, hash) as ImageRow;
  return { ok: true, image: imageFromRow(row), created: Boolean(inserted) };
}
