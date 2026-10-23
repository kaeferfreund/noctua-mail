import { describe, expect, test } from "bun:test";
import { renderSignatureTemplate, replaceSignatureBlock, resolveSignatureTemplate, validSignatureTemplate } from "./signatureTemplates";
import type { SenderIdentity } from "./data";
const user = { name: "Synthetic <Alex>", email: "alex@example.test" };
const identity = { id: "alias", email: "alias@example.test", displayName: "Brand & team", signatureId: "brand" } as SenderIdentity;
const settings = { signatures: [{ id: "brand", name: "Brand", body: "Brand signature" }, { id: "shared", name: "Shared", body: "Shared signature" }], defaultSignatureId: "shared" };

describe("signature templates", () => {
  test("expands current user and identity once, normalizes newlines and HTML-escapes all substitutions", () => {
    const block = renderSignatureTemplate("{{user.name}}\r\n{{user.email}}\r{{identity.displayName}}\n{{identity.email}}", user, identity);
    expect(block.text).toBe("Synthetic <Alex>\nalex@example.test\nBrand & team\nalias@example.test");
    expect(block.html).toBe("<p>Synthetic &lt;Alex&gt;<br>alex@example.test<br>Brand &amp; team<br>alias@example.test</p>");
    expect(block.markdown).toContain("&lt;Alex&gt;");
    expect(renderSignatureTemplate("{{user.name}}", { name: "{{user.email}}", email: user.email }, identity).text).toBe("{{user.email}}");
    expect(renderSignatureTemplate("{{user.name}}", { email: user.email }, identity).text).toBe(user.email);
  });
  test("rejects arbitrary placeholders and UTF-8 templates above 8 KiB", () => {
    for (const body of ["{{user.title}}", "{{user.password}}", "{{ user.name }}", "{{identity.email", "ü".repeat(4097)]) expect(validSignatureTemplate(body)).toBe(false);
    expect(validSignatureTemplate("ü".repeat(4096))).toBe(true);
    expect(() => renderSignatureTemplate("{{user.title}}", user, identity)).toThrow();
  });
  test("personal override, explicit none, personal template, identity template and mailbox fallback", () => {
    expect(resolveSignatureTemplate(settings, { signatureOverride: "Personal {{user.name}}" }, identity).body).toBe("Personal {{user.name}}");
    expect(resolveSignatureTemplate(settings, { signatureOverride: "" }, identity).body).toBe("");
    expect(resolveSignatureTemplate(settings, { defaultSignatureId: "" }, identity).body).toBe("");
    expect(resolveSignatureTemplate(settings, { defaultSignatureId: "shared" }, identity).body).toBe("Shared signature");
    expect(resolveSignatureTemplate(settings, {}, identity).body).toBe("Brand signature");
    expect(resolveSignatureTemplate(settings, {}, { ...identity, signatureId: undefined }).body).toBe("Shared signature");
    const missing = resolveSignatureTemplate(settings, { defaultSignatureId: "deleted" }, identity);
    expect(missing.body).toBe("Brand signature"); expect(missing.warnings).toHaveLength(1);
    expect(resolveSignatureTemplate(undefined, {}, identity).body).toBe("");
  });
  test("replaces only the exact unique block and preserves an edited or ambiguous signature", () => {
    expect(replaceSignatureBlock("Note\n\nRegards\nAlex\n\n> Quote", "Regards\nAlex", "Regards\nJo", "\n\n")).toEqual({ body: "Note\n\nRegards\nJo\n\n> Quote", conflict: false });
    for (const body of ["Regards\nAlex edited", "Regards\nAlex\nTitle", "Regards\nAlex\n\nRegards\nAlex"]) expect(replaceSignatureBlock(body, "Regards\nAlex", "Replacement", "\n\n")).toEqual({ body, conflict: true });
    const html = "<p>Note</p><p>Regards<br>Alex edited</p>";
    expect(replaceSignatureBlock(html, "<p>Regards<br>Alex</p>", "<p>Jo</p>", "")).toEqual({ body: html, conflict: true });
  });
});
