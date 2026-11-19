import { expect, test } from "bun:test";
import { parseFragment } from "parse5";
import { addToHtmlBody, hasUnsubscribeLink, normalizeTemplate, renderContent, sampleContact } from "./render";

const url = "https://links.example.test/t/u/token";
const base = { contact: sampleContact, organizationName: "Org", organizationAddress: "Straße 1", unsubscribeUrl: url, now: Date.UTC(2026, 0, 1) };
const render = (html: string, options = base) => renderContent({ subject: "S", html, text: "" }, options);
const hrefs = (html: string, name = "href") => [...html.matchAll(new RegExp(` ${name}="([^"]*)"`, "g"))].map(match => match[1]);

test("the unsubscribe URL stays a working URL with surrounding whitespace or an appended query or fragment", () => {
  const spaced = render(`<a href=" {{ unsubscribe_url }}\n ">Abmelden</a>`);
  expect(hrefs(spaced.html)).toEqual([url]);
  expect(hasUnsubscribeLink(spaced.html, url)).toBe(true);
  expect(hrefs(render(`<a href="{{ unsubscribe_url }}?src=footer">x</a>`).html)).toEqual([`${url}?src=footer`]);
  expect(hrefs(render(`<a href=" {% unsubscribe_link %}#unten ">x</a>`).html)).toEqual([`${url}#unten`]);
  expect(hrefs(render(`<img src="{{ unsubscribe_url }}?pixel=1">`).html, "src")).toEqual([`${url}?pixel=1`]);
});

test("a URL placeholder that does not start the attribute stays an encoded component", () => {
  expect(hrefs(render(`<a href="https://example.test/?next={{ unsubscribe_url }}">x</a>`).html))
    .toEqual([`https://example.test/?next=${encodeURIComponent(url)}`]);
  // Only ASCII whitespace is ignored by URL parsing; a no-break space keeps the value a component.
  expect(hrefs(render(`<a href="\u00a0{{ unsubscribe_url }}">x</a>`).html)).toEqual([`&nbsp;${encodeURIComponent(url)}`]);
  expect(hrefs(render(`<a href="{{ first_name }}{{ unsubscribe_url }}">x</a>`).html)).toEqual([`Alex${encodeURIComponent(url)}`]);
});

const elapsed = (run: () => unknown) => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

test("an unclosed placeholder followed by long whitespace renders in linear time", () => {
  for (const open of ["{{", "{%"]) {
    const value = open + " ".repeat(200_000);
    expect(elapsed(() => normalizeTemplate(value, true))).toBeLessThan(250);
    expect(elapsed(() => render(value + "x"))).toBeLessThan(1000);
  }
  const comments = "<!---->".repeat(40) + "x";
  expect(elapsed(() => hasUnsubscribeLink(comments, url))).toBeLessThan(250);
  expect(elapsed(() => addToHtmlBody(comments, "<p>Abmelden</p>"))).toBeLessThan(250);
});

test("the linear placeholder pattern matches exactly what the previous pattern matched", () => {
  const previous = /{{\s*([^{}]*?)\s*}}|{%\s*([^{}]*?)\s*%}/g;
  const samples = [
    "{{first_name}} {{ last_name }} {{\n email \t}}", "{{ a }}}", "{{{ a }}", "{{ a }x }}", "{{}}", "{{   }}", "{%%}", "{% %}",
    "{% a %%}", "{% unsubscribe '100%' %}", "{% unsubscribe \"Hier & jetzt\" %} {% current_year %}", "{{\u00a0first_name\u2003}}",
    "{{ last_name|default:'Hallo' }}", "{{ x }} text {% y %} {{ z", "{% a } %}", "{% {{ a }} %}", "{{ a %} }}", "%} {% b %}}"
  ];
  for (const sample of samples) {
    const before = [...sample.matchAll(previous)].map(match => [match.index, match[0], match[1], match[2]]);
    const after = [...sample.matchAll(/{{([^{}]*)}}|{%((?:[^{}%]|%(?!}))*)%}/g)]
      .map(match => [match.index, match[0], match[1]?.trim(), match[2]?.trim()]);
    expect([sample, after]).toEqual([sample, before]);
  }
});

test("placeholders inside an Outlook conditional comment are rendered and cannot leave the comment", () => {
  const html = `<!--[if mso]><v:roundrect href="{{ unsubscribe_url }}">Hi {{ first_name }}</v:roundrect><![endif]--><p>Body</p>`;
  const plain = render(html);
  expect(plain.warnings).toEqual([]);
  expect(plain.html).toContain(`<!--[if mso]><v:roundrect href="${url}">Hi Alex</v:roundrect><![endif]-->`);

  const hostile = render(html, { ...base, contact: { ...sampleContact, firstName: `--><img src=x onerror=alert(1)>"` },
    unsubscribeUrl: `${url}?a=1&b=2` });
  expect(hostile.html).toContain(`href="${url}?a=1&amp;b=2"`);
  expect(hostile.html).toContain("Hi --&gt;&lt;img src=x onerror=alert(1)&gt;&quot;</v:roundrect>");
  const nodes = parseFragment(hostile.html).childNodes.map(node => node.nodeName);
  expect(nodes).toEqual(["#comment", "p"]);
});
