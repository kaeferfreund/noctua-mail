import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initOutreachSchema, OUTREACH_SCHEMA_VERSION } from "../db";
import { renderContent, sampleContact } from "../sending/render";
import { OUTREACH_IMAGE_MAX_BYTES } from "../types";
import { removeHistorySchema } from "../testFixtures/legacySchema";
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

test("a mailbox's new images must fit its storage quota; known images and other mailboxes are not affected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outreach-images-"));
  try {
    const variant = (marker: number) => prepareImage(Buffer.concat([gif, Buffer.from([marker])]), `v${marker}.gif`);
    const quota = (gif.length + 1) * 2;
    await saveOutreachImage(db, "a", variant(1), "user-a", dir, quota);
    await saveOutreachImage(db, "a", variant(2), "user-a", dir, quota);
    const files = readdirSync(dir).length;
    await expect(saveOutreachImage(db, "a", variant(3), "user-a", dir, quota))
      .rejects.toMatchObject({ status: 413, code: "image_quota_exceeded" });
    // Refused before anything is written.
    expect(readdirSync(dir).length).toBe(files);
    expect(listOutreachImages(db, "a")).toHaveLength(2);
    expect(await saveOutreachImage(db, "a", variant(1), "user-a", dir, quota)).toMatchObject({ ok: true, created: false });
    expect(await saveOutreachImage(db, "b", variant(3), "user-b", dir, quota)).toMatchObject({ ok: true, created: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("new image files must fit the limit for all mailboxes and leave the data volume's free-space reserve", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outreach-images-"));
  try {
    const variant = (marker: number) => prepareImage(Buffer.concat([gif, Buffer.from([marker])]), `v${marker}.gif`);
    const size = gif.length + 1;
    const total = { totalBytes: size * 2, reserveBytes: 0 };
    await saveOutreachImage(db, "a", variant(1), "user-a", dir, Number.POSITIVE_INFINITY, total);
    await saveOutreachImage(db, "b", variant(2), "user-b", dir, Number.POSITIVE_INFINITY, total);
    const files = readdirSync(dir).length;
    // Each mailbox is under its own quota, but together they would exceed the total.
    await expect(saveOutreachImage(db, "c", variant(3), "user-c", dir, Number.POSITIVE_INFINITY, total))
      .rejects.toMatchObject({ status: 413, code: "image_storage_full" });
    expect(readdirSync(dir).length).toBe(files);
    // A file that is already stored costs no further space.
    expect(await saveOutreachImage(db, "c", variant(1), "user-c", dir, Number.POSITIVE_INFINITY, total))
      .toMatchObject({ ok: true, created: true });

    const reserve = { reserveBytes: 1024, freeBytes: async () => 1024 + size - 1 };
    await expect(saveOutreachImage(db, "a", variant(4), "user-a", dir, Number.POSITIVE_INFINITY, reserve))
      .rejects.toMatchObject({ status: 413, code: "image_storage_full" });
    expect(readdirSync(dir).length).toBe(files);
    expect(await saveOutreachImage(db, "a", variant(4), "user-a", dir, Number.POSITIVE_INFINITY,
      { ...reserve, freeBytes: async () => 1024 + size })).toMatchObject({ ok: true, created: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v4 upgrades add image storage and preserve existing template and send data", () => {
  removeHistorySchema(db);
  db.exec("DROP TABLE images; PRAGMA user_version = 4");
  db.query("INSERT INTO templates (id, accountId, name, createdAt, updatedAt) VALUES ('template', 'a', 'Test', 1, 1)").run();
  db.query("INSERT INTO sends (id, accountId, kind, status, queuedAt) VALUES ('send', 'a', 'mail', 'sent', 1)").run();
  initOutreachSchema(db);
  expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: OUTREACH_SCHEMA_VERSION });
  expect(db.query("SELECT name FROM templates WHERE accountId = 'a'").get()).toEqual({ name: "Test" });
  expect(db.query("SELECT id, status, source FROM sends WHERE accountId = 'a'").get()).toEqual({ id: "send", status: "sent", source: "native" });
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
