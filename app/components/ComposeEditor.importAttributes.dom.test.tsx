// Runs under `bun test --config=bunfig.dom.toml` (happy-dom).
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, waitFor } from "@testing-library/react";
import { $getRoot, $isElementNode, createEditor, type LexicalEditor, type LexicalNode } from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";
import { render } from "@/lib/i18n/testRender";
import ComposeEditor from "./ComposeEditor";
import { CenterNode } from "./lexical/CenterNode";
import {
  ExtendedTableCellNode,
  ExtendedTableNode,
  ExtendedTableRowNode,
  extendedTableNodeReplacements
} from "./lexical/ExtendedTableNodes";
import { filterImportedAttributes } from "./lexical/importedAttributes";

afterEach(() => {
  cleanup();
});

// SD1: received HTML opened with "edit as new" (or quote editing, the source
// view) goes through the custom nodes that keep attributes. Active attributes
// must not reach the app document or the outgoing HTML.
const MAIL_HTML = [
  `<center id="app-root" class="rt-Button" onmouseover="window.__sd1 = 1" onfocus="window.__sd1 = 2" tabindex="0"`,
  ` srcdoc="&lt;script&gt;window.__sd1 = 3&lt;/script&gt;" formaction="/api/accounts"`,
  ` style="position:fixed;inset:0;z-index:99999;color:#123456;background:url(https://tracker.example.test/c.gif)" align="center">`,
  `<p>Hello</p></center>`,
  `<table id="t" onclick="window.__sd1 = 4" style="width:600px" border="1" data-x="y"><tbody>`,
  `<tr onmouseenter="window.__sd1 = 5" valign="top"><td onclick="window.__sd1 = 6" colspan="2" background="javascript:alert(1)">Cell</td></tr>`,
  `</tbody></table>`
].join("");

const editable = (container: HTMLElement) => container.querySelector("[contenteditable='true']") as HTMLElement;

function activeAttributes(root: ParentNode) {
  return [...root.querySelectorAll("*")].flatMap((element) =>
    element.getAttributeNames().filter((name) => /^on/i.test(name) || name === "srcdoc" || name === "formaction")
  );
}

// The element each custom node writes to the outgoing HTML (exportDOM).
function exportedElements(html: string) {
  const editor: LexicalEditor = createEditor({
    namespace: "sd1-export",
    nodes: [ExtendedTableNode, ExtendedTableCellNode, ExtendedTableRowNode, ...extendedTableNodeReplacements, CenterNode],
    onError(error: Error) {
      throw error;
    }
  });
  editor.update(
    () => {
      const dom = new DOMParser().parseFromString(html, "text/html");
      $getRoot().append(...$generateNodesFromDOM(editor, dom).filter((node) => node.getType() !== "text"));
    },
    { discrete: true }
  );
  return editor.read(() => {
    const elements: HTMLElement[] = [];
    const visit = (node: LexicalNode) => {
      if (node instanceof CenterNode || node instanceof ExtendedTableNode || node instanceof ExtendedTableRowNode || node instanceof ExtendedTableCellNode) {
        const { element } = node.exportDOM(editor);
        if (element instanceof HTMLElement) elements.push(element);
      }
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    $getRoot().getChildren().forEach(visit);
    return elements;
  });
}

describe("ComposeEditor import of mail attributes (SD1)", () => {
  it("keeps active attributes out of the editor DOM", async () => {
    const view = render(<ComposeEditor initialHtml={MAIL_HTML} resetKey={1} onChange={() => {}} />);
    await waitFor(() => expect(editable(view.container).querySelector("center")).toBeTruthy());
    await waitFor(() => expect(editable(view.container).querySelector("td")).toBeTruthy());

    const root = editable(view.container);
    const center = root.querySelector("center")!;
    expect(activeAttributes(root)).toEqual([]);
    // Lexical sets `dir` itself.
    expect(center.getAttributeNames().filter((name) => name !== "dir").sort()).toEqual(["align", "style"]);
    const liveStyle = center.getAttribute("style") ?? "";
    expect(liveStyle).toContain("color");
    expect(liveStyle).not.toMatch(/url\(|position|inset|z-index/i);
    expect(root.querySelector("#app-root, #t, .rt-Button, [tabindex]")).toBeNull();
    expect((window as unknown as { __sd1?: number }).__sd1).toBeUndefined();
  });

  it("keeps active attributes out of the exported HTML and keeps presentational ones", () => {
    const elements = exportedElements(MAIL_HTML);
    const byTag = (tag: string) => elements.find((element) => element.tagName.toLowerCase() === tag)!;
    expect(elements.map((element) => element.tagName.toLowerCase()).sort()).toEqual(["center", "table", "td", "tr"]);
    for (const element of elements) {
      expect(element.getAttributeNames().filter((name) => /^on/i.test(name) || ["srcdoc", "formaction", "id", "data-x", "tabindex"].includes(name))).toEqual([]);
    }
    expect(byTag("table").getAttribute("border")).toBe("1");
    expect(byTag("table").getAttribute("style")).toContain("width");
    expect(byTag("td").getAttribute("colspan")).toBe("2");
    expect(byTag("td").hasAttribute("background")).toBe(false);
    expect(byTag("tr").getAttribute("valign")).toBe("top");
    expect(byTag("center").getAttribute("align")).toBe("center");
  });

  it("does not mount a remote CSS image from imported markup or a sender stylesheet (SD57)", async () => {
    const html =
      `<style>.promo{background-image:url(https://tracker.example.test/sheet.gif)}</style>` +
      `<center class="promo">Sale</center>` +
      `<p><span style="background:url(https://tracker.example.test/span.gif)">Text</span></p>`;
    const view = render(<ComposeEditor initialHtml={html} resetKey={2} onChange={() => {}} />);
    await waitFor(() => expect(editable(view.container).textContent).toContain("Text"));
    expect(editable(view.container).innerHTML).not.toContain("tracker.example.test");
  });

  it("filters attributes restored from a serialized editor state", () => {
    expect(
      filterImportedAttributes({ onclick: "x()", ONLOAD: "y()", id: "a", style: "color:red", align: "left", background: "https://example.test/b.png" })
    ).toEqual({ style: "color:red", align: "left", background: "https://example.test/b.png" });
  });
});
