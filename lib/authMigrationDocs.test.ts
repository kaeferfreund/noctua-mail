import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("legacy auth references carry a Better Auth transition notice before unavailable configuration", () => {
  for (const [file, section] of [["README.md", "### Environment Variables"], ["doc/AUTHENTICATION.md", "# Authentication"], ["doc/DEPLOYMENT.md", "## Required Environment Variables"]]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split(section)[1];
    const notice = text.trimStart().split("\n")[0];
    for (const term of ["Better Auth", "cookie credential mode", "sealed sessions", "SESSION_SEAL_KEY", "legacy IMAP login", "Tauri desktop", "TEAM-INBOX.md", "TEAM-AUTH-PLAN.md"]) expect(notice).toContain(term);
  }
});
