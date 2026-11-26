import { useEffect, useRef, useState } from "react";
import type {
  Breakpoint,
  PortalActions,
  PortalNode,
  PublishedPortal,
  PublicDocumentContext,
} from "./types";
import { PortalBlock, officialTypes, contentTypes } from "./PortalBlock";
import { PortalErrorBoundary } from "./PortalErrorBoundary";
import { compilePageStyles } from "./styleModel";
import "./portal.css";
const blankStyles = { desktop: {}, tablet: {}, mobile: {} };
export function breakpointForWidth(width: number): Breakpoint {
  return width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}
function fallbackNodes(type: string): PortalNode[] {
  return [
    "Identity",
    "Customer",
    ...(type === "QUOTE" ? ["Validity"] : []),
    "Items",
    "Summary",
    type === "QUOTE" ? "QuoteResponse" : "OrderProgress",
  ].map((t) => ({
    id: t,
    type: t,
    props: {},
    styles: blankStyles,
    visibility: {},
    children: [],
  }));
}
export function PortalRenderer({
  portal,
  context,
  actions,
  mode,
  assetUrl,
  breakpoint,
}: {
  portal: PublishedPortal;
  context: PublicDocumentContext;
  actions: PortalActions;
  mode: "public" | "preview";
  assetUrl?: (id: string) => string | undefined;
  breakpoint?: Breakpoint;
}) {
  const container = useRef<HTMLElement>(null);
  const [measuredPoint, setPoint] = useState<Breakpoint>("desktop");
  const point = breakpoint || measuredPoint;
  useEffect(() => {
    if (breakpoint || !container.current) return;
    const update = () => setPoint(breakpointForWidth(container.current!.getBoundingClientRect().width));
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(container.current);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [breakpoint]);
  const d = portal.design;
  const unknown = (nodes: PortalNode[]): boolean =>
    nodes.some(
      (n) =>
        (!officialTypes.has(n.type) && !contentTypes.has(n.type)) ||
        unknown(n.children),
    );
  const valid =
    portal.rendererVersion === 1 &&
    d.documentType === context.documentType &&
    !unknown(d.nodes);
  const render = (nodes: PortalNode[]) =>
    nodes
      .filter(
        (n) =>
          !n.visibility.states || n.visibility.states.includes(context.status),
      )
      .map((n) => (
        <PortalBlock
          key={n.id}
          node={n}
          design={d}
          context={context}
          actions={actions}
          breakpoint={point}
          preview={mode === "preview"}
          assetUrl={assetUrl}
          customArtifact={portal.customArtifacts[String(n.props.blockId)]}
          codeEnabled={portal.customCodeEnabled}
        >
          {render(n.children)}
        </PortalBlock>
      ));
  const fallback = render(fallbackNodes(context.documentType));
  return (
    <main
      ref={container}
      className="customer-portal"
      data-breakpoint={point}
      style={compilePageStyles(d.theme, point)}
    >
      <div className="portal-page-content">
        <PortalErrorBoundary resetKey={portal.versionId} fallback={fallback}>
          {valid ? render(d.nodes) : fallback}
        </PortalErrorBoundary>
      </div>
    </main>
  );
}
