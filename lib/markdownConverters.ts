import type { Element, Root, RootContent } from "hast";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import TurndownService from "turndown";
import { unified } from "unified";
import { FORWARD_META_ATTR, forwardMetaHtmlToText } from "./html";

/*
 * Text-format conversion map (source → destination)
 * ==================================================
 *
 * This module is the canonical home for programmatic markdown ↔ html ↔ text
 * conversions invoked at compose time and when rendering outbound mail. The
 * table below enumerates every conversion path in the codebase so callers
 * can pick the right helper instead of reinventing one.
 *
 * | Direction      | Purpose                                   | Helper                                              |
 * |----------------|-------------------------------------------|-----------------------------------------------------|
 * | md → html      | Compose tab switch (markdown → html tab)  | `markdownToHtml` (this file; remark/rehype pipeline)|
 * | md → html      | Outbound email body (styled for clients)  | `markdownToEmailHtml` (lib/markdownEmail.ts)        |
 * | md → DOM       | Rendered message view, notes              | `<MarkdownContent>` (via MarkdownPanel.tsx)         |
 * | md → editor    | Compose markdown editor UI                | `@uiw/react-md-editor` (ComposeMarkdownEditor)      |
 * | md → DOM       | Compose markdown preview                  | `<MarkdownContent>` (as MarkdownPanel, no raw HTML) |
 * | html → md      | Compose tab switch (html → markdown tab)  | `htmlToMarkdown` (this file; uses `turndown`)       |
 * | html → md-ish  | Outbound text/plain fallback from HTML    | `htmlToMarkdown` (reused by composeContentBuilder)  |
 * | html → text    | Compose strip (quoted-parts, tab switch)  | `stripHtmlToText` (@/lib/html; regex-based)         |
 * | html → text    | Inbound IMAP preview / QP fallback        | `html-to-text` via `convert()` (lib/mail/imap.ts)   |
 * | html → html    | Display sanitization                      | `sanitizeHtmlForDisplay` (@/lib/html)               |
 * | text → md      | Compose tab switch (text → markdown tab)  | `textToMarkdown` (this file; pass-through)          |
 * | text → html    | Compose tab switch (text → html tab)      | inline `<p>…</p>` in composeTabSwitch.ts            |
 *
 * Why two `html → text` paths?
 *   `stripHtmlToText` is a zero-dep regex stripper used client-side for
 *   compose tab switches and quoted-parts extraction. `html-to-text` is a
 *   styling-aware converter used server-side during IMAP parsing (skip img,
 *   ignore href). Different use cases, legitimately separate libraries.
 *
 * Why two `md → html` paths?
 *   `markdownToHtml` (this file) produces the raw HTML that the compose tab
 *   switch pastes into the editor. `markdownToEmailHtml` wraps it and inlines
 *   the `@uiw/react-markdown-preview` stylesheet (also the compose preview's
 *   typography) so outbound mail renders consistently in external clients. Both sit on top of the same remark/rehype pipeline
 *   configured below, which shares its core plugins (`remark-gfm` +
 *   `remark-breaks`) with the display path's `react-markdown` configuration
 *   in `MarkdownPanel.tsx` — so compose preview, sent mail, and received
 *   mail run through the same parser stack (P2-13, replacing the previous
 *   `marked`-based send path).
 *
 *   Intentional deltas from the display path:
 *     - The send path enables `rehype-raw` so authors can embed raw HTML in
 *       markdown source and have it reach the recipient as HTML. Active
 *       content (scripts, frames, plugins, forms, event handlers, script
 *       URLs) is removed (`rehypeRemoveActiveContent`): a draft can be
 *       written by another mailbox member or an MCP client.
 *       `MarkdownPanel` deliberately does not, since received-mail HTML is
 *       untrusted and the display layer prefers escaping over rendering.
 *     - `MarkdownPanel` preprocesses input via `normalizeMarkdownBody` (fixes
 *       a handful of malformed-link patterns common in scraped/forwarded
 *       mail); the send path trusts its own output and skips that step.
 */

