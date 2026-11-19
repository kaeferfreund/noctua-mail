import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initOutreachSchema } from "../db";
import { renderContent, sampleContact } from "../sending/render";
import { OUTREACH_IMAGE_MAX_BYTES } from "../types";
import { decodeImageBase64, listOutreachImages, prepareImage, saveOutreachImage } from "./index";

let db: Database;
beforeEach(() => { db = initOutreachSchema(new Database(":memory:")); });
afterEach(() => { db.close(); });

const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

test("storage deduplicates concurrent uploads across mailboxes and retains the first upload metadata", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outreach-images-"));
  try {
    const a = prepareImage(gif, "foo.gif");
    const b = prepareImage(gif, "folder/bar.GIF");
    const [first, second] = await Promise.all([
      saveOutreachImage(db, "a", a, "user-a", dir), saveOutreachImage(db, "b", b, "user-b", dir)
    ]);
    const duplicate = await saveOutreachImage(db, "a", b, "user-b", dir);
    expect(duplicate).toEqual({ ...first, created: false });
    expect(second.image).toMatchObject({ url: first.image.url, accountId: "b", filename: "bar.GIF", width: 1, height: 1 });
    expect(listOutreachImages(db, "a")).toEqual([first.image]);
    expect(listOutreachImages(db, "b")).toEqual([second.image]);
    expect(listOutreachImages(db, "unknown")).toEqual([]);
    expect(db.query("SELECT createdByUserId FROM images WHERE accountId = 'a'").get()).toEqual({ createdByUserId: "user-a" });
    expect(readdirSync(dir)).toEqual([first.image.url.split("/").pop()!]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v4 upgrades add only image storage, preserving existing template data", () => {
  db.exec("DROP TABLE images; PRAGMA user_version = 4");
  db.query("INSERT INTO templates (id, accountId, name, createdAt, updatedAt) VALUES ('template', 'a', 'Test', 1, 1)").run();
  initOutreachSchema(db);
  expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 5 });
  expect(db.query("SELECT name FROM templates WHERE accountId = 'a'").get()).toEqual({ name: "Test" });
  expect(listOutreachImages(db, "a")).toEqual([]);
});

const headers = [
  { name: "x.png", type: "image/png", signatureSize: 8,
    hex: "89504e470d0a1a0a0000000d49484452000000030000000208020000001216f14d" },
  { name: "x.jpeg", type: "image/jpeg", signatureSize: 3,
    hex: "ffd8ffe000045859ffc0000b080002000301011100" },
  { name: "x.gif", type: "image/gif", signatureSize: 6,
    hex: "47494638396103000200000000" },
  { name: "x.webp", type: "image/webp", signatureSize: 12,
    hex: "524946461600000057454250565038580a00000000000000020000010000" },
  { name: "x.webp", type: "image/webp", signatureSize: 12,
    hex: "524946461600000057454250565038200a0000001000009d012a03000200" },
  { name: "x.webp", type: "image/webp", signatureSize: 12,
    hex: "5249464612000000574542505650384c050000002f0240000000" }
];

test.each(headers)("validates the complete $type header ($hex)", ({ name, type, signatureSize, hex }) => {
  const bytes = Buffer.from(hex, "hex");
  expect(prepareImage(bytes, name)).toMatchObject({ contentType: type, width: 3, height: 2 });
  expect(() => prepareImage(bytes.subarray(0, signatureSize), name)).toThrow("Use PNG");
  expect(() => prepareImage(bytes.subarray(0, -1), name)).toThrow("Use PNG");
});

test("rejects inconsistent length fields in otherwise complete image headers", () => {
  const fields = [
    [0, 11, 12], // PNG IHDR length
    [1, 5, 30],  // JPEG APP segment runs past the frame
    [1, 11, 10], // JPEG frame size disagrees with its component count
    [3, 4, 20],  // WebP RIFF length
    [4, 16, 9],  // WebP chunk declares less than a VP8 frame header
    [5, 16, 4]   // WebP chunk declares less than a VP8L header
  ];
  for (const [index, offset, value] of fields) {
    const { hex, name } = headers[index];
    const bytes = Buffer.from(hex, "hex");
    bytes[offset] = value;
    expect(() => prepareImage(bytes, name)).toThrow("Use PNG");
  }
});

test("rejects zero and oversized dimensions and accepts the 16,384 px boundary", () => {
  const png = Buffer.from(headers[0].hex, "hex");
  png.writeUInt32BE(16_384, 16);
  expect(prepareImage(png, "x.png").width).toBe(16_384);
  png.writeUInt32BE(16_385, 16);
  expect(() => prepareImage(png, "x.png")).toThrow("Use PNG");
  const gifHeader = Buffer.from(headers[2].hex, "hex");
  gifHeader.writeUInt16LE(0, 8);
  expect(() => prepareImage(gifHeader, "x.gif")).toThrow("Use PNG");
  const webp = Buffer.from(headers[3].hex, "hex");
  webp.writeUIntLE(16_384, 27, 3);
  expect(() => prepareImage(webp, "x.webp")).toThrow("Use PNG");
});

test("only matching filename suffixes and bounded, valid base64 are accepted", () => {
  expect(() => prepareImage(gif, "photo.png")).toThrow("extension");
  expect(() => prepareImage(Buffer.from("<svg/>"), "photo.png")).toThrow("Use PNG");
  expect(() => prepareImage(new Uint8Array(OUTREACH_IMAGE_MAX_BYTES + 1), "photo.png")).toThrow("5 MiB");
  expect(decodeImageBase64(gif.toString("base64"))).toEqual(gif);
  expect(() => decodeImageBase64("a !!")).toThrow("Invalid base64");
  expect(() => decodeImageBase64(Buffer.alloc(OUTREACH_IMAGE_MAX_BYTES + 1).toString("base64"))).toThrow("5 MiB");
});

test("mail rendering makes only canonical hosted img src paths absolute", () => {
  const previous = process.env.NOCTUA_OUTREACH_PUBLIC_URL;
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = "https://links.example.test/a";
  try {
    const local = `/t/m/${"a".repeat(64)}.jpg`;
    const html = `<img src="${local}" srcset="${local} 2x"><img src="/t/m/invalid.jpg"><img src="https://other.example.test/a.png"><a href="${local}">Link</a>`;
    const output = renderContent({ subject: "Test", html, text: "" }, {
      contact: sampleContact, organizationName: "", organizationAddress: "", unsubscribeUrl: "", now: 0
    });
    expect(output.html).toBe(html.replace(`src="${local}"`, `src="https://links.example.test${local}"`));
  } finally {
    if (previous === undefined) delete process.env.NOCTUA_OUTREACH_PUBLIC_URL;
    else process.env.NOCTUA_OUTREACH_PUBLIC_URL = previous;
  }
});
