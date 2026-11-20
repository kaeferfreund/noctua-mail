import { randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Eval and apply reports name senders, subjects and mailbox paths. They are
 * written owner-only to a new file and renamed into place, so an existing file
 * or link at the path (for example one another user placed in a shared temp
 * directory) is never written through.
 */
export function writePrivateJson(file: string, value: unknown) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** A report another local user could have written or replaced is refused before it drives any change. */
export function readPrivateJson(file: string): unknown {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error(`${file} is not a regular file`);
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
      throw new Error(`${file} must belong to the current user`);
    }
    // Group write stays allowed: with per-user groups (umask 002) it is the default for edited files.
    if (stat.mode & 0o002) throw new Error(`${file} must not be writable by others`);
    return JSON.parse(readFileSync(fd, "utf8"));
  } finally {
    closeSync(fd);
  }
}
