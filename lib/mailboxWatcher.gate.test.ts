import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";

for (const storage of ["db", "both", "cookie"]) {
  for (const flag of ["", "true", "01", "1"]) {
    test(`watcher gate requires supported team runtime and exact opt-in: storage=${storage}, flag=${flag || "unset"}`, () => {
      const result = spawnSync(process.execPath, ["-e", `
        import { mkdtempSync, rmSync } from 'node:fs';
        import { tmpdir } from 'node:os';
        import path from 'node:path';
        const dir = mkdtempSync(path.join(tmpdir(), 'noctua-watcher-gate-'));
        process.env.NOCTUA_DATA_DIR = dir;
        const { teamFeaturesSupported } = await import('./lib/teamFeatures');
        const { startMailboxWatcher, stopMailboxWatcher } = await import('./lib/mailboxWatcher');
        const started = startMailboxWatcher();
        console.log('GATE_RESULT', teamFeaturesSupported(), Boolean(started));
        await stopMailboxWatcher();
        (await import('./lib/db/connection')).closeAllDbConnections();
        rmSync(dir, { recursive: true, force: true });
      `], { cwd: process.cwd(), env: { ...process.env, IMAP_CREDENTIALS_STORAGE: storage, NOCTUA_MAILBOX_WATCHER: flag }, encoding: "utf8" });
      expect(result.status).toBe(0);
      const supported = storage !== "cookie";
      expect(result.stdout).toContain(`GATE_RESULT ${supported} ${supported && flag === "1"}`);
    });
  }
}
