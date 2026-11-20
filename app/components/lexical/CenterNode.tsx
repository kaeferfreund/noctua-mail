/**
 * Custom node to preserve <center> tags from HTML emails
 */

import { ElementNode, type DOMConversionMap, type DOMConversionOutput, type LexicalNode, type NodeKey, type SerializedElementNode, type Spread } from "lexical";
import { applyExportAttributes, applyLiveAttributes, filterImportedAttributes } from "./importedAttributes";

type SerializedCenterNode = Spread<
  { attributes?: Record<string, string> },
  SerializedElementNode
>;

export class CenterNode extends ElementNode {
  __attributes: Record<string, string>;

  constructor(key?: NodeKey) {
    super(key);
    this.__attributes = {};
  }

  static getType(): string {
    return "center";
  }

  static clone(node: CenterNode): CenterNode {
    const clone = new CenterNode(node.__key);
    clone.__attributes = { ...node.__attributes };
    return clone;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      center: () => ({
        conversion: convertCenterElement,
        priority: 1
      })
    };
  }

  static importJSON(serializedNode: SerializedCenterNode): CenterNode {
    const node = new CenterNode();
    node.__attributes = filterImportedAttributes(serializedNode.attributes);
    return node;
  }

  exportJSON(): SerializedCenterNode {
    return {
      ...super.exportJSON(),
      type: "center",
      attributes: this.__attributes
    };
  }

  // Mounted in the app document: presentational attributes only (SD1).
  createDOM(): HTMLElement {
    const element = document.createElement("center");
    applyLiveAttributes(element, this.__attributes);
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM() {
    const element = document.createElement("center");
    applyExportAttributes(element, this.__attributes);
    return { element };
  }
}

function convertCenterElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLElement)) return null;
  const node = new CenterNode();
  // Mail markup is untrusted: keep presentational attributes only (SD1).
  node.__attributes = filterImportedAttributes(domNode);
  return { node };
}

export function $createCenterNode(): CenterNode {
  return new CenterNode();
}

export function $isCenterNode(node: LexicalNode | null | undefined): node is CenterNode {
  return node instanceof CenterNode;
}
