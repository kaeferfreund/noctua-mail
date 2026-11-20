import { afterEach, expect, test } from "bun:test";
import { statSync } from "node:fs";
import path from "node:path";
import "./testDbHarness";
import { getExactMessageSourcePath, saveAttachmentData, saveMessageSource, stageMessageFiles } from "./storage";
import { getAttachmentsDir, getSourcesDir } from "./runtimePaths";
import { restrictNewFileModes } from "./server/privateFileModes";

const permissive = process.umask(0o022);
afterEach(() => { process.umask(0o022); });
process.on("exit", () => process.umask(permissive));

const groupOrOther = (file: string) => statSync(file).mode & 0o077;

test("S2: mail sources, attachments and their directories are owner-only under a permissive umask", async () => {
  const accountId = `modes-${crypto.randomUUID()}`;
  await saveMessageSource(accountId, "message-1", "Subject: synthetic\r\n\r\nbody");
  const source = getExactMessageSourcePath(accountId, "message-1");
  expect(groupOrOther(source)).toBe(0);
  expect(groupOrOther(path.dirname(source))).toBe(0);
  expect(groupOrOther(getSourcesDir())).toBe(0);

  await saveAttachmentData(accountId, "message-1", "attachment-1", Buffer.from("synthetic"));
  expect(groupOrOther(getAttachmentsDir())).toBe(0);

  const staged = await stageMessageFiles(accountId, [{ source: "Subject: staged\r\n\r\nbody", attachments: [] }]);
  try {
    expect(groupOrOther(staged.entries[0].source!.path)).toBe(0);
  } finally { await staged.cleanup(); }
});

test("S2: startup restricts the process umask for every later file (SQLite included)", () => {
  const previous = restrictNewFileModes();
  try {
    expect(previous).toBe(0o022);
    expect(process.umask() & 0o077).toBe(0o077);
  } finally { process.umask(previous); }
});
