"use client";

import { useTranslations } from "next-intl";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  QUOTE_TEXT_SCAN_LIMIT,
  canWrapQuoteInParent,
  extractBodyContent,
  hasQuoteBoundaryMarker,
  isQuoteBoundaryText,
  isTableLayoutTag,
  rewriteHtmlViewportHeightUnits,
  sanitizeHtmlForDisplayPair,
  shouldCollapseQuote,
  shouldShowHtmlViewerFrame,
  stripBodyHeightStyles,
  stripConditionalComments,
  type SanitizedHtmlPair
} from "@/lib/html";
import { useMessageLinkPreview } from "@/app/components/mailclient/message/MessageLinkPreviewContext";
import { Button } from "@/app/components/ui/button";
import { useRemoteContent } from "@/app/hooks/useRemoteContent";
import { messageHtmlCsp, type RemoteContentMode } from "@/lib/html/remoteContent";
import styles from "./HtmlMessage.module.css";
import { APP_FONT_FACE_CSS, APP_FONT_STACK } from "@/lib/ui/fonts";

const NOCTUA_EMAIL_CONTENT_CLASS = "noctua-email-content";
const NOCTUA_EMAIL_VIEWPORT_CLASS = "noctua-email-viewport";
const NOCTUA_EMAIL_VIEWPORT_DEFAULT_MARGIN_CLASS = "noctua-email-viewport--default-margin";
const NOCTUA_QUOTE_COLLAPSE_CLASS = "noctua-quote-collapse";
const NOCTUA_QUOTE_CONTENT_CLASS = "noctua-quote-collapse-content";
const NOCTUA_IMAGE_ALT_CLASS = "noctua-image-alt";
const QUOTE_ANIMATION_MS = 220;

// Stamped on every generated document so an effect run can recognise its own
// srcdoc in the frame and ignore whatever is still loaded there.
let previewDocumentSequence = 0;

function scaleFontSizes(input: string) {
  return input
    .replace(
      /font-size\s*:\s*([0-9]*\.?[0-9]+)px/gi,
      "font-size: calc($1px * var(--font-scale))"
    )
    .replace(
      /font-size\s*:\s*([0-9]*\.?[0-9]+)pt/gi,
      "font-size: calc($1pt * var(--font-scale))"
    )
    .replace(
      /font-size\s*:\s*([0-9]*\.?[0-9]+)rem/gi,
      "font-size: calc($1rem * var(--font-scale))"
    )
    .replace(
      /font-size\s*:\s*([0-9]*\.?[0-9]+)em/gi,
      "font-size: calc($1em * var(--font-scale))"
    );
}

function prefixSelectors(css: string, prefix: string) {
  return css.replace(/(^|})\s*([^@\s][^{]+)\{/g, (match, brace, selector) => {
    const next = selector
      .split(",")
      .map((part: string) => `${prefix}${part.trim()}`)
      .join(", ");
    return `${brace}\n${next}{`;
  });
}

function extractPrefersColorScheme(css: string, theme: "dark" | "light") {
  let injected = "";
  let output = "";
  let i = 0;
  const lower = css.toLowerCase();
  while (i < css.length) {
    const mediaIndex = lower.indexOf("@media", i);
    if (mediaIndex === -1) {
      output += css.slice(i);
      break;
    }
    output += css.slice(i, mediaIndex);
    const openBrace = css.indexOf("{", mediaIndex + "@media".length);
    if (openBrace === -1) {
      output += css.slice(mediaIndex);
      break;
    }
    const header = css.slice(mediaIndex, openBrace);
    let depth = 1;
    let j = openBrace + 1;
    while (j < css.length && depth > 0) {
      const char = css[j];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      j += 1;
    }
    const block = css.slice(openBrace + 1, j - 1);
    const headerLower = header.toLowerCase();
    if (headerLower.includes("prefers-color-scheme")) {
      const isDark = headerLower.includes("prefers-color-scheme: dark");
      const isLight = headerLower.includes("prefers-color-scheme: light");
      if ((theme === "dark" && isDark) || (theme === "light" && isLight)) {
        injected += `\n${prefixSelectors(block, `html[data-theme="${theme}"] `)}`;
      }
    } else {
      output += css.slice(mediaIndex, j);
    }
    i = j;
  }
  return { stripped: output, injected };
}

const EXPLICIT_BACKGROUND_PATTERN = /\bbgcolor\s*=\s*["']?\s*([^"'\s>]*)|\bbackground(?:-color)?\s*:\s*([^;"'}]*)|\bbackground\s*=/gi;
const NO_BACKGROUND_VALUE = /^(?:transparent|none|inherit|initial|unset|revert)?\s*(?:!important)?$/i;
const DARK_NAMED_COLORS = new Set(["black", "navy", "darkblue", "midnightblue", "darkslategray", "darkslategrey", "maroon", "darkgreen", "indigo", "purple", "darkred"]);

