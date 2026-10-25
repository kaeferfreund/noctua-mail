import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { DomainIconError, decodeIco, detectDomainIconFormat, normalizeDomainIcon } from "./domainIconImage";

const red = { r: 220, g: 20, b: 20, alpha: 1 };

function solid(width: number, height: number) {
  return sharp({ create: { width, height, channels: 4, background: red } });
}

/** ICO container around the given entries (each PNG bytes or a DIB). */
function icoFile(entries: Array<{ width: number; height: number; data: Uint8Array }>) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach((entry, index) => {
    const at = 6 + index * 16;
    header[at] = entry.width % 256; header[at + 1] = entry.height % 256;
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(entry.data.length, at + 8); header.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });
  return Buffer.concat([header, ...entries.map(entry => Buffer.from(entry.data))]);
}

/** 24-bit DIB (bottom-up, doubled height) whose AND mask makes the left half transparent. */
function dib24(width: number, height: number) {
  const stride = Math.ceil((width * 24) / 32) * 4, maskStride = Math.ceil(width / 32) * 4;
  const data = Buffer.alloc(40 + stride * height + maskStride * height);
  data.writeUInt32LE(40, 0); data.writeInt32LE(width, 4); data.writeInt32LE(height * 2, 8);
  data.writeUInt16LE(1, 12); data.writeUInt16LE(24, 14);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = 40 + y * stride + x * 3;
      data[pixel] = 0; data[pixel + 1] = 0; data[pixel + 2] = 255; // BGR red
    }
    const mask = 40 + stride * height + y * maskStride;
    for (let x = 0; x < width / 2; x += 1) data[mask + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return data;
}

async function pixels(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info, at: (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)] };
}

async function rejection(bytes: Uint8Array) {
  try { await normalizeDomainIcon(bytes); } catch (error) { return error instanceof DomainIconError ? error.code : String(error); }
  return "accepted";
}

describe("detectDomainIconFormat", () => {
  test("reads the magic bytes, not names or types", async () => {
    expect(detectDomainIconFormat(await solid(4, 4).png().toBuffer())).toBe("png");
    expect(detectDomainIconFormat(await solid(4, 4).jpeg().toBuffer())).toBe("jpeg");
    expect(detectDomainIconFormat(await solid(4, 4).webp().toBuffer())).toBe("webp");
    expect(detectDomainIconFormat(icoFile([{ width: 4, height: 4, data: dib24(4, 4) }]))).toBe("ico");
    expect(detectDomainIconFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectDomainIconFormat(Buffer.from("GIF89a"))).toBeNull();
    expect(detectDomainIconFormat(Buffer.from("<html>"))).toBeNull();
    expect(detectDomainIconFormat(new Uint8Array())).toBeNull();
  });
});

describe("normalizeDomainIcon", () => {
  test("contains a wide image on a transparent 64×64 PNG", async () => {
    const png = await normalizeDomainIcon(await solid(200, 100).png().toBuffer());
    const image = await pixels(png);
    expect([image.info.width, image.info.height]).toEqual([64, 64]);
    expect(image.at(32, 32)).toEqual([220, 20, 20, 255]);
    // Letterbox above and below: aspect kept, padding transparent.
    expect(image.at(32, 2)[3]).toBe(0);
    expect(image.at(32, 61)[3]).toBe(0);
  });

  test("accepts JPEG and WEBP and re-encodes them as PNG without metadata", async () => {
    for (const input of [await solid(30, 30).jpeg().withMetadata({ exif: { IFD0: { Copyright: "synthetic" } } }).toBuffer(), await solid(30, 30).webp().toBuffer()]) {
      const png = await normalizeDomainIcon(input);
      expect(detectDomainIconFormat(png)).toBe("png");
      const metadata = await sharp(png).metadata();
      expect([metadata.width, metadata.height, metadata.exif]).toEqual([64, 64, undefined]);
    }
  });

  test("reads the largest ICO entry, embedded PNG or 24-bit bitmap with mask", async () => {
    const small = await solid(16, 16).png().toBuffer();
    const large = await sharp({ create: { width: 48, height: 48, channels: 4, background: { r: 0, g: 0, b: 200, alpha: 1 } } }).png().toBuffer();
    const fromPng = await pixels(await normalizeDomainIcon(icoFile([{ width: 16, height: 16, data: small }, { width: 48, height: 48, data: large }])));
    expect(fromPng.at(32, 32)).toEqual([0, 0, 200, 255]);

    const fromBitmap = await pixels(await normalizeDomainIcon(icoFile([{ width: 32, height: 32, data: dib24(32, 32) }])));
    expect(fromBitmap.at(48, 32)).toEqual([255, 0, 0, 255]);
    expect(fromBitmap.at(8, 32)[3]).toBe(0);
  });

  test("rejects SVG, other formats, broken images and broken ICO containers", async () => {
    expect(await rejection(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'))).toBe("unsupported_format");
    expect(await rejection(await solid(4, 4).gif().toBuffer())).toBe("unsupported_format");
    // Right magic, garbage after it.
    expect(await rejection(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]))).toBe("invalid_image");
    // PNG magic in front of a JPEG body: the decoder must agree with the magic.
    const jpeg = await solid(8, 8).jpeg().toBuffer();
    expect(await rejection(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), jpeg]))).toBe("invalid_image");
    // ICO whose entry points past the end of the file.
    const ico = icoFile([{ width: 4, height: 4, data: dib24(4, 4) }]);
    ico.writeUInt32LE(ico.length, 6 + 12);
    expect(await rejection(ico)).toBe("invalid_image");
    // ICO wrapping an SVG entry.
    expect(await rejection(icoFile([{ width: 4, height: 4, data: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>".padEnd(64)) }]))).toBe("invalid_image");
    expect(() => decodeIco(Buffer.from([0, 0, 1, 0, 0, 0]))).toThrow(DomainIconError);
  });

  test("refuses a decompression bomb above the pixel cap", async () => {
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png({ compressionLevel: 9 }).toBuffer();
    expect(huge.length).toBeLessThan(512 * 1024);
    expect(await rejection(huge)).toBe("invalid_image");
  });
});
