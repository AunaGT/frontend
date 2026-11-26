import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";
import type { PortalDesign, PortalNode } from "@/components/customer-pages/types";

function imageAttributes(html: string) {
  const fragment = parseFragment(html);
  const attributes: DefaultTreeAdapterMap["element"]["attrs"] = [];
  const visit = (node: DefaultTreeAdapterMap["node"]) => {
    if ("tagName" in node && node.tagName === "img")
      attributes.push(...node.attrs.filter((a) => a.name === "data-asset" && !a.namespace));
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  };
  visit(fragment);
  return { fragment, attributes };
}

export function remapImageReferences(html: string, names: Record<string, string>) {
  const { fragment, attributes } = imageAttributes(html);
  for (const a of attributes)
    if (Object.prototype.hasOwnProperty.call(names, a.value)) a.value = names[a.value];
  return serialize(fragment);
}

export function referencedResources(
  design: Pick<PortalDesign, "resources" | "customBlocks">,
  nodes: PortalNode[],
) {
  const images = new Set<string>(), blocks = new Set<string>();
  const visit = (list: PortalNode[]) => {
    for (const n of list) {
      if (n.type === "Image") images.add(String(n.props.resource));
      if (n.type === "Gallery")
        for (const key of (n.props.resources as string[]) || []) images.add(key);
      if (n.type === "CustomVisual") blocks.add(String(n.props.blockId));
      visit(n.children);
    }
  };
  visit(nodes);
  for (const key of blocks) {
    const block = design.customBlocks[key];
    if (block) for (const a of imageAttributes(block.html).attributes) images.add(a.value);
  }
  return {
    resources: Object.fromEntries(Object.entries(design.resources).filter(([key]) => images.has(key))),
    customBlocks: Object.fromEntries(Object.entries(design.customBlocks).filter(([key]) => blocks.has(key))),
  };
}

export function pruneResources(design: PortalDesign): PortalDesign {
  return {
    ...design,
    ...referencedResources(design, [...design.nodes, ...design.savedSections.flatMap((s) => s.nodes)]),
  };
}