function isDarkColorValue(value: string) {
  const color = value.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (DARK_NAMED_COLORS.has(color)) return true;
  let rgb: number[] | null = null;
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
    rgb = [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16));
  } else {
    const fn = value.trim().toLowerCase().match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (fn) rgb = fn.slice(1, 4).map(Number);
  }
  if (!rgb) return false;
  const [r, g, b] = rgb.map((channel) => channel / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}

// Whether the mail paints a background that is not recognisably dark: a
// bgcolor/background attribute or a background(-color) declaration. Such mails
// are designed for dark default text and turn light-on-light in dark mode.
// Only tags and style blocks count, so prose like "Background: …" does not.
function hasLightOwnBackground(html: string) {
  const markup = [
    ...Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi), (match) => match[1]),
    ...(html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").match(/<[a-z][^>]*>/gi) ?? [])
  ].join("\n");
  for (const match of markup.matchAll(EXPLICIT_BACKGROUND_PATTERN)) {
    const value = match[1] ?? match[2];
    if (value === undefined) return true;
    if (NO_BACKGROUND_VALUE.test(value.trim())) continue;
    if (!isDarkColorValue(value)) return true;
  }
  return false;
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getClosestAnchor(target: EventTarget | null) {
  if (!target || typeof target !== "object") return null;
  const element = target as { closest?: (selector: string) => Element | null };
  const anchor = typeof element.closest === "function" ? element.closest("a") : null;
  if (!anchor) return null;
  return String(anchor.tagName || "").toUpperCase() === "A" ? (anchor as HTMLAnchorElement) : null;
}

// Hash links resolve against the document's own URL; under target="_blank" that
// spawns a duplicate app instance instead of scrolling within the email.
function isHashHref(href: string | null | undefined) {
  const trimmed = href?.trim();
  return !trimmed || trimmed.startsWith("#");
}

// A bare "#" (or empty) href points nowhere, so clicking it should do nothing at all.
function isNoOpHref(href: string | null | undefined) {
  const trimmed = href?.trim();
  return !trimmed || trimmed === "#";
}

function getAnchorPreviewUrl(anchor: HTMLAnchorElement | null) {
  if (!anchor) return null;
  const href = anchor.getAttribute("href")?.trim();
  if (!href || isHashHref(href)) return null;
  return anchor.href || href;
}

// textContent materializes a whole subtree, and the walk visits every element,
// so reading it outright costs O(elements x document text). No rule looks past
// QUOTE_TEXT_SCAN_LIMIT, so stop there instead.
function readBoundedText(element: Element, limit: number) {
  let text = "";
  const collect = (node: Node) => {
    for (let child = node.firstChild; child && text.length < limit; child = child.nextSibling) {
      if (child.nodeType === Node.TEXT_NODE) {
        // Indented markup leads with whitespace the rules trim away anyway;
        // letting it use up the budget would cut real characters off the end.
        text = (text + (child.textContent ?? "")).trimStart();
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        collect(child);
      }
    }
  };
  collect(element);
  return text.slice(0, limit);
}

function findQuoteBoundary(root: Element) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node as Element;
    const markers = {
      tagName: element.tagName,
      id: element.getAttribute("id") ?? "",
      className: element.getAttribute("class") ?? "",
      typeAttr: element.getAttribute("type") ?? ""
    };
    if (hasQuoteBoundaryMarker(markers)) return element;
    if (isQuoteBoundaryText(readBoundedText(element, QUOTE_TEXT_SCAN_LIMIT))) return element;
  }
  return null;
}

function hasVisibleContentBefore(node: Element) {
  for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
    if ((sibling.textContent ?? "").trim()) return true;
    if (sibling.nodeType !== Node.ELEMENT_NODE) continue;
    const element = sibling as Element;
    if (element.tagName === "IMG" || element.querySelector("img")) return true;
  }
  return false;
}

