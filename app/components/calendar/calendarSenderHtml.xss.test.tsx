import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import CalendarEventEmailSnapshot from "./CalendarEventEmailSnapshot";
import EventDetailDescription from "./EventDetailDescription";

type Element = DefaultTreeAdapterMap["element"];

function elements(html: string): Element[] {
  const result: Element[] = [];
  const walk = (node: DefaultTreeAdapterMap["parentNode"]) => {
    for (const child of node.childNodes) {
      if (!("tagName" in child)) continue;
      result.push(child);
      walk(child);
    }
  };
  walk(parseFragment(html));
  return result;
}

// SD2 / SD3: rel-like text inside another attribute value and markup hidden
// in raw style text must stay data through every calendar rendering step
// (sanitizer, linkify, React). SD20: sender markup gets no app classes or ids.
const PAYLOADS = [
  `<a href="https://example.test/" title='x rel=y onmouseover=alert(1) z'>link</a>`,
  `<a title="rel=&quot;nofollow&quot; onfocus=alert(1) autofocus x=" href="https://example.test/">link</a>`,
  `<a href="https://example.test/?rel=1&quot; onclick=&quot;alert(1)" rel="nofollow">link</a> https://example.test/"onmouseover="alert(1)`,
  `<svg><style>&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;</style></svg><p>after https://example.test/</p>`,
  `<p class="rt-Button rt-variant-solid" id="__next" style="position:fixed;inset:0">Fake button</p><a name="location" href="#x">x</a>`
];

const ALLOWED_ATTRIBUTES = new Set(["href", "target", "rel", "title", "style", "src", "data-remote-src", "referrerpolicy", "alt"]);

/**
 * The element that receives the sanitized sender HTML. CSS modules resolve to
 * `undefined` under bun test, so the box is the one element with two module
 * classes (content class + SenderHtml containment class).
 */
function senderSubtree(markup: string): Element[] {
  const all = elements(markup);
  const box = all.find((element) => element.attrs.some((attr) => attr.name === "class" && attr.value === "undefined undefined"));
  expect(box).toBeTruthy();
  const inside: Element[] = [];
  const walk = (node: Element) => {
    for (const child of node.childNodes) {
      if (!("tagName" in child)) continue;
      inside.push(child);
      walk(child);
    }
  };
  walk(box!);
  return inside;
}

function check(markup: string) {
  const inside = senderSubtree(markup);
  expect(inside.length).toBeGreaterThan(0);
  const disallowed = inside.flatMap((element) =>
    element.attrs.filter((attr) => !ALLOWED_ATTRIBUTES.has(attr.name)).map((attr) => `${element.tagName}[${attr.name}]`));
  expect(disallowed).toEqual([]);
  expect(inside.map((element) => element.tagName).filter((tag) => !["a", "p", "img"].includes(tag))).toEqual([]);
  for (const element of inside.filter((element) => element.tagName === "a")) {
    expect(element.attrs.find((attr) => attr.name === "target")?.value).toBe("_blank");
    expect(element.attrs.find((attr) => attr.name === "rel")?.value).toContain("noopener");
  }
}

describe("calendar sender HTML in the app document", () => {
  it("event description keeps attribute text as data (SD2/SD3/SD20)", () => {
    for (const payload of PAYLOADS) {
      check(renderToStaticMarkup(createElement(EventDetailDescription, { description: payload })));
    }
  });

  it("source-mail snapshot keeps attribute text as data (SD2/SD3/SD20)", () => {
    for (const payload of PAYLOADS) {
      check(renderToStaticMarkup(createElement(CalendarEventEmailSnapshot, { snapshot: { sourceSubject: "Invite", sourceBodyHtml: payload } })));
    }
  });
});
