import sharp, { type Sharp } from "sharp";

/** Upload cap for a domain icon, checked before the body is buffered. */
export const DOMAIN_ICON_MAX_BYTES = 512 * 1024;
/** Edge of the stored square PNG. */
export const DOMAIN_ICON_SIZE = 64;
/** Decoder cap: a small compressed file must not expand into a huge bitmap. */
const MAX_INPUT_PIXELS = 4096 * 4096;
/** Windows icons are at most 256 px per edge. */
const MAX_ICO_EDGE = 256;

export type DomainIconFormat = "png" | "jpeg" | "webp" | "ico";

export class DomainIconError extends Error {
  constructor(readonly code: "unsupported_format" | "invalid_image") {
    super(code);
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);
}

/** The upload's format from its magic bytes; extension and Content-Type are
 * never trusted. Anything else (SVG, GIF, HTML, ...) is null. */
export function detectDomainIconFormat(bytes: Uint8Array): DomainIconFormat | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) && bytes.length >= 6) return "ico";
  return null;
}

type DecodedIco = { kind: "png"; data: Uint8Array } | { kind: "rgba"; data: Buffer; width: number; height: number };

/**
 * The largest image of an ICO file: an embedded PNG as is, or a BMP (DIB)
 * entry decoded to RGBA. libvips has no ICO loader, so the container is read
 * here with every offset and size checked against the buffer.
 */
export function decodeIco(bytes: Uint8Array): DecodedIco {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  if (count === 0 || 6 + count * 16 > bytes.length) throw new DomainIconError("invalid_image");
  let best: { area: number; offset: number; size: number } | null = null;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = bytes[entry] || 256;
    const height = bytes[entry + 1] || 256;
    const size = view.getUint32(entry + 8, true);
    const offset = view.getUint32(entry + 12, true);
    if (size === 0 || offset < 6 + count * 16 || offset + size > bytes.length) throw new DomainIconError("invalid_image");
    if (!best || width * height > best.area) best = { area: width * height, offset, size };
  }
  const data = bytes.subarray(best!.offset, best!.offset + best!.size);
  if (startsWith(data, PNG_SIGNATURE)) return { kind: "png", data };
  return decodeIcoBitmap(data);
}

/** BITMAPINFOHEADER image of an ICO entry: 1/4/8-bit palette, 24 or 32 bit,
 * uncompressed, bottom-up with the doubled height and the AND transparency mask. */
function decodeIcoBitmap(data: Uint8Array): DecodedIco {
  if (data.length < 40) throw new DomainIconError("invalid_image");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headerSize = view.getUint32(0, true);
  const width = view.getInt32(4, true);
  const height = view.getInt32(8, true) / 2;
  const bitCount = view.getUint16(14, true);
  const compression = view.getUint32(16, true);
  const colorsUsed = view.getUint32(32, true);
  if (headerSize < 40 || compression !== 0 || ![1, 4, 8, 24, 32].includes(bitCount)
    || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_ICO_EDGE || height > MAX_ICO_EDGE) {
    throw new DomainIconError("invalid_image");
  }
  const paletteSize = bitCount <= 8 ? (colorsUsed || 1 << bitCount) : 0;
  if (paletteSize > 1 << bitCount) throw new DomainIconError("invalid_image");
  const paletteOffset = headerSize;
  const pixelOffset = paletteOffset + paletteSize * 4;
  const stride = Math.ceil((width * bitCount) / 32) * 4;
  const maskStride = Math.ceil(width / 32) * 4;
  const maskOffset = pixelOffset + stride * height;
  // The AND mask is optional for 32-bit entries, which carry their own alpha.
  const hasMask = maskOffset + maskStride * height <= data.length;
  if (maskOffset > data.length || (bitCount !== 32 && !hasMask)) throw new DomainIconError("invalid_image");

  const rgba = Buffer.alloc(width * height * 4);
  let anyAlpha = false;
  for (let y = 0; y < height; y += 1) {
    const row = pixelOffset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      let blue: number, green: number, red: number, alpha = 255;
      if (bitCount === 32 || bitCount === 24) {
        const pixel = row + x * (bitCount / 8);
        blue = data[pixel]; green = data[pixel + 1]; red = data[pixel + 2];
        if (bitCount === 32) { alpha = data[pixel + 3]; anyAlpha ||= alpha > 0; }
      } else {
        const bit = x * bitCount;
        const index = (data[row + (bit >> 3)] >> (8 - bitCount - (bit & 7))) & ((1 << bitCount) - 1);
        if (index >= paletteSize) throw new DomainIconError("invalid_image");
        const color = paletteOffset + index * 4;
        blue = data[color]; green = data[color + 1]; red = data[color + 2];
      }
      rgba[out] = red; rgba[out + 1] = green; rgba[out + 2] = blue; rgba[out + 3] = alpha;
    }
  }
  // Without real alpha (palette, 24 bit, or a 32-bit entry whose alpha is all
  // zero) transparency comes from the AND mask: a set bit is transparent.
  if (hasMask && !anyAlpha) {
    for (let y = 0; y < height; y += 1) {
      const row = maskOffset + (height - 1 - y) * maskStride;
      for (let x = 0; x < width; x += 1) {
        const transparent = (data[row + (x >> 3)] >> (7 - (x & 7))) & 1;
        rgba[(y * width + x) * 4 + 3] = transparent ? 0 : 255;
      }
    }
  }
  return { kind: "rgba", data: rgba, width, height };
}

/**
 * Re-encodes an upload as a 64×64 PNG: the image is contained (aspect kept)
 * on a transparent square and metadata is dropped, so no uploaded byte is ever
 * served. The decoder must agree with the detected format; otherwise, and for
 * any decode error, the upload is rejected.
 */
export async function normalizeDomainIcon(bytes: Uint8Array): Promise<Buffer> {
  const format = detectDomainIconFormat(bytes);
  if (!format) throw new DomainIconError("unsupported_format");
  const options = { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" as const, pages: 1 };
  try {
    let image: Sharp;
    let expected: string;
    if (format === "ico") {
      const decoded = decodeIco(bytes);
      image = decoded.kind === "png"
        ? sharp(decoded.data, options)
        : sharp(decoded.data, { ...options, raw: { width: decoded.width, height: decoded.height, channels: 4 } });
      expected = decoded.kind === "png" ? "png" : "raw";
    } else {
      image = sharp(bytes, options);
      expected = format;
    }
    const metadata = await image.metadata();
    if (metadata.format !== expected) throw new DomainIconError("unsupported_format");
    return await image
      .resize(DOMAIN_ICON_SIZE, DOMAIN_ICON_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (error) {
    if (error instanceof DomainIconError) throw error;
    throw new DomainIconError("invalid_image");
  }
}
