// Runs under `bun test --config=bunfig.dom.toml` (happy-dom).
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import ComposeMarkdownEditor from "./ComposeMarkdownEditor";

afterEach(() => cleanup());

// CF-01: a Markdown draft saved by another member (or a drafts-scoped MCP
// token) must not put live HTML into the app when the draft is opened.
const DRAFT = [
  "**Hello**",
  "",
  `<iframe srcdoc="<script>parent.__xss = 1</script>"></iframe>`,
  "",
  `<img src="x" onerror="window.__xss = 1"><a href="javascript:alert(1)">click</a>`,
  "",
  "![tracker](https://tracker.example.test/pixel.gif)",
  "",
  "[site](https://example.test/)"
].join("\n");

describe("ComposeMarkdownEditor preview", () => {
  it("renders Markdown without raw HTML and blocks remote images until clicked", async () => {
    const view = render(<ComposeMarkdownEditor value={DRAFT} onChange={() => {}} />);
    const preview = await waitFor(() => {
      const node = view.container.querySelector(".w-md-editor-preview .wmde-markdown");
      if (!node?.querySelector("strong")) throw new Error("preview not rendered");
      return node as HTMLElement;
    });
    expect(preview.querySelector("strong")?.textContent).toBe("Hello");
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.container.querySelector("[onerror]")).toBeNull();
    expect(preview.querySelector("a[href^='javascript']")).toBeNull();
    expect(preview.textContent).toContain(`<iframe srcdoc="<script>parent.__xss = 1</script>"></iframe>`);
    expect(preview.querySelectorAll("img")).toHaveLength(0);
    const link = preview.querySelector("a[href='https://example.test/']");
    expect(link?.getAttribute("rel")).toBe("noreferrer");
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();

    fireEvent.click(view.getByRole("button", { name: "Remote image: tracker" }));
    await waitFor(() => expect(preview.querySelector("img")?.getAttribute("src")).toBe("https://tracker.example.test/pixel.gif"));
  });
});
