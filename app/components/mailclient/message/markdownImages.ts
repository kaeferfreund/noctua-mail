import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { isLocalMailResource } from "@/lib/html/remoteContent";

/**
 * How a Markdown image source is treated in the app document:
 * - `local`: inline/attachment resources of the message, always shown;
 * - `remote`: absolute http(s) URLs, shown only with remote-content consent;
 * - `inert`: anything else (relative app paths, other schemes), never loaded.
 */
export type MarkdownImageKind = "local" | "remote" | "inert";

export function classifyMarkdownImage(src: string | null | undefined): MarkdownImageKind {
  const value = src?.trim() ?? "";
  if (!value) return "inert";
  if (isLocalMailResource(value)) return "local";
  return /^https?:\/\//i.test(value) ? "remote" : "inert";
}

const markdownParser = unified().use(remarkParse).use(remarkGfm);

type MarkdownNode = { type: string; url?: string; identifier?: string; children?: MarkdownNode[] };

/**
 * Whether rendering `source` (with the remark plugins of MarkdownContent)
 * would request a remote image: inline images and reference images whose
 * definition points to a remote URL. Raw HTML is rendered as text, so it
 * never loads anything.
 */
export function hasRemoteMarkdownImages(source: string) {
  if (!source.includes("](") && !source.includes("]:") && !source.includes("![")) return false;
  const tree = markdownParser.parse(source) as MarkdownNode;
  const definitions = new Map<string, string>();
  const references: string[] = [];
  let remote = false;
  const walk = (node: MarkdownNode) => {
    if (node.type === "image" && classifyMarkdownImage(node.url) === "remote") remote = true;
    if (node.type === "definition" && node.identifier && node.url) definitions.set(node.identifier, node.url);
    if (node.type === "imageReference" && node.identifier) references.push(node.identifier);
    node.children?.forEach(walk);
  };
  walk(tree);
  return remote || references.some((identifier) => classifyMarkdownImage(definitions.get(identifier)) === "remote");
}
