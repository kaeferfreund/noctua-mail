/**
 * Attribute policy for the custom Lexical nodes that keep HTML attributes of
 * imported mail markup (CenterNode, ExtendedTable*Node).
 *
 * Received HTML enters the rich editor through "edit as new", quote editing,
 * the HTML source view and drafts of other members (SD1). It is never
 * sanitized for that path, so a node that copies every attribute would carry
 * event handlers, `srcdoc`, `formaction` or `id`s into the app document.
 * Only presentational attributes survive the import; the live editor DOM gets
 * an even smaller set with a filtered inline style (no URLs, no positioning).
 */
import { sanitizeInlineStyle } from "@/lib/html/sanitize";

export type NodeAttributes = Record<string, string>;

// Kept on the node and written to the outgoing HTML (exportDOM).
const PRESERVED_ATTRIBUTES = new Set([
  "align",
  "valign",
  "width",
  "height",
  "bgcolor",
  "background",
  "border",
  "bordercolor",
  "cellpadding",
  "cellspacing",
  "colspan",
  "rowspan",
  "nowrap",
  "frame",
  "rules",
  "summary",
  "headers",
  "scope",
  "abbr",
  "style",
  "class",
  "dir",
  "lang",
  "title",
  "role"
]);

// Set on the element inside the editor (createDOM). No class (app styles), no
// background image (remote request without consent).
const LIVE_ATTRIBUTES = new Set(["align", "valign", "width", "height", "bgcolor", "dir", "lang", "title"]);

const BACKGROUND_URL = /^(?:https?:|cid:)/i;

// The outgoing HTML keeps the sender's inline style unchanged (no script runs
// from CSS); only the live editor element filters it.
function preservedValue(name: string, value: string): string | null {
  if (name === "background") return BACKGROUND_URL.test(value.trim()) ? value : null;
  return value;
}

/**
 * Filters attributes read from imported markup or a serialized editor state.
 * Accepts a DOM element (import) or a plain record (importJSON).
 */
export function filterImportedAttributes(source: Element | NodeAttributes | null | undefined): NodeAttributes {
  const result: NodeAttributes = {};
  if (!source) return result;
  const entries: Array<[string, unknown]> =
    typeof (source as Element).getAttributeNames === "function"
      ? (source as Element).getAttributeNames().map((name) => [name, (source as Element).getAttribute(name)])
      : Object.entries(source as NodeAttributes);
  for (const [rawName, rawValue] of entries) {
    if (typeof rawValue !== "string") continue;
    const name = rawName.toLowerCase();
    if (!PRESERVED_ATTRIBUTES.has(name)) continue;
    const value = preservedValue(name, rawValue);
    if (value !== null) result[name] = value;
  }
  return result;
}

/** Writes the preserved attributes to an exported element (outgoing HTML). */
export function applyExportAttributes(element: HTMLElement, attributes: NodeAttributes) {
  for (const [name, value] of Object.entries(filterImportedAttributes(attributes))) {
    element.setAttribute(name, value);
  }
}

/** Writes the editor-safe subset to an element mounted in the app document. */
export function applyLiveAttributes(element: HTMLElement, attributes: NodeAttributes) {
  const preserved = filterImportedAttributes(attributes);
  for (const [name, value] of Object.entries(preserved)) {
    if (LIVE_ATTRIBUTES.has(name)) element.setAttribute(name, value);
  }
  if (preserved.style) {
    const style = sanitizeInlineStyle(preserved.style, { dropPositioning: true });
    if (style) element.setAttribute("style", style);
  }
}
