import type {
  PortalDesign,
  PortalNode,
} from "@/components/customer-pages/types";
import { referencedResources, remapImageReferences } from "./resources";
export function insertSavedSection(
  design: PortalDesign,
  section: {
    document_type: string;
    design: Pick<PortalDesign, "nodes" | "resources" | "customBlocks">;
  },
): PortalDesign {
  if (design.documentType !== section.document_type)
    throw Error("La sección pertenece a otro tipo de página");
  const source = { ...section.design, ...referencedResources(section.design, section.design.nodes) },
    out = structuredClone(design),
    resources = Object.fromEntries(
      Object.keys(source.resources).map((k) => [k, "r-" + crypto.randomUUID()]),
    ),
    blocks = Object.fromEntries(
      Object.keys(source.customBlocks).map((k) => [
        k,
        "b-" + crypto.randomUUID(),
      ]),
    );
  const copy = (nodes: PortalNode[]): PortalNode[] =>
    nodes.map((n) => ({
      ...structuredClone(n),
      id: "n-" + crypto.randomUUID(),
      props: {
        ...n.props,
        ...(n.type === "Image"
          ? { resource: resources[String(n.props.resource)] }
          : {}),
        ...(n.type === "Gallery"
          ? {
              resources: (n.props.resources as string[]).map(
                (r) => resources[r],
              ),
            }
          : {}),
        ...(n.type === "CustomVisual"
          ? { blockId: blocks[String(n.props.blockId)] }
          : {}),
      },
      children: copy(n.children),
    }));
  for (const [key, r] of Object.entries(source.resources))
    out.resources[resources[key]] = structuredClone(r);
  for (const [key, b] of Object.entries(source.customBlocks))
    out.customBlocks[blocks[key]] = { ...structuredClone(b), html: remapImageReferences(b.html, resources) };
  out.nodes.push(...copy(source.nodes));
  return out;
}
