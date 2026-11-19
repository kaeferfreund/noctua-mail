import { expect, test } from "bun:test";
import { normalizeTemplate, renderContent, sampleContact } from "./render";

const base = {
  contact: { ...sampleContact, firstName: 'A"<script>alert(1)</script>&', lastName: "" },
  organizationName: "B & C", organizationAddress: "Beispielstraße 1",
  unsubscribeUrl: "https://links.example.test/t/u/test?x=1&y=2", now: Date.UTC(2026, 0, 1)
};

test("normalizes Klaviyo syntax, defaults and links, and derives the text part", () => {
  const html = normalizeTemplate(`<p>{{last_name|default:'Hallo'}} {{ organization.name }} {% current_year %}</p>{% unsubscribe 'Hier & jetzt' %}`, true);
  expect(html).toContain('{{ last_name|default:"Hallo" }}');
  expect(normalizeTemplate(html, true)).toBe(html);
  const rendered = renderContent({ subject: "{{ organization.full_address }} {{ unknown }}", html, text: "" }, base);
  expect(rendered).toMatchObject({ subject: "Beispielstraße 1 ", warnings: ["Unbekannter Platzhalter: unknown"] });
  expect(rendered.html).toContain("Hallo B &amp; C 2026");
  expect(rendered.html).toContain('href="https://links.example.test/t/u/test?x=1&amp;y=2"');
  expect(rendered.text).toContain("Hier & jetzt");
  expect(rendered.text).toContain(base.unsubscribeUrl);
});

test("escapes text and attributes and URL-encodes values without escaping the unsubscribe URL", () => {
  const html = `<a href=https://example.test/?name={{ first_name }} title="{{ first_name }}">{{ first_name }}</a>
    <a href="{% unsubscribe_link %}">Abmelden</a><script>{{ first_name }}</script>`;
  const rendered = renderContent({ subject: "Text", html, text: "{{ missing }}{{ email }}" }, base);
  expect(rendered.html).toContain('title="A&quot;&lt;script&gt;alert(1)&lt;/script&gt;&amp;"');
  expect(rendered.html).toContain("A%22%3Cscript%3Ealert(1)%3C%2Fscript%3E%26");
  expect(rendered.html).toContain("A\"&lt;script&gt;alert(1)&lt;/script&gt;&amp;");
  expect(rendered.html).toContain("<script></script>");
  expect(rendered.text).toBe("alex@example.test");
  expect(rendered.warnings).toEqual(["Unbekannter Platzhalter: missing"]);
});

test("blocks a scheme assembled from a placeholder and strips line breaks from the subject", () => {
  const rendered = renderContent({ subject: "{{ first_name }}", html: '<a href="java{{ last_name }}script:alert(1)">Link</a>', text: "" },
    { ...base, contact: { ...base.contact, firstName: "A\r\nB" } });
  expect(rendered.html).toContain('href=""');
  expect(rendered.subject).toBe("A B");
});
