import type { ReactNode } from "react";
import type {
  Breakpoint,
  PortalActions,
  PortalDesign,
  PortalNode,
  PublicDocumentContext,
} from "./types";
import { compileStyles } from "./styleModel";
import { ContentBlock } from "./blocks/ContentBlocks";
import { OfficialBlock } from "./blocks/QuoteBlocks";
import { OrderBlock } from "./blocks/OrderBlocks";
import { CustomVisualFrame, type VisualArtifact } from "./CustomVisualFrame";
export const officialTypes = new Set([
  "Identity",
  "Customer",
  "Validity",
  "Items",
  "Summary",
  "Terms",
  "QuoteResponse",
  "Download",
  "OrderProgress",
  "OrderSales",
]);
export const contentTypes = new Set([
  "Section",
  "Columns",
  "Heading",
  "Text",
  "Image",
  "Gallery",
  "Divider",
  "Spacer",
  "Benefits",
  "FAQ",
  "Contact",
  "Link",
  "CustomVisual",
]);
export function PortalBlock({
  node,
  design,
  context,
  actions = {},
  breakpoint = "desktop",
  preview = true,
  children,
  assetUrl,
  customArtifact,
  codeEnabled = false,
}: {
  node: PortalNode;
  design: PortalDesign;
  context: PublicDocumentContext;
  actions?: PortalActions;
  breakpoint?: Breakpoint;
  preview?: boolean;
  children?: ReactNode;
  assetUrl?: (id: string) => string | undefined;
  customArtifact?: VisualArtifact;
  codeEnabled?: boolean;
}) {
  const styles = {
    ...node.styles.desktop,
    ...(breakpoint !== "desktop" ? node.styles.tablet : {}),
    ...(breakpoint === "mobile" ? node.styles.mobile : {}),
  };
  const style = compileStyles(node.styles, {}, breakpoint);
  if (node.type === "Columns") {
    (style as React.CSSProperties & { "--portal-columns": number })[
      "--portal-columns"
    ] =
      breakpoint === "mobile"
        ? 1
        : Number(styles.columns || node.props.columns || 2);
    style.display = "grid";
    style.gridTemplateColumns = `repeat(${breakpoint === "mobile" ? 1 : styles.columns || node.props.columns || 2},minmax(0,1fr))`;
  }
  const resource = (key: string) => {
    const r = design.resources[key],
      url = r && assetUrl?.(r.assetId);
    return url ? (
      <img
        src={url}
        alt={r.alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{
          height: styles.imageHeight,
          objectFit: styles.imageFit === "contain" ? "contain" : "cover",
          objectPosition:
            typeof node.props.focalX === "number"
              ? `${node.props.focalX}% ${node.props.focalY ?? 50}%`
              : styles.imagePosition || "center",
        }}
      />
    ) : (
      <div className="portal-image-pending">
        {r?.alt || "Selecciona una imagen"}
      </div>
    );
  };
  const fallbackText =
    design.customBlocks[String(node.props.blockId)]?.fallbackText ||
    "Contenido visual personalizado";
  const body =
    node.type === "Section" || node.type === "Columns" ? (
      children
    ) : node.type === "CustomVisual" ? (
      customArtifact && !preview ? (
        <CustomVisualFrame
          artifact={customArtifact}
          enabled={codeEnabled}
          fallbackText={fallbackText}
        />
      ) : (
        <div className="portal-custom-placeholder">{fallbackText}</div>
      )
    ) : node.type === "OrderProgress" || node.type === "OrderSales" ? (
      <OrderBlock node={node} context={context} />
    ) : officialTypes.has(node.type) ? (
      <OfficialBlock
        node={node}
        context={context}
        actions={actions}
        preview={preview}
      />
    ) : (
      <ContentBlock node={node} resource={resource} />
    );
  return (
    <section
      className={"portal-block portal-block-" + node.type}
      style={style}
      data-block-id={node.id}
    >
      {body}
    </section>
  );
}
