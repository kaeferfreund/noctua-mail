import sanitizeHtml from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/node_modules/sanitize-html";
import postcss from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/node_modules/postcss";
import { isLocalMailResource, type RemoteContentMode } from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/lib/html/remoteContent.ts";
import { normalizeHtmlStructure } from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/lib/html/normalize.ts";

// sanitize-html starts from a tight allowlist. Extend it to cover typical
// HTML-email markup the viewer wants to render: tables, images, stylesheets,
// document structure, etc. External stylesheets (<link>) remain disallowed —
// they're a tracking vector (CSS load leaks open) and can restyle the webmail
// UI when not sandboxed. <iframe>, <object>, <embed>, <form>, and <base> are
// excluded for the usual XSS/phishing reasons. <meta> is allowed only with
// the explicitly allowlisted attributes below (charset, name, content).
// HTTP directives and sender-supplied referrer policies are removed.
// Remote-content permission applies to images, never CSS: url(), imports and
// font sources are filtered in both modes to avoid CSS-driven referrer leaks.
const SANITIZE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "picture",
    "source",
    "style",
    "html",
    "head",
    "meta",
    "body",
    "title",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "caption",
    "colgroup",
    "col",
    "center",
    "font",
    "u",
    "s",
    "strike"
  ],
  allowedAttributes: {
    "*": [
      "id",
      "class",
      "style",
      "title",
      "role",
      "dir",
      "lang",
      "xmlns",
      "xml:lang",
      "align",
      "valign",
      "bgcolor",
      "color",
      "width",
      "height"
    ],
    a: ["href", "name", "target", "rel"],
    source: ["srcset", "media", "type", "data-remote-srcset"],
    img: ["src", "srcset", "referrerpolicy", "data-remote-src", "data-remote-srcset", "alt", "title", "width", "height", "align"],
    table: ["border", "cellspacing", "cellpadding", "summary"],
    td: ["colspan", "rowspan", "headers", "scope"],
    th: ["colspan", "rowspan", "headers", "scope"],
    col: ["span"],
    colgroup: ["span"],
    font: ["face", "size"],
    body: ["bgcolor"],
    meta: ["charset", "name", "content"]
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "cid"],
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"], source: ["http", "https", "data", "cid"] },
  // Intentionally omit allowedStyles so inline style="..." attributes pass
  // through unfiltered. Emails rely on inline CSS for layout; sanitize-html
  // strips the whole style attribute when no explicit property allowlist
  // matches, and its allowlist schema does not accept a wildcard property
  // name.
  allowedClasses: { "*": [/.*/] },
  allowVulnerableTags: true,
  parser: { lowerCaseTags: true, lowerCaseAttributeNames: true }
};

const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

