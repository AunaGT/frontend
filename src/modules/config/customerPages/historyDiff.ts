import type {
  PortalDesign,
  PortalNode,
} from "@/components/customer-pages/types";
export function diffPortalDesigns(a: PortalDesign, b: PortalDesign) {
  const flatten = (d: PortalDesign) => {
    const out: Record<string, string> = {};
    const record = (value: unknown, path: string) => {
      if (value && typeof value === "object" && !Array.isArray(value))
        for (const [k, v] of Object.entries(value)) record(v, path + "." + k);
      else out[path] = JSON.stringify(value) ?? "—";
    };
    record(d.theme, "tema");
    const visit = (nodes: PortalNode[], parent: string) =>
      nodes.forEach((n, index) => {
        const path = n.type + " " + n.id;
        record(
          {
            props: n.props,
            styles: n.styles,
            visibility: n.visibility,
            position: parent + ":" + index,
          },
          path,
        );
        visit(n.children, n.id);
      });
    visit(d.nodes, "raíz");
    out["Código visual"] = JSON.stringify(d.customBlocks);
    return out;
  };
  const before = flatten(a),
    after = flatten(b);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => before[k] !== after[k])
    .slice(0, 200)
    .map((path) => ({
      path,
      before:
        path === "Código visual"
          ? "Versión anterior"
          : (before[path] || "No definido").slice(0, 150),
      after:
        path === "Código visual"
          ? "Código modificado; revisa su procedencia"
          : (after[path] || "No definido").slice(0, 150),
    }));
}