// A marker often sits inside a wrapper that holds nothing else (Outlook nests
// its header block in a bare <div>), so collapse the outermost element the
// marker still starts — otherwise that wrapper's chrome stays visible above
// the chip.
function promoteQuoteRoot(boundary: Element, root: Element) {
  let node = boundary;
  while (node.parentElement && node.parentElement !== root && !hasVisibleContentBefore(node)) {
    node = node.parentElement;
  }
  return node;
}

function isInsideTableLayout(node: Element, root: Element) {
  for (let ancestor = node.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
    if (isTableLayoutTag(ancestor.tagName)) return true;
  }
  return false;
}

// Our own quoted block carries the original message's scoped stylesheet, so
// textContent would count kilobytes of CSS as quoted prose and collapse quotes
// that are actually a line long.
function countVisibleTextChars(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, "").length;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  const tagName = (node as Element).tagName;
  if (tagName === "STYLE" || tagName === "SCRIPT" || tagName === "TEMPLATE") return 0;
  let total = 0;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    total += countVisibleTextChars(child);
  }
  return total;
}

function collapseQuotedContent(doc: Document, expanded: boolean, toggleLabel: string) {
  const root = doc.querySelector(`.${NOCTUA_EMAIL_CONTENT_CLASS}`);
  if (!root) return null;

  const boundary = findQuoteBoundary(root);
  if (!boundary) return null;

  const quoteRoot = promoteQuoteRoot(boundary, root);
  const parent = quoteRoot.parentElement;
  if (!parent || !canWrapQuoteInParent(parent.tagName)) return null;
  if (isInsideTableLayout(quoteRoot, root)) return null;

  // Only quoteRoot and its siblings move into the <details>, so measure exactly
  // that range against everything else the reader keeps seeing.
  let quotedTextLength = 0;
  for (let node: Node | null = quoteRoot; node; node = node.nextSibling) {
    quotedTextLength += countVisibleTextChars(node);
  }
  const leadingTextLength = countVisibleTextChars(root) - quotedTextLength;
  if (!shouldCollapseQuote({ leadingTextLength, quotedTextLength })) return null;

  const details = doc.createElement("details");
  details.className = NOCTUA_QUOTE_COLLAPSE_CLASS;
  details.open = expanded;
  const summary = doc.createElement("summary");
  summary.title = toggleLabel;
  summary.setAttribute("aria-label", toggleLabel);
  summary.textContent = "•••";
  // The quote gets its own wrapper because a height animation needs a single
  // box to drive, and <details> itself must keep the summary at full height.
  const content = doc.createElement("div");
  content.className = NOCTUA_QUOTE_CONTENT_CLASS;
  details.append(summary, content);

  parent.insertBefore(details, quoteRoot);
  for (let next = details.nextSibling; next; next = details.nextSibling) {
    content.appendChild(next);
  }
  return { details, content };
}

