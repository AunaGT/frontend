import type { ReactNode } from "react";

export type DocumentType = "QUOTE" | "ORDER";
export type Breakpoint = "desktop" | "tablet" | "mobile";
export type PortalStyles = Partial<
  Record<
    | "padding"
    | "margin"
    | "gap"
    | "radius"
    | "fontSize"
    | "lineHeight"
    | "maxWidth"
    | "columns"
    | "imageHeight",
    number
  > &
    Record<
      | "background"
      | "color"
      | "accent"
      | "align"
      | "fontFamily"
      | "border"
      | "shadow"
      | "imageFit"
      | "imagePosition",
      string
    >
>;
export type PortalNode = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<Breakpoint, PortalStyles>;
  visibility: { states?: string[] };
  children: PortalNode[];
};
export type CustomBlock = {
  html: string;
  css: string;
  js: string;
  fallbackText: string;
};
export type AssetRef = { assetId: string; alt: string };
export type PortalTheme = {
  accent?: string;
  background?: string;
  color?: string;
  fontFamily?: string;
  contentWidth?: "contained" | "full";
  padding?: number;
};
export type PortalDesign = {
  schemaVersion: 1;
  documentType: DocumentType;
  theme: PortalTheme;
  nodes: PortalNode[];
  resources: Record<string, AssetRef>;
  savedSections: { id: string; name: string; nodes: PortalNode[] }[];
  customBlocks: Record<string, CustomBlock>;
};
export type Diagnostic = {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
  line?: number;
  column?: number;
};
export type PortalCapabilities = {
  ready: boolean;
  reason?: string;
  origin?: string;
  policyVersion: 1;
  codeEnabled?: boolean;
  policyRevision?: number;
};
export type PortalScope = {
  companyId: string;
  userId: string;
  sessionId: string;
  branchId?: string;
};
export type DraftRecord = {
  id: string;
  name: string;
  documentType: DocumentType;
  revision: number;
  draftVersionId: string;
  design: PortalDesign;
  capabilities: PortalCapabilities;
  updatedAt: string;
  designHash?: string;
  codeHash?: string;
  publishedVersionId?: string | null;
  state?: string;
};
export type PublishedPortal = {
  versionId: string;
  designHash: string;
  rendererVersion: 1;
  design: PortalDesign;
  customCodeEnabled: boolean;
  customArtifacts: Record<
    string,
    { url: string; hash: string; channelId: string }
  >;
};
export type PortalLine = {
  packageComponentKey?:string;
  name: string;
  code?: string;
  image?: string;
  qty: string;
  fulfilled?: string;
  fulfilledUnitLabel?: string;
  unitLabel?: string;
  unitPrice: string;
  total: string;
  conditions?: string;
};
export type PublicDocumentContext = {
  packageGroups?:import('@/modules/inventory/packages/types').PackageGroup[];
  documentType: DocumentType;
  reference: string;
  status: string;
  companyName: string;
  companyLogo?: string;
  customer?: string;
  customerNit?: string;
  createdAt?: string;
  validUntil?: string;
  notes?: string;
  paymentCondition?: string;
  eventPaymentTerms?:import('@/services/eventPaymentTerms').PublicEventPaymentTerms|null;
  creditDays?: number;
  subtotal: string;
  discount: string;
  total: string;
  currency: string;
  locale: string;
  timezone: string;
  lines: PortalLine[];
  sales?: {
    reference: string;
    total: string;
    date?: string;
    status?: string;
  }[];
  contact?: { email?: string; phone?: string; address?: string };
  canRespond?: boolean;
};
export type PortalActions = {
  onDownloadPdf?: () => void;
  onQuoteDecision?: (status: "ACCEPTED" | "REJECTED") => void;
  busy?: boolean;
  error?: string;
};
export type RenderOfficial = (
  node: PortalNode,
  children: ReactNode,
) => ReactNode;