/**
 * Shared unified processor used to render markdown on the server.
 *
 * The pipeline deliberately mirrors the configuration used by
 * {@link MarkdownPanel} (react-markdown + remark-gfm + remark-breaks) so that
 * the compose live preview, the sent-mail HTML, and the received-mail display
 * all run through the same parser stack. See `lib/markdownEmail.ts` for the
 * send-path wrapper that inlines preview CSS.
 *
 *  - `remark-gfm`   : GitHub Flavored Markdown (tables, task lists, strike,
 *                     autolinks).
 *  - `remark-breaks`: treat a single `\n` inside a paragraph as `<br>`, which
 *                     matches the old `marked({ breaks: true })` behavior and
 *                     the display path.
 *  - `rehype-raw`   : retain any raw HTML that appears in the markdown source,
 *                     matching react-markdown's default when `rehype-raw` is
 *                     supplied (which MarkdownPanel does not currently pass,
 *                     but the send path has historically allowed via marked).
 *  - `rehypeRemoveActiveContent`: drops scripts, frames, plugins, forms,
 *                     event handlers and script URLs from that raw HTML.
 */
/** Elements that run code, embed documents or plugins, submit data or redirect. */
const ACTIVE_ELEMENTS = new Set([
  "script", "iframe", "frame", "frameset", "object", "embed", "applet", "portal",
  "form", "base", "meta", "link", "animate", "set", "handler", "listener"
]);
/** Attributes that take a URL (hast property names, lowercased). */
const URL_PROPERTIES = new Set([
  "href", "src", "srcset", "xlinkhref", "action", "formaction", "poster", "background", "cite", "data", "codebase", "dynsrc", "lowsrc"
]);

function isActiveUrl(value: unknown, tagName: string) {
  const url = String(value).replace(/[\u0000-\u0020]/g, "").toLowerCase();
  if (/^(?:javascript|vbscript|livescript):/.test(url)) return true;
  return url.startsWith("data:") && !((tagName === "img" || tagName === "source") && url.startsWith("data:image/"));
}

function removeActiveProperties(element: Element) {
  for (const [name, value] of Object.entries(element.properties)) {
    const key = name.toLowerCase();
    const values = Array.isArray(value) ? value : [value];
    if (key.startsWith("on") || key === "srcdoc" ||
        (URL_PROPERTIES.has(key) && values.some((entry) => isActiveUrl(entry, element.tagName)))) {
      delete element.properties[name];
    }
  }
}

function removeActiveNodes(children: RootContent[]): RootContent[] {
  return children.filter((child) => {
    if (child.type !== "element") return true;
    if (ACTIVE_ELEMENTS.has(child.tagName.toLowerCase())) return false;
    removeActiveProperties(child);
    child.children = removeActiveNodes(child.children) as Element["children"];
    if (child.tagName === "template" && child.content) child.content.children = removeActiveNodes(child.content.children);
    return true;
  });
}

/**
 * Removes active content from the HTML that raw HTML in a Markdown draft
 * produces; everything else (layout, styles, images) reaches the recipient
 * unchanged.
 */
function rehypeRemoveActiveContent() {
  return (tree: Root) => {
    tree.children = removeActiveNodes(tree.children);
  };
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeRemoveActiveContent)
  .use(rehypeStringify);

/**
 * Convert markdown source to plain HTML using the shared remark/rehype
 * pipeline. Output is intended to match what react-markdown produces in the
 * compose preview and the received-mail display path.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  return String(markdownProcessor.processSync(markdown));
}

/**
 * Convert HTML to markdown using Turndown.
 * Configured for clean, readable markdown output.
 */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  // Turndown has no table rule, so the forward header table would degrade to
  // one paragraph per cell.
  td.addRule("noctuaForwardMeta", {
    filter: (node: HTMLElement) =>
      node.nodeName === "TABLE" && node.getAttribute(FORWARD_META_ATTR) === "1",
    replacement: (_content: string, node: Node) =>
      `\n\n${forwardMetaHtmlToText((node as HTMLElement).outerHTML)}\n\n`
  });
  // Turndown escapes every line-leading hyphen, but only "- " list markers and
  // dash-only rules need it; "-- " signatures and dashed separators do not.
  return td.turndown(html).replace(/^\\-(?=-)(?!-{2,}\s*$)/gm, "-");
}

/**
 * Convert plain text to markdown.
 * Plain text is valid markdown, so this is essentially a pass-through.
 */
export function textToMarkdown(text: string): string {
  return text;
}
