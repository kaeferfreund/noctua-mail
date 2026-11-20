import { defaultTreeAdapter, parse, parseFragment, serialize, type DefaultTreeAdapterTypes as Tree } from "parse5";
import { escapeHtml } from "@/lib/html/strip";
import { htmlToPlainText } from "@/lib/mail/spam/input";
import { outreachPublicOrigin } from "../config";
import { imageFilename, imagePathPrefix } from "../media";
import { TEMPLATE_PLACEHOLDERS, type RenderResponse } from "../types";

// Each part can match a character in one way only, so a failed match costs linear time.
// The captures are trimmed by `placeholderParts` (`\s` and `String#trim` cover the same characters).
const placeholder = /{{([^{}]*)}}|{%((?:[^{}%]|%(?!}))*)%}/g;
const placeholderParts = (variable: string | undefined, tag: string | undefined) => [variable?.trim(), tag?.trim()] as const;
const expression = /^([\w.]+)(?:\s*\|\s*default\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'))?$/;
const known = new Set<string>(TEMPLATE_PLACEHOLDERS);
const urlAttributes = new Set(["href", "src", "background", "action", "formaction", "poster", "cite", "longdesc", "data"]);
const rawText = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]);

export function normalizeTemplate(value: string, html = false): string {
  return value.replaceAll(placeholder, (match, rawVariable: string | undefined, rawTag: string | undefined) => {
    const [variable, tag] = placeholderParts(rawVariable, rawTag);
    if (tag === "unsubscribe_link") return "{{ unsubscribe_url }}";
    if (tag === "current_year") return "{{ current_year }}";
    const unsubscribe = tag?.match(/^unsubscribe(?:\s+(['"])(.*?)\1)?$/s);
    if (unsubscribe) {
      const label = unsubscribe[2] || "Abmelden";
      return html ? `<a href="{{ unsubscribe_url }}">${escapeHtml(label)}</a>` : `${label}: {{ unsubscribe_url }}`;
    }
    const parsed = variable?.match(expression);
    if (!parsed || !known.has(parsed[1])) return match;
    const fallback = parsed[2] ?? parsed[3];
    return `{{ ${parsed[1]}${fallback === undefined ? "" : `|default:${JSON.stringify(fallback.replace(/\\(['"\\])/g, "$1"))}`} }}`;
  });
}

type ContactFields = { firstName: string; lastName: string; email: string };
export const sampleContact: ContactFields = { firstName: "Alex", lastName: "Muster", email: "alex@example.test" };
/** The unsubscribe URL of a preview: the page answers it without unsubscribing anyone. */
export const previewUnsubscribeUrl = () => `${outreachPublicOrigin() ?? "https://example.test"}/t/u/preview`;
export type Content = { subject: string; html: string; text: string; previewText?: string };
export type RenderOptions = {
  contact: ContactFields;
  organizationName: string;
  organizationAddress: string;
  unsubscribeUrl: string;
  now: number;
};

/** Strips the ASCII whitespace a URL attribute ignores (no regex: long runs must not backtrack). */
function trimUrlWhitespace(value: string) {
  const space = (char: string | undefined) => char === " " || char === "\t" || char === "\n" || char === "\f" || char === "\r";
  let start = 0;
  let end = value.length;
  while (start < end && space(value[start])) start++;
  while (end > start && space(value[end - 1])) end--;
  return value.slice(start, end);
}

function documentOrFragment(html: string) {
  return /^(?:\s|<!--(?:(?!-->)[\s\S])*-->)*(?:<!doctype\b|<html\b|<head\b|<body\b)/i.test(html) ? parse(html) : parseFragment(html);
}

function visit(node: Tree.Node, callback: (node: Tree.Node) => void) {
  callback(node);
  if ("childNodes" in node) for (const child of node.childNodes) visit(child, callback);
  if ("content" in node) visit((node as Tree.Template).content, callback);
}

export function renderContent(content: Content, options: RenderOptions): RenderResponse {
  const warnings = new Set<string>();
  const values = {
    first_name: options.contact.firstName, last_name: options.contact.lastName, email: options.contact.email,
    "organization.name": options.organizationName, "organization.full_address": options.organizationAddress,
    current_year: String(new Date(options.now).getUTCFullYear()), unsubscribe_url: options.unsubscribeUrl
  };

  const resolve = (rawVariable: string | undefined, rawTag: string | undefined) => {
    const [variable, tag] = placeholderParts(rawVariable, rawTag);
    const parsed = variable?.match(expression);
    if (!parsed || !known.has(parsed[1])) {
      warnings.add(`Unbekannter Platzhalter: ${(variable ?? tag ?? "").slice(0, 120)}`);
      return { name: "", value: "" };
    }
    const name = parsed[1] as keyof typeof values;
    return { name, value: values[name] || (parsed[2] ?? parsed[3] ?? "").replace(/\\(['"\\])/g, "$1") };
  };
  const renderText = (text: string) => normalizeTemplate(text).replaceAll(placeholder, (_match, variable, tag) => resolve(variable, tag).value);

  // Protect the syntax (including spaces and quotes) from the HTML tokenizer.
  const marker = `noctua${crypto.randomUUID().replaceAll("-", "")}p`;
  const markers = new RegExp(`${marker}(\\d+)z`, "g");
  const tokens: ReturnType<typeof resolve>[] = [];
  const encoded = normalizeTemplate(content.html, true).replaceAll(placeholder, (_match, variable, tag) => {
    tokens.push(resolve(variable, tag));
    return `${marker}${tokens.length - 1}z`;
  });
  const document = documentOrFragment(encoded);
  const replace = (value: string, mode: "text" | "url" | "comment" | "blocked" = "text") => value.replaceAll(markers, (_match, index, offset: number) => {
    const token = tokens[Number(index)];
    if (mode === "blocked") return "";
    if (mode === "text") return token.value;
    // Comment data is serialized verbatim: escaped, a value can close neither the comment nor an attribute in it.
    if (mode === "comment") return escapeHtml(token.value);
    // The server-generated URL can start an attribute (a query or fragment may follow). Other values are URL components.
    if (token.name === "unsubscribe_url" && !trimUrlWhitespace(value.slice(0, offset)) && token.value === options.unsubscribeUrl
      && /^https?:\/\//i.test(token.value)) {
      return token.value;
    }
    return encodeURIComponent(Buffer.from(token.value).toString());
  });
  const publicOrigin = outreachPublicOrigin();
  visit(document, node => {
    if ("attrs" in node) {
      for (const attr of node.attrs) {
        const blocked = /^on/i.test(attr.name) || ["style", "srcdoc", "srcset", "ping", "http-equiv"].includes(attr.name)
          || node.tagName === "meta" || node.tagName === "script";
        const dynamic = attr.value.includes(marker);
        attr.value = replace(attr.value, blocked ? "blocked" : urlAttributes.has(attr.name) ? "url" : "text");
        // A URL attribute ignores surrounding ASCII whitespace; drop it so the link matches the unsubscribe URL.
        if (dynamic && urlAttributes.has(attr.name)) attr.value = trimUrlWhitespace(attr.value);
        // Check the assembled URL too: static text and encoded values can jointly form a scheme.
        if (dynamic && urlAttributes.has(attr.name) && /^[a-z][a-z\d+.-]*:/i.test(attr.value.replace(/[\x00-\x20]/g, ""))
          && !/^(https?|mailto|tel|cid):/i.test(attr.value.trim())) attr.value = "";
        if (publicOrigin && node.tagName === "img" && attr.name === "src") {
          const src = trimUrlWhitespace(attr.value);
          if (src.startsWith(imagePathPrefix) && imageFilename.test(src.slice(imagePathPrefix.length))) {
            attr.value = publicOrigin + src;
          }
        }
      }
    }
    if ("value" in node) {
      const parent = node.parentNode;
      node.value = replace(node.value, parent && "tagName" in parent && rawText.has(parent.tagName) ? "blocked" : "text");
    }
    // Outlook renders the markup of conditional comments (`<!--[if mso]>…<![endif]-->`).
    if ("data" in node) node.data = replace(node.data, "comment");
  });
  // Markers in tag/attribute names (and malformed markup) cannot carry a substitution.
  const html = serialize(document).replaceAll(markers, "");
  const subject = renderText(content.subject).replace(/[\r\n]+/g, " ");
  const renderedText = renderText(content.text);
  const text = renderedText.trim() ? renderedText : htmlToPlainText(html);
  return { ok: true, subject, html, text, warnings: [...warnings] };
}

/** The preview text as the send path puts it in front of the HTML body: rendered like a subject. */
export function renderPreviewText(previewText: string, options: RenderOptions) {
  return renderContent({ subject: previewText, html: "", text: "" }, options);
}

/** A rendering without a subject or without a body; the send path refuses it (`content_empty`). */
export function isEmptyRendering(rendered: Pick<RenderResponse, "subject" | "html" | "text">) {
  return !rendered.subject.trim() || !(rendered.text.trim() || rendered.html.trim());
}

function htmlBody(tree: Tree.Document | Tree.DocumentFragment): Tree.Element | Tree.DocumentFragment | undefined {
  if (tree.nodeName === "#document-fragment") return tree;
  const html = tree.childNodes.find(node => "tagName" in node && node.tagName === "html") as Tree.Element;
  return html.childNodes.find((node): node is Tree.Element => "tagName" in node && node.tagName === "body");
}

const inert = new Set(["template", "script", "style", "noscript"]);

export function hasUnsubscribeLink(html: string, url: string) {
  function hasLink(node: Tree.Node): boolean {
    if ("tagName" in node) {
      if (inert.has(node.tagName) || node.attrs.some(attr => attr.name === "hidden")) return false;
      if (node.tagName === "a" && node.attrs.some(attr => attr.name === "href" && attr.value === url)) return true;
    }
    return "childNodes" in node && node.childNodes.some(hasLink);
  }
  const body = htmlBody(documentOrFragment(html));
  return body ? hasLink(body) : false;
}

export function addToHtmlBody(html: string, snippet: string, atStart = false) {
  const tree = documentOrFragment(html);
  const body = htmlBody(tree);
  if (!body) return snippet + html;
  // A hidden body also hides the footer. Preserve its original content in a hidden container.
  if ("attrs" in body) {
    const hidden = body.attrs.findIndex(attr => attr.name === "hidden");
    if (hidden !== -1) {
      body.attrs.splice(hidden, 1);
      const [container] = parseFragment("<div hidden></div>").childNodes as Tree.Element[];
      for (const child of body.childNodes.splice(0)) defaultTreeAdapter.appendChild(container, child);
      defaultTreeAdapter.appendChild(body, container);
    }
  }
  const first = atStart ? body.childNodes[0] : undefined;
  for (const node of parseFragment(snippet).childNodes) {
    if (first) defaultTreeAdapter.insertBefore(body, node, first);
    else defaultTreeAdapter.appendChild(body, node);
  }
  return serialize(tree);
}
