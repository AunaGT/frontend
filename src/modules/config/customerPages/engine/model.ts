import type {
  PortalDesign,
  PortalNode,
} from "@/components/customer-pages/types";
export type EngineNode = {
  type: string;
  props: {
    id: string;
    content: EngineNode[];
    auna: Omit<PortalNode, "id" | "type" | "children">;
  };
};
export type EngineData = {
  root: { props: Record<string, unknown> };
  content: EngineNode[];
};
export function toPuckData(design: PortalDesign): EngineData {
  const convert = ({
    id,
    type,
    children,
    ...auna
  }: PortalNode): EngineNode => ({
    type,
    props: { id, content: children.map(convert), auna: structuredClone(auna) },
  });
  return { root: { props: {} }, content: design.nodes.map(convert) };
}
export function fromPuckData(
  data: EngineData,
  design: PortalDesign,
): PortalDesign {
  const resources = structuredClone(design.resources);
  const convert = ({ type, props }: EngineNode): PortalNode => {
    const auna = structuredClone(props.auna);
    if (type === "Image" && !resources[String(auna.props.resource)]) {
      const key = "photo-" + props.id;
      resources[key] = { assetId: "", alt: "Describe tu imagen" };
      auna.props.resource = key;
    }
    return {
      id: props.id,
      type,
      ...auna,
      children: (props.content || []).map(convert),
    };
  };
  const nodes = data.content.map(convert);
  return { ...design, resources, nodes };
}
