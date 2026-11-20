import { describe, expect, test } from "bun:test";
import { parse, parseFragment, type DefaultTreeAdapterMap } from "parse5";
import {
  ensureHtmlDocumentTitle,
  extractBodyContent,
  linkifyHtmlTextNodes,
  sanitizeHtmlForAppDocument,
  sanitizeHtmlForDisplay,
  sanitizeHtmlForDisplayPair
} from "@/lib/html";

type Element = DefaultTreeAdapterMap["element"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];

/** Every element an HTML5 parser (the browser) builds from `html`. */
function parsedElements(html: string, document = false): Element[] {
  const elements: Element[] = [];
  const walk = (node: ParentNode) => {
    for (const child of node.childNodes) {
      if (!("tagName" in child)) continue;
      elements.push(child);
      walk(child);
      if (child.tagName === "template") walk((child as DefaultTreeAdapterMap["template"]).content);
    }
  };
  walk(document ? parse(html) : parseFragment(html));
  return elements;
}

const ALLOWED_OUTPUT_TAGS = new Set([
  "html", "head", "body", "title", "meta", "style", "a", "p", "div", "span", "img", "b", "i", "u", "s", "br",
  "table", "tbody", "tr", "td", "picture", "source"
]);

/** Event handlers, script-capable elements or anything outside the allowlist. */
function activeMarkup(html: string) {
  return parsedElements(html, /<(?:html|body)[\s>]/i.test(html)).flatMap((element) => [
    ...(ALLOWED_OUTPUT_TAGS.has(element.tagName) ? [] : [`<${element.tagName}>`]),
    ...element.attrs.filter((attr) => /^on/i.test(attr.name) || attr.name === "srcdoc").map((attr) => `${element.tagName}[${attr.name}]`)
  ]);
}

const styleText = (html: string) => parsedElements(html).filter((element) => element.tagName === "style")
  .map((element) => element.childNodes.map((node) => ("value" in node ? node.value : "")).join(""));

// CF-02 / DS-03 / A26 / Sol 8 (security scan 2026-11-19). sanitize-html re-emits
// style text raw; in foreign content htmlparser2 decodes it first.
const STYLE_BREAKOUT_PAYLOADS = [
  `<svg><style>&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;`,
  `<svg><style>&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;</style >`,
  `<svg><style>&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;</style></svg>`,
  `<svg><style>&lt;/STYLE &gt;&lt;img src=x onerror=alert(1)&gt;</style></svg><p>after</p>`,
  `<svg><style>&lt;/style/&gt;&lt;a href=x onmouseover=alert(1)&gt;x&lt;/a&gt;</style></svg>`,
  `<math><mtext><svg><style>&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;</style></svg></mtext></math>`,
  `<svg><style>&lt;/style&gt;&lt;iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"&gt;</style></svg>`,
  `<html><body><svg><style>&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;</style></svg></body></html>`,
  `<style>.x{content:"</style><img src=x onerror=alert(1)>"}</style>`,
  `<style>a{content:"&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;"}</style><p>x</p>`
];

describe("sanitizer: raw style text cannot become markup", () => {
  test.each(STYLE_BREAKOUT_PAYLOADS)("%s", (payload) => {
    const pair = sanitizeHtmlForDisplayPair(payload);
    for (const output of [
      sanitizeHtmlForDisplay(payload),
      sanitizeHtmlForDisplay(payload, "allow"),
      sanitizeHtmlForDisplay(payload, "block", { safeLinks: true }),
      pair.block,
      pair.allow,
      sanitizeHtmlForAppDocument(payload),
      linkifyHtmlTextNodes(sanitizeHtmlForAppDocument(payload))
    ]) {
      expect(activeMarkup(output)).toEqual([]);
      for (const css of styleText(output)) expect(css).not.toMatch(/<\/style/i);
    }
  });

  test("ordinary style blocks are kept for the message frame", () => {
    expect(sanitizeHtmlForDisplay(`<style>.a{color:red}</style><p class="a">x</p>`))
      .toBe(`<style>.a{color:red}</style><p class="a">x</p>`);
  });
});

