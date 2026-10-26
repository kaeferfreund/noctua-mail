import { describe, expect, it } from "bun:test";
import { markdownToEmailHtml } from "./markdownEmail";
import { APP_FONT_STACK } from "./ui/fonts";

describe("markdownToEmailHtml", () => {
  it("renders preview html and inlines package css", async () => {
    const result = await markdownToEmailHtml("# Hello");
    expect(result).toContain("<style data-noctua-markdown-preview");
    expect(result).toContain('class="wmde-markdown wmde-markdown-color');
    expect(result).toContain("<h1");
    expect(result).toContain("Hello");
  });

  it("includes syntax highlighted tokens for code blocks", async () => {
    const result = await markdownToEmailHtml("```js\nconst x = 1;\n```");
    expect(result).toContain('class="language-js');
    expect(result).toContain("<pre><code");
    expect(result).toContain("const");
  });

  it("does not inline preview-only link color and underline resets", async () => {
    const result = await markdownToEmailHtml("[Example](https://example.com)");
    const linkRule = result.match(/\.wmde-markdown a\{([^}]*)\}/)?.[0] ?? "";
    expect(result).toContain('<a href="https://example.com">Example</a>');
    expect(linkRule).toBe(".wmde-markdown a{background-color:transparent}");
  });

  it("sets the app font after the package css and inline on the wrapper", async () => {
    const result = await markdownToEmailHtml("Hallo");
    const style = result.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";
    const override = `.wmde-markdown{font-family:${APP_FONT_STACK};font-size:15px;line-height:1.5}`;
    expect(style.endsWith(override)).toBe(true);

    const wrapper = result.match(/<div class="wmde-markdown wmde-markdown-color"[^>]*>/)?.[0] ?? "";
    expect(wrapper).toContain('data-color-mode="light"');
    expect(wrapper).toContain(
      `style="font-family:${APP_FONT_STACK.replaceAll('"', "'")};font-size:15px;line-height:1.5"`
    );
  });

  it("keeps monospace for code blocks", async () => {
    const result = await markdownToEmailHtml("```\ncode\n```");
    expect(result).toMatch(/\.wmde-markdown code,\.wmde-markdown pre,\.wmde-markdown tt\{font-family:ui-monospace/);
  });

  it("returns empty string for empty input", async () => {
    expect(await markdownToEmailHtml("")).toBe("");
    expect(await markdownToEmailHtml("   ")).toBe("");
  });
});
