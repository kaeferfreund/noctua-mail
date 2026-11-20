import { describe, expect, it } from "bun:test";
import { sanitizeHtmlForAppDocument, sanitizeHtmlForDisplay } from "@/lib/html";

// Safe link attributes are applied by the sanitizer on the parsed element
// (sanitizeHtmlForDisplay `safeLinks` option and sanitizeHtmlForAppDocument),
// not by rewriting serialized markup.
const safeLinks = (html: string) => sanitizeHtmlForDisplay(html, "block", { safeLinks: true });

const relTokens = (html: string) => (html.match(/rel="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean);

describe("safe link attributes", () => {
  it("adds target=_blank and rel=noopener noreferrer to bare anchor tags", () => {
    const result = safeLinks('<a href="https://example.test/x">link</a>');
    expect(result).toBe('<a href="https://example.test/x" target="_blank" rel="noreferrer noopener">link</a>');
  });

  it("leaves existing target attribute alone", () => {
    const result = safeLinks('<a href="https://example.test/x" target="_self">link</a>');
    expect(result).toContain('target="_self"');
    expect(result).not.toContain('target="_blank"');
  });

  it("augments existing rel attribute without dropping prior tokens", () => {
    const tokens = relTokens(safeLinks('<a href="https://example.test/x" rel="nofollow">link</a>'));
    expect(tokens).toEqual(["nofollow", "noopener", "noreferrer"]);
  });

  it("does not duplicate noopener/noreferrer when they already exist", () => {
    const tokens = relTokens(safeLinks('<a href="https://example.test/x" rel="noopener">link</a>'));
    expect(tokens.filter((t) => t === "noopener")).toHaveLength(1);
    expect(tokens).toContain("noreferrer");
  });

  it("handles multiple anchor tags and anchors without attributes", () => {
    expect(safeLinks('<a href="https://a.test/">A</a><a href="https://b.test/">B</a>').match(/target="_blank"/g)).toHaveLength(2);
    expect(safeLinks("<a>no href</a>")).toBe('<a target="_blank" rel="noreferrer noopener">no href</a>');
    expect(safeLinks('<A HREF="https://example.test/">x</A>')).toContain('target="_blank"');
    expect(relTokens(safeLinks("<a href='https://example.test/' rel='nofollow'>x</a>"))).toEqual(["nofollow", "noopener", "noreferrer"]);
  });

  it("is off by default for the message frame and on for the app document", () => {
    expect(sanitizeHtmlForDisplay('<a href="https://example.test/">x</a>')).toBe('<a href="https://example.test/">x</a>');
    expect(sanitizeHtmlForAppDocument('<a href="https://example.test/">x</a>')).toContain('rel="noreferrer noopener"');
  });
});
