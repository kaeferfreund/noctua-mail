import sanitizeHtml from "sanitize-html";
import postcss from "postcss";
import { isLocalMailResource, type RemoteContentMode } from "./remoteContent";
import { normalizeHtmlStructure } from "./normalize";

// sanitize-html starts from a tight allowlist. Extend it to cover typical
// HTML-email markup the viewer wants to render: tables, images, stylesheets,
// document structure, etc. External stylesheets (<link>) remain disallowed —
// they're a tracking vector (CSS load leaks open) and can restyle the webmail
// UI when not sandboxed. <iframe>, <object>, <embed>, <form>, and <base> are
// excluded for the usual XSS/phishing reasons. <meta> is allowed only with
// the explicitly allowlisted attributes below (charset, name, content).
// HTTP directives and sender-supplied referrer policies are removed.
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
    img: ["src", "srcset", "data-remote-src", "data-remote-srcset", "alt", "title", "width", "height", "align"],
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

export function sanitizeHtmlForDisplay(input: string, mode: RemoteContentMode = "block") {
  if (!input) return input;
  const block = mode === "block";
  const sanitized = sanitizeHtml(normalizeHtmlStructure(input), {
    ...SANITIZE_HTML_OPTIONS,
    transformTags: {
      "*": (tagName, original) => {
        const attribs = { ...original };
        // HTTP directives never belong to the displayed message, in either mode.
        delete attribs["http-equiv"];
        if (tagName === "meta" && attribs.name?.trim().toLowerCase() === "referrer") {
          delete attribs.name;
          delete attribs.content;
        }
        if (block && attribs.style) attribs.style = privateCss(attribs.style, true);
        if (block && (tagName === "img" || tagName === "source")) {
          if (attribs.src && !isLocalMailResource(attribs.src)) {
            attribs["data-remote-src"] = attribs.src;
            attribs.src = BLANK_IMAGE;
          }
          // A srcset may mix remote and inline candidates (and data URLs contain
          // commas). Retain only wholly local sets; src remains the fallback.
          if (attribs.srcset && !localSrcset(attribs.srcset)) {
            attribs["data-remote-srcset"] = attribs.srcset;
            delete attribs.srcset;
          }
        }
        return { tagName, attribs };
      }
    }
  });
  // sanitize-html deliberately bypasses textFilter for raw style text. Filter
  // canonical style elements after the HTML allowlist has run instead.
  return block ? sanitized.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open, css, close) => `${open}${privateCss(css)}${close}`) : sanitized;
}
