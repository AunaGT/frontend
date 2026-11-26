import type {
  PortalDesign,
  PortalNode,
  PortalStyles,
} from "@/components/customer-pages/types";

export type PageSource = { html: string; css: string };
export const sourceStyleNames: Record<string, string> = {
  padding: "padding",
  margin: "margin",
  gap: "gap",
  radius: "border-radius",
  fontSize: "font-size",
  lineHeight: "line-height",
  maxWidth: "max-width",
  columns: "-auna-columns",
  imageHeight: "-auna-image-height",
  background: "background-color",
  color: "color",
  accent: "-auna-accent",
  align: "text-align",
  fontFamily: "font-family",
  contentWidth: "-auna-content-width",
  border: "-auna-border",
  shadow: "-auna-shadow",
  imageFit: "object-fit",
  imagePosition: "object-position",
};
export const sourceTag = (type: string) =>
  "auna-" + type.replace(/[A-Z]/g, (c, i) => (i ? "-" : "") + c.toLowerCase());
const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const attr = (key: string, value: unknown) =>
  ` ${key}="${escape(typeof value === "string" ? value : JSON.stringify(value))}"`;
const styleRule = (selector: string, styles: PortalStyles) => {
  const declarations = Object.entries(styles).map(([key, value]) => {
    const unit =
      typeof value === "number" && !["columns", "lineHeight"].includes(key)
        ? "px"
        : "";
    return `  ${sourceStyleNames[key]}: ${value}${unit};`;
  });
  return declarations.length
    ? `${selector} {\n${declarations.join("\n")}\n}`
    : "";
};
export function serializePageSource(design: PortalDesign): PageSource {
  const rules: Record<string, string[]> = {
    desktop: [],
    tablet: [],
    mobile: [],
  };
  const write = (node: PortalNode, depth: number): string => {
    const indent = "  ".repeat(depth),
      tag = sourceTag(node.type);
    for (const point of ["desktop", "tablet", "mobile"] as const) {
      const rule = styleRule("#" + node.id, node.styles[point]);
      if (rule) rules[point].push(rule);
    }
    const attributes =
      attr("id", node.id) +
      Object.entries(node.props)
        .map(([key, value]) => attr(key.toLowerCase(), value))
        .join("") +
      (node.visibility.states
        ? attr("data-states", node.visibility.states)
        : "");
    return node.children.length
      ? `${indent}<${tag}${attributes}>\n${node.children.map((n) => write(n, depth + 1)).join("\n")}\n${indent}</${tag}>`
      : `${indent}<${tag}${attributes}></${tag}>`;
  };
  const html = `<auna-page>\n${design.nodes.map((n) => write(n, 1)).join("\n")}\n</auna-page>`;
  const theme = styleRule("auna-page", design.theme);
  return {
    html,
    css: [
      theme,
      ...rules.desktop,
      rules.tablet.length
        ? `@media (max-width: 1023px) {\n${rules.tablet.join("\n")}\n}`
        : "",
      rules.mobile.length
        ? `@media (max-width: 639px) {\n${rules.mobile.join("\n")}\n}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