describe("sanitizeHtmlForAppDocument", () => {
  test("drops sender style elements, including ones the former regex missed", () => {
    for (const payload of [
      `<p>x</p><style>body{filter:blur(3px)}</style>`,
      `<p>x</p><style >body{filter:blur(3px)}</style >`,
      `<p>x</p><style>body{filter:blur(3px)}`,
      `<p>x</p><STYLE type="text/css">body{filter:blur(3px)}</STYLE>`
    ]) {
      const output = sanitizeHtmlForAppDocument(payload);
      expect(output).toBe("<p>x</p>");
    }
  });

  test("blocks remote images and keeps inline formatting", () => {
    const output = sanitizeHtmlForAppDocument(`<p style="color:red">x <img src="https://tracker.example.test/p.gif"></p>`);
    expect(output).toContain(`style="color:red"`);
    expect(output).toContain(`data-remote-src="https://tracker.example.test/p.gif"`);
    expect(output).not.toMatch(/ src="https:/);
  });

  test("sender targets cannot navigate the app tab (P3-3)", () => {
    for (const target of ["_top", "_parent", "_self", "noctua"]) {
      const output = sanitizeHtmlForAppDocument(`<a href="https://phish.example.test/" target="${target}">x</a>`);
      expect(output).toBe(`<a href="https://phish.example.test/" target="_blank" rel="noreferrer noopener">x</a>`);
    }
  });

  test("document-level tags and meta never reach the app DOM (P3-3)", () => {
    const output = sanitizeHtmlForAppDocument(
      `<html><head><title>Fake title</title><meta name="viewport" content="width=10"><meta name="theme-color" content="#f00"></head><body><p>x</p></body></html>`
    );
    expect(output).toBe("<p>x</p>");
  });

  test("linkify on sanitized output adds links only inside text", () => {
    const output = linkifyHtmlTextNodes(sanitizeHtmlForAppDocument(
      `<p title="https://example.test/&quot; onmouseover=&quot;alert(1)">see https://example.test/a?b=1&c="x"</p>`
    ));
    expect(activeMarkup(output)).toEqual([]);
    const anchors = parsedElements(output).filter((element) => element.tagName === "a");
    expect(anchors).toHaveLength(1);
    expect(parsedElements(output)[0].attrs.map((attr) => attr.name)).toEqual(["title"]);
  });
});

describe("string steps after the sanitizer", () => {
  // The sanitized document goes through string steps (document title, body
  // extraction). Style text must not look like markup to them.
  const HEAD_PAYLOAD = `<html><head><style>.x{content:"</title><meta http-equiv=refresh content='0;url=https://phish.example.test/'><img src=x onerror=alert(1)><a href=javascript:alert(1)>x</a><body><form action=https://phish.example.test/><input name=p></form>"}</style><title>t</title></head><body><p>Hello</p></body></html>`;

  test("DS-04: replacement patterns in the subject stay literal text", () => {
    const sanitized = sanitizeHtmlForDisplay(HEAD_PAYLOAD, "block", { safeLinks: true });
    for (const subject of ["$`", "$'", "$&", "a $` b $$ c", "$1"]) {
      const document = ensureHtmlDocumentTitle(sanitized, subject);
      const elements = parsedElements(document, true);
      expect(elements.filter((element) => element.tagName === "meta")).toEqual([]);
      expect(activeMarkup(document)).toEqual([]);
      const title = elements.find((element) => element.tagName === "title");
      expect(title?.childNodes.map((node) => ("value" in node ? node.value : "")).join("")).toBe(subject);
    }
  });

  test("DS-04: function replacers also for documents without a title", () => {
    expect(ensureHtmlDocumentTitle(`<html><head lang="x"></head><body>b</body></html>`, "$` $&"))
      .toBe(`<html><head lang="x"><title>$\` $&amp;</title></head><body>b</body></html>`);
    expect(ensureHtmlDocumentTitle(`<html class="m"><body>b</body></html>`, "$'"))
      .toBe(`<html class="m"><head><title>$&#39;</title></head><body>b</body></html>`);
  });

  test("DS-05: body extraction cannot start inside sender CSS", () => {
    const { body, styles } = extractBodyContent(sanitizeHtmlForDisplay(HEAD_PAYLOAD));
    expect(body.trim()).toBe("<p>Hello</p>");
    expect(activeMarkup(body)).toEqual([]);
    for (const style of styles) expect(style.slice("<style>".length, -"</style>".length)).not.toContain("<");
  });

  test("style text keeps its meaning through the CSS escape", () => {
    expect(sanitizeHtmlForDisplay(`<style>.q::before{content:"<b>"}</style>`)).toBe(`<style>.q::before{content:"\\3c b>"}</style>`);
  });
});