// A closed <details> hides its content through UA styling that CSS transitions
// can't reach, so the open/close animation runs here instead: hold the element
// open for the whole collapse and only flip the flag once the height lands.
function attachQuoteAnimation(details: HTMLDetailsElement, content: HTMLElement, onSettled: () => void) {
  const view = details.ownerDocument.defaultView;
  const summary = details.querySelector("summary");
  if (!view || !summary || typeof content.animate !== "function") return null;

  let animation: Animation | null = null;
  let settleTimer = 0;
  let expandedIntent = details.open;

  // Collapsing only completes here, so a dropped finish event would strand the
  // quote open with its content clipped to nothing.
  const settle = (expanding: boolean) => {
    view.clearTimeout(settleTimer);
    settleTimer = 0;
    animation = null;
    content.style.overflow = "";
    if (!expanding) details.open = false;
    onSettled();
  };

  const handleClick = (event: Event) => {
    // A hidden document never advances the animation; reduced motion opts out.
    if (view.document.hidden || view.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    event.preventDefault();

    // details.open stays true for the whole collapse, so it can't tell which way
    // an in-flight animation is heading; the intent flag can. Reversing starts
    // from the height on screen rather than jumping to the far end first.
    const startHeight = animation ? content.getBoundingClientRect().height : null;
    animation?.cancel();
    view.clearTimeout(settleTimer);

    expandedIntent = !expandedIntent;
    const expanding = expandedIntent;
    if (expanding) details.open = true;
    const from = startHeight ?? (expanding ? 0 : content.scrollHeight);
    const to = expanding ? content.scrollHeight : 0;
    content.style.overflow = "hidden";
    animation = content.animate(
      { height: [`${from}px`, `${to}px`] },
      { duration: QUOTE_ANIMATION_MS, easing: "ease" }
    );
    animation.onfinish = () => settle(expanding);
    // Backstop for a tab hidden mid-animation, where the timeline stalls.
    settleTimer = view.setTimeout(() => settle(expanding), QUOTE_ANIMATION_MS + 250);
  };

  // Keeps the intent in step when the element toggles outside this handler:
  // the hidden-document and reduced-motion paths, or a native summary activation.
  const handleToggleSync = () => {
    if (!animation) expandedIntent = details.open;
  };

  summary.addEventListener("click", handleClick);
  details.addEventListener("toggle", handleToggleSync);
  return () => {
    view.clearTimeout(settleTimer);
    animation?.cancel();
    content.style.overflow = "";
    summary.removeEventListener("click", handleClick);
    details.removeEventListener("toggle", handleToggleSync);
  };
}

/**
 * An image that failed to load (e.g. a remote server answering with
 * Cross-Origin-Resource-Policy: same-origin) shows its alt text instead of the
 * browser's broken-image icon, or nothing without alt text. Nothing new is
 * fetched, so the remote-content gate is unaffected.
 */
export function replaceFailedImage(image: HTMLImageElement) {
  const alt = image.getAttribute("alt")?.trim();
  if (!alt) {
    image.remove();
    return;
  }
  const text = image.ownerDocument.createElement("span");
  text.className = NOCTUA_IMAGE_ALT_CLASS;
  text.textContent = alt;
  image.replaceWith(text);
}

/** Already settled without pixels; decode() tells a broken image from an SVG without intrinsic size. */
function settledWithoutPixels(image: HTMLImageElement) {
  return image.complete && image.naturalWidth === 0 && Boolean(image.getAttribute("src")) && typeof image.decode === "function";
}

export function buildPreviewDocument({
  html,
  safeHtml,
  darkMode,
  fontScale,
  zoom,
  showViewerFrame,
  hostViewportHeight,
  token,
  remoteContent
}: {
  html: string;
  safeHtml: string;
  darkMode: boolean;
  fontScale: number;
  zoom: number;
  showViewerFrame: boolean;
  hostViewportHeight?: number;
  token: string;
  remoteContent: RemoteContentMode;
}) {
  // Using the host height breaks the cycle between vh and the auto-sized frame.
  const viewportUnit = typeof hostViewportHeight === "number" && Number.isFinite(hostViewportHeight) && hostViewportHeight > 0
    ? hostViewportHeight / 100
    : 8;
  const cleanedHtml = stripConditionalComments(html || "");
  const hasExplicitColor = /(^|[^-])color\s*:/i.test(cleanedHtml);
  // The sanitizer filters sender CSS in both modes. Never reinsert external
  // stylesheets or font imports from the unsanitized message after opt-in.
  let injectedCss = "";
  const viewportHtml = rewriteHtmlViewportHeightUnits(safeHtml);
  const withRewrites = viewportHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    const scaledCss = scaleFontSizes(css);
    const rewritten = extractPrefersColorScheme(scaledCss, darkMode ? "dark" : "light");
    if (rewritten.injected) {
      injectedCss += `\n${rewritten.injected}`;
    }
    return `<style>${rewritten.stripped}</style>`;
  });
  const scaledHtml = scaleFontSizes(withRewrites);
  const { body, styles: styleBlocks, bodyAttrs } = extractBodyContent(scaledHtml);
  const blockquoteBorder = darkMode ? "#8aa7d4" : "#1847d5";
  const linkColor = darkMode ? "#b8d5ff" : "#1847d5";
  const quoteChipBackground = darkMode ? "#2b303b" : "#e8ebf0";
  const quoteChipHoverBackground = darkMode ? "#39404e" : "#dbe0e8";
  const quoteChipColor = darkMode ? "#aab4c4" : "#6b7480";
  // The frame is its own document: the app's --mail-view-fg never reaches it,
  // so a var() here always fell back to the light-theme text colour and left
  // plain mails dark-on-dark. Dark uses the app's gray-12 (Radix dark), except
  // for mails with their own light background, which keep the dark default.
  const darkHostText = darkMode && !hasExplicitColor && !hasLightOwnBackground(cleanedHtml);
  const hostTextColor = hasExplicitColor
    ? ""
    : `color: ${darkHostText ? "#eeeeee" : "#1a1a1a"};`;
  const bodyClassName = [NOCTUA_EMAIL_CONTENT_CLASS, "email-body", bodyAttrs.className]
    .filter(Boolean)
    .join(" ");
  const bodyId = escapeAttribute(bodyAttrs.id || "NoctuaMessageViewBody");
  const bodyStyle = escapeAttribute(stripBodyHeightStyles(bodyAttrs.style || ""));
  const contentMarkup = body
    ? `<div class="${escapeAttribute(bodyClassName)}" id="${bodyId}" style="${bodyStyle}">${body}</div>`
    : `<div class="${NOCTUA_EMAIL_CONTENT_CLASS} email-body" id="NoctuaMessageViewBody">${scaledHtml}</div>`;

  return [
    "<!doctype html>",
    `<html id="noctua-email-root" data-theme="${darkMode ? "dark" : "light"}" data-noctua-preview="${token}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(messageHtmlCsp(remoteContent))}">`,
    '<meta name="referrer" content="no-referrer">',
    "<style>",
    APP_FONT_FACE_CSS,
    `:root { color-scheme: ${darkMode ? "dark" : "light"}; --zoom: ${zoom}; --font-scale: ${fontScale}; --noctua-vh: ${viewportUnit}px; }`,
    "html { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; font-size: 100%; }",
    `body { margin: 0; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; background: transparent; ${hostTextColor} font-size: 100%; }`,
    `.${NOCTUA_EMAIL_CONTENT_CLASS} { font-family: ${APP_FONT_STACK}; color: inherit; background: transparent; font-size: 100%; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }`,
    // The width must counter the scale so the visual width stays the pane
    // width at any zoom; a max-width would cap it below 100% when zoomed out,
    // shrinking the scroll viewport (and its clip edge) along with the content.
    ".html-scale { transform: scale(var(--zoom)); transform-origin: top left; width: calc(100% / var(--zoom)); min-width: 0; box-sizing: border-box; }",
    // Fixed-width emails (e.g. 840px newsletter tables) overflow narrow panes;
    // the iframe itself is scrolling="no", so this wrapper provides the scrollbar.
    `.${NOCTUA_EMAIL_VIEWPORT_CLASS} { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; overflow-x: auto; }`,
    `.${NOCTUA_EMAIL_VIEWPORT_DEFAULT_MARGIN_CLASS} { padding: 8px; }`,
    ".email-body { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }",
    `a { color: ${linkColor}; }`,
    "img { max-width: 100%; height: auto; }",
    `.${NOCTUA_IMAGE_ALT_CLASS} { opacity: 0.7; }`,
    `.${NOCTUA_EMAIL_CONTENT_CLASS} p, .${NOCTUA_EMAIL_CONTENT_CLASS} div, .${NOCTUA_EMAIL_CONTENT_CLASS} span { max-width: 100%; }`,
    `blockquote { border-left: 3px solid ${blockquoteBorder}; margin: 8px 0; padding-left: 12px; }`,
    "pre { white-space: pre-wrap; }",
    // Padding rather than a bottom margin: the chip is often the last thing in
    // the body, where a margin would collapse out and sit flush on the edge.
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} { margin: 12px 0 0; padding-bottom: 18px; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 15px; border-radius: 8px; background: ${quoteChipBackground}; color: ${quoteChipColor}; font: 500 11px/1 system-ui, -apple-system, sans-serif; letter-spacing: 0.5px; cursor: pointer; list-style: none; user-select: none; transition: background-color 120ms ease; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary:hover { background: ${quoteChipHoverBackground}; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary::marker { content: ""; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary::-webkit-details-marker { display: none; }`,
    injectedCss,
    "</style>",
    styleBlocks.join("\n"),
    // The copied body can carry height classes or IDs with !important rules.
    // ID specificity keeps the frame's measuring boxes content-sized even then.
    `<style>html#noctua-email-root, html#noctua-email-root body, html#noctua-email-root .${NOCTUA_EMAIL_CONTENT_CLASS} { height: auto !important; min-height: 0 !important; max-height: none !important; }</style>`,
    "</head>",
    "<body>",
    '<div class="html-scale">',
    `<div class="${NOCTUA_EMAIL_VIEWPORT_CLASS} ${showViewerFrame ? NOCTUA_EMAIL_VIEWPORT_DEFAULT_MARGIN_CLASS : ""}">`,
    contentMarkup,
    "</div>",
    "</div>",
    "</body>",
    "</html>"
  ].join("\n");
}

function HtmlMessage({
  html,
  darkMode,
  fontScale = 1,
  zoom = 1,
  accountId,
  senderKey,
  messageId,
  sanitizeHtmlPair = sanitizeHtmlForDisplayPair
}: {
  html: string;
  darkMode: boolean;
  fontScale?: number;
  zoom?: number;
  accountId?: string;
  senderKey?: string | null;
  messageId?: string;
  /** Display sanitizer for both policies. Dark mode and font scale do not change its output. */
  sanitizeHtmlPair?: (input: string) => SanitizedHtmlPair;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Theme, zoom and font changes rebuild the whole srcdoc, which would silently
  // re-collapse a quote the reader had opened; keyed by html so a new message
  // still starts collapsed.
  const quoteStateRef = useRef({ html: "", expanded: false });
  const setLinkPreviewUrl = useMessageLinkPreview();
  const t = useTranslations("Reader");
  const cleanedHtml = stripConditionalComments(html || "");
  const showViewerFrame = shouldShowHtmlViewerFrame(cleanedHtml);
  const remote = useRemoteContent(accountId, senderKey, messageId ?? html);
  const remoteContent = remote.allowed ? "allow" : "block";
  // Theme and zoom only change the wrapper, not the sanitized message.
  const { block: blockedHtml, allow: allowedHtml } = useMemo(
    () => sanitizeHtmlPair(cleanedHtml),
    [cleanedHtml, sanitizeHtmlPair]
  );
  const hasRemoteContent = blockedHtml !== allowedHtml;
  const safeHtml = remote.allowed ? allowedHtml : blockedHtml;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (quoteStateRef.current.html !== html) {
      quoteStateRef.current = { html, expanded: false };
    }

    const previewToken = `preview-${(previewDocumentSequence += 1)}`;
    const previewDocument = buildPreviewDocument({
      html,
      safeHtml,
      darkMode,
      fontScale,
      zoom,
      showViewerFrame,
      hostViewportHeight: window.innerHeight,
      remoteContent,
      token: previewToken
    });

    let frameObserver: ResizeObserver | null = null;
    let documentObserver: ResizeObserver | null = null;
    let rafId: number | null = null;
    let bindRafId: number | null = null;
    let boundDocument: Document | null = null;
    let removeDocumentListeners: (() => void) | null = null;
    let removeQuoteToggleListener: (() => void) | null = null;

    // Assigning srcdoc navigates asynchronously, so until it commits the frame
    // still holds the outgoing document — about:blank on mount, the previous
    // preview on a rebuild. Sizing against that one writes a height for content
    // that is already gone, and a ResizeObserver reports nothing when the size
    // it would report is unchanged, so the wrong height can stick.
    const getPreviewDocument = () => {
      const doc = iframe.contentDocument;
      if (doc?.documentElement?.dataset.noctuaPreview !== previewToken) return null;
      // Everything below walks the whole document; a parser still filling it in
      // would hand out an incomplete set of links, images and quote candidates.
      return doc.readyState === "loading" ? null : doc;
    };

    const scheduleHeightUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const doc = getPreviewDocument();
        if (!doc) return;
        const body = doc.body;
        const root = doc.documentElement;
        // The root's scrollHeight is floored at the iframe's own height, so
        // including it would ratchet the height up and never let it shrink
        // when the content reflows shorter (e.g. after the pane widens).
        const nextHeight = body
          ? Math.max(body.scrollHeight, body.offsetHeight)
          : Math.max(root?.scrollHeight ?? 0, root?.offsetHeight ?? 0);
        iframe.style.height = `${Math.max(1, Math.ceil(nextHeight))}px`;
      });
    };

    const attachDocumentListeners = (doc: Document) => {
      removeDocumentListeners?.();
      removeDocumentListeners = null;
      documentObserver?.disconnect();
      documentObserver = null;

      doc.querySelectorAll("a").forEach((link) => {
        // The email's own markup may carry target="_blank"; strip it so hash
        // links can't open a new browsing context (and a fresh app instance).
        if (isHashHref(link.getAttribute("href"))) {
          link.removeAttribute("target");
          link.removeAttribute("rel");
          return;
        }
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noreferrer noopener");
      });

      const handleClick = (event: Event) => {
        const button = (event as MouseEvent).button;
        if (event.type === "click" ? button !== 0 : event.type !== "auxclick" || button !== 1) return;
        const anchor = getClosestAnchor(event.target);
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (isNoOpHref(href)) event.preventDefault();
        else if (isHashHref(href)) {
          event.preventDefault();
          // srcdoc inherits the host URL, so native fragment navigation would
          // replace the mail document with the application page.
          let fragment = href!.trim().slice(1);
          try { fragment = decodeURIComponent(fragment); } catch { return; }
          const target = doc.getElementById(fragment) ??
            Array.from(doc.getElementsByName(fragment)).find(element => element.tagName === "A");
          target?.scrollIntoView();
        } else {
          event.preventDefault();
          // Parent-owned click handling keeps links working without granting
          // popup or navigation capabilities to the message frame.
          window.open(anchor.href, "_blank", "noopener,noreferrer");
        }
      };
      doc.addEventListener("click", handleClick);
      doc.addEventListener("auxclick", handleClick);

      const updateLinkPreview = (value: string | null) => {
        setLinkPreviewUrl(value);
      };
      const handleMouseOver = (event: Event) => {
        updateLinkPreview(getAnchorPreviewUrl(getClosestAnchor(event.target)));
      };
      const handleMouseOut = (event: Event) => {
        const currentAnchor = getClosestAnchor(event.target);
        if (!currentAnchor) return;
        const relatedAnchor = getClosestAnchor((event as MouseEvent).relatedTarget);
        if (relatedAnchor === currentAnchor) return;
        updateLinkPreview(getAnchorPreviewUrl(relatedAnchor));
      };
      const handleFocusIn = (event: Event) => {
        updateLinkPreview(getAnchorPreviewUrl(getClosestAnchor(event.target)));
      };
      const handleFocusOut = (event: Event) => {
        updateLinkPreview(getAnchorPreviewUrl(getClosestAnchor((event as FocusEvent).relatedTarget)));
      };
      const handleFrameMouseLeave = () => {
        updateLinkPreview(null);
      };
      const handleAssetLoad = () => {
        scheduleHeightUpdate();
      };
      const handleImageError = (event: Event) => {
        replaceFailedImage(event.currentTarget as HTMLImageElement);
        scheduleHeightUpdate();
      };

      doc.addEventListener("mouseover", handleMouseOver);
      doc.addEventListener("mouseout", handleMouseOut);
      doc.addEventListener("focusin", handleFocusIn);
      doc.addEventListener("focusout", handleFocusOut);
      iframe.addEventListener("mouseleave", handleFrameMouseLeave);

      doc.querySelectorAll("img").forEach((image) => {
        // A failure before the listeners were attached fires no further event.
        if (settledWithoutPixels(image)) {
          image.decode().catch(() => {
            if (!image.isConnected) return;
            replaceFailedImage(image);
            scheduleHeightUpdate();
          });
        }
        image.addEventListener("load", handleAssetLoad);
        image.addEventListener("error", handleImageError);
      });

      if (typeof ResizeObserver !== "undefined") {
        documentObserver = new ResizeObserver(() => {
          scheduleHeightUpdate();
        });
        if (doc.documentElement) documentObserver.observe(doc.documentElement);
        if (doc.body) documentObserver.observe(doc.body);
      }

      void doc.fonts?.ready?.then(() => {
        scheduleHeightUpdate();
      });

      removeDocumentListeners = () => {
        updateLinkPreview(null);
        doc.removeEventListener("click", handleClick);
        doc.removeEventListener("auxclick", handleClick);
        doc.removeEventListener("mouseover", handleMouseOver);
        doc.removeEventListener("mouseout", handleMouseOut);
        doc.removeEventListener("focusin", handleFocusIn);
        doc.removeEventListener("focusout", handleFocusOut);
        iframe.removeEventListener("mouseleave", handleFrameMouseLeave);
        doc.querySelectorAll("img").forEach((image) => {
          image.removeEventListener("load", handleAssetLoad);
          image.removeEventListener("error", handleImageError);
        });
      };
    };

    const applyQuoteCollapse = (doc: Document) => {
      removeQuoteToggleListener?.();
      removeQuoteToggleListener = null;

      const collapsed = collapseQuotedContent(doc, quoteStateRef.current.expanded, t("quotedText"));
      if (!collapsed) return;

      const { details, content } = collapsed;
      const handleToggle = () => {
        quoteStateRef.current = { html, expanded: details.open };
        scheduleHeightUpdate();
      };
      details.addEventListener("toggle", handleToggle);
      const detachAnimation = attachQuoteAnimation(details, content, scheduleHeightUpdate);
      removeQuoteToggleListener = () => {
        detachAnimation?.();
        details.removeEventListener("toggle", handleToggle);
      };
    };

    const bindPreviewDocument = () => {
      const doc = getPreviewDocument();
      if (!doc) return false;
      if (bindRafId !== null) {
        cancelAnimationFrame(bindRafId);
        bindRafId = null;
      }
      if (doc === boundDocument) return true;
      boundDocument = doc;
      applyQuoteCollapse(doc);
      attachDocumentListeners(doc);
      scheduleHeightUpdate();
      return true;
    };

    // Polled per frame instead of waiting for the frame's load event: load only
    // fires once every remote asset the mail pulls has settled, and a request
    // that never answers (tracking pixels are the usual culprit) would hold the
    // first measurement back for as long as it hangs, leaving the message
    // collapsed to nothing on screen.
    const pollForPreviewDocument = () => {
      bindRafId = requestAnimationFrame(() => {
        bindRafId = null;
        if (bindPreviewDocument()) return;
        pollForPreviewDocument();
      });
    };

    // Still worth listening to: a hidden tab gets no animation frames, so the
    // poll stalls there while load keeps firing.
    const handleLoad = () => {
      bindPreviewDocument();
      scheduleHeightUpdate();
    };

    iframe.addEventListener("load", handleLoad);
    if (typeof ResizeObserver !== "undefined") {
      frameObserver = new ResizeObserver(() => {
        scheduleHeightUpdate();
      });
      frameObserver.observe(iframe);
    }
    iframe.srcdoc = previewDocument;
    pollForPreviewDocument();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (bindRafId !== null) {
        cancelAnimationFrame(bindRafId);
      }
      removeQuoteToggleListener?.();
      removeDocumentListeners?.();
      documentObserver?.disconnect();
      frameObserver?.disconnect();
      iframe.removeEventListener("load", handleLoad);
    };
  }, [darkMode, fontScale, html, remoteContent, safeHtml, setLinkPreviewUrl, showViewerFrame, t, zoom]);

  return (
    <div className={`${styles.htmlMessage} ${showViewerFrame ? styles.framed : styles.unframed}`}>
      {!remote.allowed && hasRemoteContent && (
        // Phones get one row: the text wraps beside short button labels (full accessible names).
        <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2 text-sm text-muted-foreground max-md:gap-1 max-md:px-2 max-md:py-1 max-md:text-xs">
          <span className="max-md:min-w-0 max-md:flex-1">{t("remoteBlocked")}</span>
          <Button variant="outline" size="sm" aria-label={t("loadOnce")} onClick={remote.loadOnce}>
            <span className="md:hidden">{t("loadOnceShort")}</span><span className="hidden md:inline">{t("loadOnce")}</span>
          </Button>
          <Button variant="ghost" size="sm" aria-label={t("alwaysLoadSender")} disabled={!remote.canAlwaysAllow || remote.saving} onClick={() => void remote.alwaysAllow()}>
            <span className="md:hidden">{t("alwaysLoadSenderShort")}</span><span className="hidden md:inline">{t("alwaysLoadSender")}</span>
          </Button>
          {!remote.canAlwaysAllow && <span className="max-md:basis-full">{t("unknownSender")}</span>}
          {remote.error && <span role="alert" className="max-md:basis-full">{remote.error}</span>}
        </div>
      )}
      <iframe
        ref={iframeRef}
        className={styles.frame}
        title={t("htmlMessage")}
        scrolling="no"
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export default memo(HtmlMessage);
