import { createHash } from "node:crypto";
import { OUTREACH_IMAGE_MAX_BYTES, type OutreachImageType } from "../types";

export const imageExtensions: Readonly<Record<OutreachImageType, string>> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp"
};

export const imageFilename = /^([a-f0-9]{64})\.(jpg|png|gif|webp)(?![\s\S])/;
export const imagePathPrefix = "/t/m/";
export function imageUrl(hash: string, contentType: OutreachImageType) {
  return `${imagePathPrefix}${hash}.${imageExtensions[contentType]}`;
}
export const imageFilenameLimit = 255;
export const base64ImageLimit = 4 * Math.ceil(OUTREACH_IMAGE_MAX_BYTES / 3);

export class OutreachImageError extends Error {
  constructor(readonly status: 400 | 413 | 415, message: string) { super(message); }
}

function jpegDimensions(bytes: Buffer): [number, number] | undefined {
  for (let offset = 2; offset + 3 < bytes.length && bytes[offset] === 0xff;) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) break;
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) break;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && size >= 8) {
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += size;
  }
}

function webpDimensions(bytes: Buffer): [number, number] | undefined {
  const chunk = bytes.toString("latin1", 12, 16);
  if (chunk === "VP8X" && bytes.length >= 30) {
    return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const dimensions = bytes.readUInt32LE(21);
    return [(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8 " && bytes.length >= 30 && bytes.readUIntLE(23, 3) === 0x2a019d) {
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
}

function detectImage(bytes: Buffer): { contentType: OutreachImageType; dimensions?: [number, number] } | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(pngMagic)) {
    return { contentType: "image/png", dimensions: bytes.length >= 24 && bytes.toString("latin1", 12, 16) === "IHDR"
      ? [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] : undefined };
  }
  if (bytes.length >= 3 && bytes.readUIntBE(0, 3) === 0xffd8ff) {
    return { contentType: "image/jpeg", dimensions: jpegDimensions(bytes) };
  }
  if (["GIF87a", "GIF89a"].includes(bytes.toString("latin1", 0, 6))) {
    return { contentType: "image/gif", dimensions: bytes.length >= 10 ? [bytes.readUInt16LE(6), bytes.readUInt16LE(8)] : undefined };
  }
  if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return { contentType: "image/webp", dimensions: webpDimensions(bytes) };
  }
}
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function prepareImage(data: Uint8Array, uploadName: string) {
  if (data.byteLength > OUTREACH_IMAGE_MAX_BYTES) throw new OutreachImageError(413, "Image exceeds the 5 MiB limit.");
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const detected = detectImage(bytes);
  if (!detected) throw new OutreachImageError(415, "Use PNG, JPEG, GIF or WebP.");
  const { contentType, dimensions } = detected;
  const extension = imageExtensions[contentType];
  // Keep only the basename as display metadata, never as part of the file path.
  const name = uploadName.split(/[/\\]/).pop()?.replace(/\p{Cc}/gu, "").trim();
  const suffix = name?.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (suffix && suffix !== extension && !(suffix === "jpeg" && extension === "jpg")) {
    throw new OutreachImageError(415, "Filename extension does not match the image type.");
  }
  const filename = name?.slice(0, imageFilenameLimit) || `image.${extension}`;
  return {
    bytes, contentType, filename, hash: createHash("sha256").update(bytes).digest("hex"),
    width: dimensions?.[0] || null, height: dimensions?.[1] || null
  };
}

export function decodeImageBase64(data: string): Uint8Array {
  if (data.length > base64ImageLimit) throw new OutreachImageError(413, "Image exceeds the 5 MiB limit.");
  const bytes = Buffer.from(data, "base64");
  if (bytes.byteLength > OUTREACH_IMAGE_MAX_BYTES) throw new OutreachImageError(413, "Image exceeds the 5 MiB limit.");
  const canonical = bytes.toString("base64");
  if (data !== canonical && data !== canonical.replace(/=+$/, "")) {
    throw new OutreachImageError(400, "Invalid base64 image data.");
  }
  return bytes;
}
