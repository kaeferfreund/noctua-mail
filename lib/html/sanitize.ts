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

type CssFilter = (input: string, inline?: boolean) => string;

/**
 * privateCss memoized for a single sanitize call. privateCss is a pure
 * function of (input, inline), and mail markup repeats the same style
 * attribute hundreds of times. Scoped per call, never module-wide, so memory
 * stays bounded and nothing is shared across messages.
 */
function memoizedPrivateCss(): CssFilter {
  const inlineCache = new Map<string, string>();
  const sheetCache = new Map<string, string>();
  return (input, inline = false) => {
    const cache = inline ? inlineCache : sheetCache;
    let output = cache.get(input);
    if (output === undefined) {
      output = privateCss(input, inline);
      cache.set(input, output);
    }
    return output;
  };
}

/**
 * The display mode reaches sanitizeNormalized only as this gate: every
 * remote-content rewrite is handed to it, and only the block policy applies
 * it. Mode-dependent behavior therefore cannot bypass the gate, which is what
 * lets sanitizeHtmlForDisplayPair count rewrites and skip the allow pass when
 * there were none.
 */
type RemoteRewriteGate = (rewrite: () => void) => void;
const applyRemoteRewrite: RemoteRewriteGate = (rewrite) => rewrite();
const keepRemoteSource: RemoteRewriteGate = () => {};
const remoteRewriteGate = (mode: RemoteContentMode) => mode === "block" ? applyRemoteRewrite : keepRemoteSource;

/**
 * A style element is the only element whose text sanitize-html re-emits raw.
 * In foreign content (`<svg><style>`) htmlparser2 decodes that text, so
 * `&lt;/style&gt;&lt;img onerror…&gt;` would come out as live markup once the
 * svg wrapper is dropped. Style text that could end the element early is
 * discarded together with the element.
 */
const STYLE_END_TAG = /<\/style/i;

/**
 * Links in sanitized HTML open in a new browsing context without opener or
 * referrer. With `forceBlank` (HTML inside the app document) a sender
 * `target` (`_top`, `_parent`, `_self`, a named frame) is replaced too, so a
 * click never navigates the Noctua tab itself. Set on the element here, not
 * by rewriting the serialized markup, so attribute values stay attribute
 * values.
 */
function applySafeLinkAttributes(attribs: sanitizeHtml.Attributes, forceBlank: boolean) {
  if (forceBlank || attribs.target === undefined) attribs.target = "_blank";
  const tokens = (attribs.rel ?? "").split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    attribs.rel = "noreferrer noopener";
    return;
  }
  if (!tokens.includes("noopener")) tokens.push("noopener");
  if (!tokens.includes("noreferrer")) tokens.push("noreferrer");
  attribs.rel = tokens.join(" ");
}

/**
 * Sanitizer profile. `styleElements: false` drops `<style>` blocks with their
 * text and the document-level tags (`html`, `head`, `meta`, `body`, `title`;
 * the title text too): HTML rendered inside the app document, where a sender
 * stylesheet or `<meta name="viewport|theme-color">` would change the app.
 * `safeLinks` applies applySafeLinkAttributes.
 */
type SanitizeProfile = { styleElements: boolean; safeLinks: boolean };
const MESSAGE_FRAME_PROFILE: SanitizeProfile = { styleElements: true, safeLinks: false };
const APP_DOCUMENT_DROPPED_TAGS = new Set(["style", "html", "head", "meta", "body", "title"]);
const APP_DOCUMENT_ALLOWED_TAGS = (SANITIZE_HTML_OPTIONS.allowedTags as string[]).filter(
  (tag) => !APP_DOCUMENT_DROPPED_TAGS.has(tag)
);

