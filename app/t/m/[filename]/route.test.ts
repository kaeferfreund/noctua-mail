import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath } from "@/lib/addons/outreach/db";
import { outreachMediaDir, prepareImage, saveOutreachImage } from "@/lib/addons/outreach/media";
import { GET, HEAD } from "./route";

const previousDirectory = process.env.NOCTUA_DATA_DIR;
const previousFlag = process.env.NOCTUA_ADDON_OUTREACH;
let directory: string;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "outreach-public-image-"));
  process.env.NOCTUA_DATA_DIR = directory;
  delete process.env.NOCTUA_ADDON_OUTREACH;
});
afterAll(() => {
  closeOutreachDb();
  if (previousDirectory === undefined) delete process.env.NOCTUA_DATA_DIR; else process.env.NOCTUA_DATA_DIR = previousDirectory;
  if (previousFlag === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previousFlag;
  rmSync(directory, { recursive: true, force: true });
});

function request(filename: string, method = "GET", headers?: HeadersInit) {
  const route = method === "HEAD" ? HEAD : GET;
  return route(new Request("https://links.example.test/t/m/image", { method, headers }), { params: Promise.resolve({ filename }) });
}

test("the public route serves only canonical, registered files, including with the addon disabled", async () => {
  expect((await request(`${"a".repeat(64)}.gif`)).status).toBe(404);
  expect(existsSync(getOutreachDbPath())).toBe(false);

  const bytes = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
  const db = await getOutreachDb();
  const prepared = prepareImage(bytes, "one.gif");
  const { image } = await saveOutreachImage(db, "test-mailbox", prepared, "test-user");
  const filename = image.url.split("/").pop()!;
  const response = await request(filename);
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(Object.fromEntries(response.headers)).toEqual({
    "cache-control": "public, max-age=31536000, immutable",
    "content-disposition": "inline",
    "content-length": String(bytes.length),
    "content-security-policy": "default-src 'none'; sandbox",
    "content-type": "image/gif",
    "cross-origin-resource-policy": "cross-origin",
    etag: `"${prepared.hash}"`,
    "x-content-type-options": "nosniff"
  });

  const head = await request(filename, "HEAD");
  expect(head.status).toBe(200);
  expect(head.headers.get("content-length")).toBe(String(bytes.length));
  expect(head.body).toBeNull();
  const cached = await request(filename, "GET", { "if-none-match": `"other", W/"${prepared.hash}"` });
  expect(cached.status).toBe(304);
  expect(cached.headers.get("etag")).toBe(response.headers.get("etag"));
  expect(cached.body).toBeNull();
  for (const bad of [`../${filename}`, `${filename}\n`, `${prepared.hash}.png`, `${"a".repeat(64)}.gif`]) {
    expect((await request(bad)).status).toBe(404);
  }
  unlinkSync(join(outreachMediaDir(), filename));
  expect((await request(filename, "HEAD", { "if-none-match": "*" })).status).toBe(404);
  expect(db.query("SELECT count(*) AS count FROM tracking_events").get()).toEqual({ count: 0 });
});

test("GET streams from the checked descriptor without calling readFile", async () => {
  const bytes = Buffer.alloc(512 * 1024, 0x78);
  Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64").copy(bytes);
  const { image } = await saveOutreachImage(await getOutreachDb(), "test-mailbox", prepareImage(bytes, "large.gif"), null);
  const filename = image.url.split("/").pop()!;
  const file = await open(join(outreachMediaDir(), filename), "r");
  const readFile = spyOn(Object.getPrototypeOf(file) as Pick<typeof file, "readFile">, "readFile");
  await file.close();
  try {
    const response = await request(filename);
    expect(response.status).toBe(200);
    unlinkSync(join(outreachMediaDir(), filename));
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(readFile).not.toHaveBeenCalled();
  } finally {
    readFile.mockRestore();
  }
});
