import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { classifyImageSource } from "@/lib/html/remoteContent";

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
    if (node.type === "image" && classifyImageSource(node.url) === "remote") remote = true;
    if (node.type === "definition" && node.identifier && node.url) definitions.set(node.identifier, node.url);
    if (node.type === "imageReference" && node.identifier) references.push(node.identifier);
    node.children?.forEach(walk);
  };
  walk(tree);
  return remote || references.some((identifier) => classifyImageSource(definitions.get(identifier)) === "remote");
}
