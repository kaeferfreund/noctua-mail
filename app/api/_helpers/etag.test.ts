import { describe, expect, test } from "bun:test";
import { entityTagForStat, ifNoneMatchMatches } from "./etag";

describe("etag helpers", () => {
  test("builds a quoted mtime/size tag", () => {
    expect(entityTagForStat({ mtimeMs: 0x1a2b, size: 0x10 })).toBe(`"1a2b-10"`);
  });

  test("matches If-None-Match weakly and ignores other tags", () => {
    const etag = `"abc-10"`;
    expect(ifNoneMatchMatches(null, etag)).toBe(false);
    expect(ifNoneMatchMatches(etag, etag)).toBe(true);
    expect(ifNoneMatchMatches(`W/${etag}`, etag)).toBe(true);
    expect(ifNoneMatchMatches(`"other", ${etag}`, etag)).toBe(true);
    expect(ifNoneMatchMatches(`"other"`, etag)).toBe(false);
  });
});
