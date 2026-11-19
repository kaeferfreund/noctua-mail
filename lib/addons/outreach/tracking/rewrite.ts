import type { Database } from "bun:sqlite";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { newOutreachToken } from "../ids";
import type { TrackedHtmlInput } from "./index";

const MAX_TRACKED_URL_LENGTH = 2_048;
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

function trimHtmlWhitespace(value: string): string {
  return value.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, "");
}

export function httpTarget(value: string): URL | null {
  const raw = trimHtmlWhitespace(value);
  // URL() recovers inputs such as "https:example.test" and normalizes literal
  // controls and backslashes. Require an absolute HTTP(S) URL as written.
  if (!/^https?:\/\/[^/]/i.test(raw) || /[\s\u0000-\u001f\u007f\\]/u.test(raw)) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

type HtmlNode = DefaultTreeAdapterMap["node"];

function* htmlElements(root: HtmlNode) {
  const nodes = [root];
  while (nodes.length) {
    const node = nodes.pop()!;
    if ("childNodes" in node) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) nodes.push(node.childNodes[i]);
    }
    if ("tagName" in node && node.namespaceURI === HTML_NAMESPACE) yield node;
  }
}

/** Called inside a transaction with the owning send present. */
export function rewriteTrackedHtml(db: Database, input: TrackedHtmlInput, origin: string): string {
  const document = parse(input.html, { sourceCodeLocationInfo: true });
  const keep = new Set(input.keepUrls?.map(url => httpTarget(url)?.href ?? url));
  const targets = new Map<string, string>();
  const edits = new Map<number, { end: number; replacement: string }>();
  let bodyEnd: number | undefined;
  let htmlEnd: number | undefined;
  const insert = db.prepare(`INSERT INTO tracking_links (token, accountId, sendId, kind, url, contactId, createdAt)
    SELECT ?, accountId, id, ?, ?, COALESCE(?, contactId), ? FROM sends WHERE accountId = ? AND id = ?`);
  const now = Date.now();

  function tokenFor(kind: "open" | "click", url: string | null): string {
    const token = newOutreachToken();
    const { changes } = insert.run(token, kind, url, input.contactId ?? null, now, input.accountId, input.sendId);
    if (changes !== 1) throw new Error("Tracking send does not exist");
    return token;
  }

  for (const node of htmlElements(document)) {
    const location = node.sourceCodeLocation;
    if (node.tagName === "body") bodyEnd = location?.endTag?.startOffset;
    if (node.tagName === "html") htmlEnd = location?.endTag?.startOffset;
    if (!input.trackClicks || node.tagName !== "a") continue;

    const href = node.attrs.find(attr => attr.name === "href" && !attr.namespace);
    const span = location?.attrs?.href;
    if (!href || !span || edits.has(span.startOffset)) continue;
    if (href.value.length > MAX_TRACKED_URL_LENGTH) continue;
    const url = httpTarget(href.value);
    if (!url || url.href.length > MAX_TRACKED_URL_LENGTH || url.pathname.startsWith("/t/") || keep.has(url.href)) continue;
    let token = targets.get(url.href);
    if (!token) {
      token = tokenFor("click", url.href);
      targets.set(url.href, token);
    }
    edits.set(span.startOffset, { end: span.endOffset, replacement: `href="${origin}/t/c/${token}"` });
  }

  const parts: string[] = [];
  let offset = 0;
  const originalPixelOffset = bodyEnd ?? htmlEnd ?? input.html.length;
  let pixelOffset = originalPixelOffset;
  for (const [start, edit] of [...edits].sort(([a], [b]) => a - b)) {
    parts.push(input.html.slice(offset, start), edit.replacement);
    if (edit.end <= originalPixelOffset) pixelOffset += edit.replacement.length - (edit.end - start);
    offset = edit.end;
  }
  parts.push(input.html.slice(offset));
  const html = parts.join("");
  if (!input.trackOpens) return html;

  const token = tokenFor("open", null);
  const src = `${origin}/t/o/${token}.gif`;
  const withPixel = `${html.slice(0, pixelOffset)}<img src="${src}" width="1" height="1" alt="">${html.slice(pixelOffset)}`;
  for (const node of htmlElements(parse(withPixel))) {
    if (node.tagName === "img" && node.attrs.some(attr => attr.name === "src" && attr.value === src)) return withPixel;
  }
  db.prepare("DELETE FROM tracking_links WHERE accountId = ? AND sendId = ? AND token = ?").run(input.accountId, input.sendId, token);
  return html;
}