/** Preserve layout declarations; discard resource-bearing or ambiguous CSS. */
function privateCss(input: string, inline = false): string {
  try {
    const root = postcss.parse(inline ? `x{${input}}` : input);
    root.walkComments((comment) => { comment.remove(); });
    root.walkAtRules((rule) => {
      // Imports (including escaped spellings) and unknown directives need not
      // participate in email layout. Keep only inert layout containers.
      if (!/^(media|supports|layer|container|keyframes|-webkit-keyframes|page|font-face)$/i.test(rule.name)) rule.remove();
    });
    root.walkDecls((decl) => {
      const value = decl.value;
      // Escapes can hide URL functions and schemes. Discard the declaration
      // rather than trying to reinterpret CSS escape sequences as syntax.
      if (/\\|(?:image-set|src)\s*\(/i.test(value) || /\\/.test(decl.prop)) {
        decl.remove();
        return;
      }
      const urls = [...value.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)];
      if (urls.some((match) => !isLocalMailResource(match[1] ?? match[2] ?? match[3] ?? "")) ||
          (value.match(/url\s*\(/gi)?.length ?? 0) !== urls.length) decl.remove();
    });
    const output = root.toString();
    return inline ? output.slice(2, -1) : output;
  } catch {
    return "";
  }
}

function localSrcset(input: string) {
  let rest = input.trim();
  while (rest) {
    const token = /^([^\s]+)/.exec(rest)?.[1];
    if (!token) return false;
    const url = token.replace(/,+$/, "");
    if (!isLocalMailResource(url)) return false;
    rest = rest.slice(token.length).trimStart();
    if (!token.endsWith(",")) {
      const comma = rest.indexOf(",");
      if (comma < 0) return true;
      rest = rest.slice(comma + 1).trimStart();
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// SPIKE PROTOTYPE (outside git). Lines above are a verbatim copy of
// lib/html/sanitize.ts@0ac6cfa:1-133 (imports rewritten to absolute paths).

type CssFilter = (input: string, inline?: boolean) => string;

/** Memoized privateCss for one pair call. Pure function → same strings. */
export function memoCss(): CssFilter {
  const inlineCache = new Map<string, string>();
  const blockCache = new Map<string, string>();
  return (input, inline = false) => {
    const cache = inline ? inlineCache : blockCache;
    let out = cache.get(input);
    if (out === undefined) { out = privateCss(input, inline); cache.set(input, out); }
    return out;
  };
}

/** The body of sanitizeHtmlForDisplay after normalization, parameterised. */
export function sanitizeNormalized(normalized: string, mode: RemoteContentMode, css: CssFilter = privateCss, onRemoteRewrite?: () => void) {
  const block = mode === "block";
  const sanitized = sanitizeHtml(normalized, {
    ...SANITIZE_HTML_OPTIONS,
    transformTags: {
      "*": (tagName, original) => {
        const attribs = { ...original };
        delete attribs["http-equiv"];
        if (tagName === "meta" && attribs.name?.trim().toLowerCase() === "referrer") {
          delete attribs.name;
          delete attribs.content;
        }
        if (attribs.style) attribs.style = css(attribs.style, true);
        if (tagName === "img") attribs.referrerpolicy = "no-referrer";
        if (block && (tagName === "img" || tagName === "source")) {
          if (attribs.src && !isLocalMailResource(attribs.src)) {
            onRemoteRewrite?.();
            attribs["data-remote-src"] = attribs.src;
            attribs.src = BLANK_IMAGE;
          }
          if (attribs.srcset && !localSrcset(attribs.srcset)) {
            onRemoteRewrite?.();
            attribs["data-remote-srcset"] = attribs.srcset;
            delete attribs.srcset;
          }
        }
        return { tagName, attribs };
      }
    }
  });
  return sanitized.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open, cssText, close) => `${open}${css(cssText)}${close}`);
}

/** Same as today's sanitizeHtmlForDisplay, rebuilt from the parts. */
export function sanitizeSingle(input: string, mode: RemoteContentMode = "block") {
  if (!input) return input;
  return sanitizeNormalized(normalizeHtmlStructure(input), mode);
}

export type Pair = { block: string; allow: string };

/** Variant A: normalize once, two full sanitize-html passes. */
export function pairSharedNormalize(input: string): Pair {
  if (!input) return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  return { block: sanitizeNormalized(n, "block"), allow: sanitizeNormalized(n, "allow") };
}

/** Variant B: A + privateCss memo shared by both passes. */
export function pairSharedCss(input: string): Pair {
  if (!input) return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  const css = memoCss();
  return { block: sanitizeNormalized(n, "block", css), allow: sanitizeNormalized(n, "allow", css) };
}

/** Variant C: B + skip the allow pass when the block pass rewrote nothing.
 * The mode only matters inside the `block && ...` branch; if that branch never
 * changed an attribute, both transforms returned identical tags → identical
 * output, so allow === block exactly. */
export function pairSkipAllow(input: string): Pair {
  if (!input) return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  const css = memoCss();
  let rewrites = 0;
  const block = sanitizeNormalized(n, "block", css, () => { rewrites++; });
  const allow = rewrites ? sanitizeNormalized(n, "allow", css) : block;
  return { block, allow };
}

/** Variant D (measurement only): C without the CSS memo, to split savings. */
export function pairSkipAllowNoMemo(input: string): Pair {
  if (!input) return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  let rewrites = 0;
  const block = sanitizeNormalized(n, "block", privateCss, () => { rewrites++; });
  const allow = rewrites ? sanitizeNormalized(n, "allow") : block;
  return { block, allow };
}

/** Measurement only: sanitize-html core without any CSS filtering. */
export function sanitizeNoCss(normalized: string, mode: RemoteContentMode) {
  return sanitizeNormalized(normalized, mode, (s) => s);
}

export { privateCss };
