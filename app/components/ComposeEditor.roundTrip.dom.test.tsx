// Runs only under `bun run test:dom` (happy-dom). Covers the compose editor's
// HTML ↔ Lexical ↔ markdown path, which has no other test.
import { describe, expect, it } from "bun:test";
import {
  $createParagraphNode,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $isTextNode,
  createEditor,
  type ElementNode,
  type LexicalEditor
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeHighlightNode, CodeNode } from "@lexical/code-core";
import { ListItemNode, ListNode } from "@lexical/list";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { CenterNode } from "./lexical/CenterNode";
import {
  ExtendedTableCellNode,
  ExtendedTableNode,
  ExtendedTableRowNode,
  extendedTableNodeReplacements
} from "./lexical/ExtendedTableNodes";
import { ImageNode } from "./lexical/ImageNode";
import { QuotedMessageNode } from "./lexical/QuotedMessageNode";

function createComposeEditor(): LexicalEditor {
  return createEditor({
    namespace: "noctua-compose-roundtrip",
    nodes: [
      HeadingNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      ExtendedTableNode,
      ExtendedTableCellNode,
      ExtendedTableRowNode,
      ...extendedTableNodeReplacements,
      CenterNode,
      ImageNode,
      QuotedMessageNode
    ],
    onError(error: Error) {
      throw error;
    }
  });
}

function importHtml(editor: LexicalEditor, html: string) {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const dom = new DOMParser().parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      for (const node of nodes) {
        if ($isElementNode(node) || $isDecoratorNode(node)) {
          root.append(node);
        } else if ($isTextNode(node)) {
          const paragraph = $createParagraphNode();
          paragraph.append(node);
          root.append(paragraph);
        }
      }
    },
    { discrete: true }
  );
}

function exportHtml(editor: LexicalEditor): string {
  return editor.read(() => $generateHtmlFromNodes(editor, null));
}

function exportMarkdown(editor: LexicalEditor): string {
  return editor.read(() => $convertToMarkdownString(TRANSFORMERS));
}

function findByType(node: ElementNode, type: string): ElementNode | null {
  for (const child of node.getChildren()) {
    if (!$isElementNode(child)) continue;
    if (child.getType() === type) return child;
    const nested = findByType(child, type);
    if (nested) return nested;
  }
  return null;
}

describe("compose editor html and markdown round trip", () => {
  it("keeps headings, emphasis, links, and lists through html and markdown", () => {
    const editor = createComposeEditor();
    importHtml(
      editor,
      "<h1>Hello</h1><p>This is <strong>bold</strong> and <a href=\"https://example.com\">Example</a></p><ul><li>one</li><li>two</li></ul>"
    );

    const html = exportHtml(editor);
    expect(html).toContain("<h1>");
    expect(html).toContain(">Hello<");
    expect(html).toContain("<b><strong");
    expect(html).toContain(">bold<");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">Example<");
    expect(html).toContain("<ul>");
    expect(html).toContain(">one<");
    expect(html).toContain(">two<");

    expect(exportMarkdown(editor)).toBe(
      "# Hello\n\nThis is **bold** and [Example](https://example.com)\n\n- one\n- two"
    );

    const json = editor.getEditorState().toJSON();
    const restored = createComposeEditor();
    restored.setEditorState(restored.parseEditorState(json));
    expect(exportHtml(restored)).toBe(html);
    expect(exportMarkdown(restored)).toBe(exportMarkdown(editor));
  });

  it("round-trips a markdown document through the shared transformers", () => {
    const markdown = "# Hello\n\n**bold** and [Example](https://example.com)\n\n- one\n- two";
    const editor = createComposeEditor();
    editor.update(() => {
      $getRoot().clear();
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    }, { discrete: true });

    expect(exportMarkdown(editor)).toBe(markdown);
    const html = exportHtml(editor);
    expect(html).toContain("<h1>");
    expect(html).toContain(">Hello<");
    expect(html).toContain("<b><strong");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<ul>");
    expect(html).toContain(">one<");
    expect(html).toContain(">two<");
  });

  it("keeps quotes, inline code, center, and images in the html export", () => {
    const editor = createComposeEditor();
    importHtml(
      editor,
      "<blockquote>quote</blockquote><p><em>italic</em> and <code>fn()</code></p><center>mid</center><p>before <img src=\"https://example.com/a.png\" alt=\"pic\" width=\"32\" height=\"16\"> after</p>"
    );

    const html = exportHtml(editor);
    expect(html).toContain("<blockquote>");
    expect(html).toContain(">quote<");
    expect(html).toContain("<i><em");
    expect(html).toContain(">italic<");
    expect(html).toContain("<code");
    expect(html).toContain(">fn()<");
    expect(html).toContain("<center>");
    expect(html).toContain(">mid<");
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('alt="pic"');
    expect(html).toContain('width="32"');
    expect(html).toContain('height="16"');
    expect(exportMarkdown(editor)).toContain("> quote");
    expect(exportMarkdown(editor)).toContain("*italic*");
    expect(exportMarkdown(editor)).toContain("`fn()`");
  });

  it("imports a table onto the extended nodes and keeps its attributes", () => {
    const editor = createComposeEditor();
    importHtml(
      editor,
      "<table border=\"1\"><tbody><tr><td colspan=\"2\" align=\"center\">cell</td></tr></tbody></table>"
    );

    const snapshot = editor.read(() => {
      const root = $getRoot();
      const table = findByType(root, "extended-table");
      const row = table && findByType(table, "extended-tablerow");
      const cell = row && findByType(row, "extended-tablecell");
      return {
        tableAttributes: table instanceof ExtendedTableNode ? table.__attributes : null,
        rowAttributes: row instanceof ExtendedTableRowNode ? row.__attributes : null,
        cellAttributes: cell instanceof ExtendedTableCellNode ? cell.__attributes : null,
        cellText: cell?.getTextContent() ?? "",
        markdown: $convertToMarkdownString(TRANSFORMERS)
      };
    });

    expect(snapshot.tableAttributes).toMatchObject({ border: "1" });
    expect(snapshot.rowAttributes).toEqual({});
    expect(snapshot.cellAttributes).toMatchObject({ colspan: "2", align: "center" });
    expect(snapshot.cellText).toBe("cell");
    expect(snapshot.markdown).toBe("cell");
  });
});
