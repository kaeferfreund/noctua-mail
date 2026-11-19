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

type Dimensions = [width: number, height: number];
const dimensionLimit = 16_384;
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function jpegDimensions(bytes: Buffer): Dimensions | undefined {
  for (let offset = 2; offset < bytes.length && bytes[offset] === 0xff;) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0x01) continue; // TEM is a standalone marker.
    if (marker < 0xc0 || (marker >= 0xd0 && marker <= 0xda) || offset + 2 > bytes.length) return;

    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) return;
    if (marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (size < 8) return;
      const components = bytes[offset + 7];
      if (!components || size !== 8 + 3 * components) return;
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += size;
  }
}

function webpDimensions(bytes: Buffer): Dimensions | undefined {
  if (bytes.length < 20 || bytes.readUInt32LE(4) !== bytes.length - 8) return;
  const chunk = bytes.toString("latin1", 12, 16);
  const size = bytes.readUInt32LE(16);
  if (20 + size + (size % 2) > bytes.length) return;
  if (chunk === "VP8X" && size === 10) {
    return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  }
  if (chunk === "VP8L" && size >= 5 && bytes[20] === 0x2f) {
    const dimensions = bytes.readUInt32LE(21);
    if (dimensions >>> 29) return; // Only version 0 is defined.
    return [(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8 " && size >= 10 && !(bytes[20] & 1) && bytes.readUIntLE(23, 3) === 0x2a019d) {
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
}

function detectImage(bytes: Buffer): { contentType: OutreachImageType; dimensions?: Dimensions } | undefined {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(pngMagic) &&
    bytes.readUInt32BE(8) === 13 && bytes.toString("latin1", 12, 16) === "IHDR") {
    return { contentType: "image/png", dimensions: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] };
  }
  if (bytes.length >= 2 && bytes.readUInt16BE(0) === 0xffd8) {
    return { contentType: "image/jpeg", dimensions: jpegDimensions(bytes) };
  }
  if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(bytes.toString("latin1", 0, 6))) {
    return { contentType: "image/gif", dimensions: [bytes.readUInt16LE(6), bytes.readUInt16LE(8)] };
  }
  if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return { contentType: "image/webp", dimensions: webpDimensions(bytes) };
  }
}

function displayFilename(uploadName: string, extension: string, canonicalExtension: boolean) {
  // Keep only the basename as display metadata, never as part of the file path.
  const name = (uploadName.split(/[/\\]/).pop() ?? "").replace(/\p{Cc}/gu, "").trim();
  if (canonicalExtension) {
    const base = name.replace(/\.[^.]*$/, "").slice(0, imageFilenameLimit - extension.length - 1);
    return `${base || "image"}.${extension}`;
  }

  const suffix = name.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (suffix && suffix !== extension && !(suffix === "jpeg" && extension === "jpg")) {
    throw new OutreachImageError(415, "Filename extension does not match the image type.");
  }
  return name.slice(0, imageFilenameLimit) || `image.${extension}`;
}

export function prepareImage(data: Uint8Array, uploadName: string, { canonicalExtension = false } = {}) {
  if (data.byteLength > OUTREACH_IMAGE_MAX_BYTES) throw new OutreachImageError(413, "Image exceeds the 5 MiB limit.");
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const detected = detectImage(bytes);
  if (!detected?.dimensions || detected.dimensions.some(side => side < 1 || side > dimensionLimit)) {
    throw new OutreachImageError(415, "Use PNG, JPEG, GIF or WebP.");
  }
  const { contentType, dimensions: [width, height] } = detected;
  const filename = displayFilename(uploadName, imageExtensions[contentType], canonicalExtension);
  return { bytes, contentType, filename, hash: createHash("sha256").update(bytes).digest("hex"), width, height };
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