function sanitizeNormalized(normalized: string, blockRemote: RemoteRewriteGate, css: CssFilter, profile = MESSAGE_FRAME_PROFILE) {
  const sanitized = sanitizeHtml(normalized, {
    ...SANITIZE_HTML_OPTIONS,
    allowedTags: profile.styleElements ? SANITIZE_HTML_OPTIONS.allowedTags : APP_DOCUMENT_ALLOWED_TAGS,
    // sanitize-html's own list plus title, whose text is not page content.
    ...(profile.styleElements ? {} : { nonTextTags: ["script", "style", "textarea", "option", "xmp", "title"] }),
    exclusiveFilter: (frame) => frame.tag === "style" && STYLE_END_TAG.test(frame.text),
    transformTags: {
      "*": (tagName, original) => {
        const attribs = { ...original };
        // HTTP directives never belong to the displayed message, in either mode.
        delete attribs["http-equiv"];
        if (tagName === "meta" && attribs.name?.trim().toLowerCase() === "referrer") {
          delete attribs.name;
          delete attribs.content;
        }
        if (attribs.style) attribs.style = css(attribs.style, true);
        // Inside the app document sender classes would pick up app styles
        // (look like app controls) and ids/names would clobber document
        // globals or collide with app anchors (SD20). Neither is needed
        // without the sender's own stylesheet.
        if (!profile.styleElements) {
          delete attribs.class;
          delete attribs.id;
          delete attribs.name;
        }
        if (tagName === "img") attribs.referrerpolicy = "no-referrer";
        if (tagName === "a" && profile.safeLinks) applySafeLinkAttributes(attribs, !profile.styleElements);
        // The only mode-dependent code, and it runs only through the gate.
        if (tagName === "img" || tagName === "source") {
          if (attribs.src && !isLocalMailResource(attribs.src)) blockRemote(() => {
            attribs["data-remote-src"] = attribs.src;
            attribs.src = BLANK_IMAGE;
          });
          // A srcset may mix remote and inline candidates (and data URLs contain
          // commas). Retain only wholly local sets; src remains the fallback.
          if (attribs.srcset && !localSrcset(attribs.srcset)) blockRemote(() => {
            attribs["data-remote-srcset"] = attribs.srcset;
            delete attribs.srcset;
          });
        }
        return { tagName, attribs };
      }
    }
  });
  if (!profile.styleElements) return sanitized;
  // sanitize-html deliberately bypasses textFilter for raw style text. Filter
  // canonical style elements after the HTML allowlist has run instead. The
  // exclusiveFilter above guarantees that no style text contains `</style`, so
  // each match is exactly one element. `<` is then written as the CSS escape
  // `\3c `: style text carries no markup at all, and later string steps
  // (document title, body extraction, linkify) cannot mistake it for tags.
  return sanitized.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open, cssText, close) => `${open}${css(cssText).replace(/</g, "\\3c ")}${close}`);
}

export type SanitizeDisplayOptions = { safeLinks?: boolean };

export function sanitizeHtmlForDisplay(input: string, mode: RemoteContentMode = "block", options: SanitizeDisplayOptions = {}) {
  if (!input) return input;
  const profile = options.safeLinks ? { ...MESSAGE_FRAME_PROFILE, safeLinks: true } : MESSAGE_FRAME_PROFILE;
  return sanitizeNormalized(normalizeHtmlStructure(input), remoteRewriteGate(mode), memoizedPrivateCss(), profile);
}

/**
 * Sender HTML that is inserted into the app document itself (calendar event
 * descriptions and source-mail snapshots) instead of the sandboxed message
 * frame: no `<style>` elements (a sender stylesheet would apply to the whole
 * app), no class/id/name attributes, safe link attributes, remote images
 * blocked. Inline styles stay for
 * formatting; the container must confine them (`contain: paint`, see
 * app/components/calendar/SenderHtml.module.css) so positioned content cannot cover
 * app controls.
 */
export function sanitizeHtmlForAppDocument(input: string) {
  if (!input) return input;
  return sanitizeNormalized(normalizeHtmlStructure(input), applyRemoteRewrite, memoizedPrivateCss(),
    { styleElements: false, safeLinks: true });
}

/**
 * Declarations that take an element out of the normal flow or move it over
 * other content. Mail HTML that the rich compose editor mounts in the app
 * document must not lay itself over the toolbar or other app controls.
 */
const POSITIONING_PROPERTY = /^(?:position|z-index|inset(?:-.*)?|top|right|bottom|left|translate|transform|float)$/i;

/**
 * One sender `style` attribute for an element inside the app document: the
 * viewer's inline-CSS filter (no URLs, imports or escapes) plus, with
 * `dropPositioning`, no positioning or stacking declarations.
 */
export function sanitizeInlineStyle(style: string, options: { dropPositioning?: boolean } = {}) {
  const filtered = privateCss(style, true);
  if (!options.dropPositioning || !filtered.trim()) return filtered.trim();
  try {
    const root = postcss.parse(`x{${filtered}}`);
    root.walkDecls((decl) => {
      if (POSITIONING_PROPERTY.test(decl.prop.trim())) decl.remove();
    });
    return root.toString().slice(2, -1).trim();
  } catch {
    return "";
  }
}

export type SanitizedHtmlPair = { block: string; allow: string };

/**
 * Both display policies for one message, equal to calling
 * sanitizeHtmlForDisplay(input, "block") and (input, "allow"). Normalizes
 * once and shares the CSS memo between the passes. When the block pass
 * rewrote no remote source, the allow pass would run identical transforms,
 * so its result is the block result and `block !== allow` stays the exact
 * "message has remote content" signal.
 */
export function sanitizeHtmlForDisplayPair(input: string): SanitizedHtmlPair {
  if (!input) return { block: input, allow: input };
  const normalized = normalizeHtmlStructure(input);
  const css = memoizedPrivateCss();
  let remoteRewrites = 0;
  const block = sanitizeNormalized(normalized, (rewrite) => {
    remoteRewrites += 1;
    applyRemoteRewrite(rewrite);
  }, css);
  const allow = remoteRewrites ? sanitizeNormalized(normalized, keepRemoteSource, css) : block;
  return { block, allow };
}
