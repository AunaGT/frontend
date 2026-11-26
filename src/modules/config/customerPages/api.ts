import {
  apiFetch,
  getApiBaseUrl,
  getActiveCompanyId,
  getActiveBranchId,
  ApiError,
} from "@/services/api";
import {
  authSessionIdentity,
  authSessionMatches,
} from "@/services/authSession";
import type {
  PortalScope,
  DraftRecord,
  DocumentType,
  PortalDesign,
  PortalCapabilities,
  PublishedPortal,
} from "@/components/customer-pages/types";
export type BlockDefinition = {
  label: string;
  container?: boolean;
  official?: boolean;
  required?: boolean;
  requiredFor?: string[];
  documentType?: DocumentType;
  props: Record<string, string>;
};
export type PortalSchema = {
  schemaVersion: 1;
  blocks: Record<string, BlockDefinition>;
  bases: Record<DocumentType, Record<string, PortalDesign>>;
  capabilities: PortalCapabilities;
  limits: Record<string, number>;
};
export type PortalRow = {
  id: string;
  name: string;
  documentType: DocumentType;
  revision: number;
  state: string;
  updatedAt: string;
  publishedVersionId?: string;
  active?: boolean;
};
export type PortalVersion = {
  id: string;
  number: number;
  publishedAt: string;
  designHash: string;
  codeHash: string;
  authorId: string;
  active: boolean;
};
export type SavedSection = {
  id: string;
  name: string;
  document_type: DocumentType;
  design: PortalDesign;
};
export function assertPortalScope(scope: PortalScope, signal?: AbortSignal) {
  if (
    signal?.aborted ||
    getActiveCompanyId() !== scope.companyId ||
    (scope.branchId || null) !== (getActiveBranchId() || null) ||
    authSessionIdentity() !== scope.sessionId ||
    !authSessionMatches(scope.userId)
  )
    throw new DOMException("Cambió la empresa o sesión", "AbortError");
}
export async function portalRequest<T>(
  scope: PortalScope,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  assertPortalScope(scope, options.signal || undefined);
  const value = await apiFetch<T>("/settings/customer-pages" + path, {
    ...options,
    cache: "no-store",
    headers: {
      "X-Company-Id": scope.companyId,
      ...(scope.branchId ? { "X-Branch-Id": scope.branchId } : {}),
    },
  });
  assertPortalScope(scope, options.signal || undefined);
  return value;
}
const write = (body: unknown, method = "POST", signal?: AbortSignal) => ({
  method,
  signal,
  body: JSON.stringify(body),
});
const id = (value: string) => encodeURIComponent(value);
export const getPortalSchema = (s: PortalScope, signal?: AbortSignal) =>
  portalRequest<PortalSchema>(s, "/schema", { signal });
export const listPortalTemplates = (
  s: PortalScope,
  { type = "", page = 1, state = "ACTIVE" } = {},
  signal?: AbortSignal,
) =>
  portalRequest<{ rows: PortalRow[]; total: number }>(
    s,
    `?page=${page}&pageSize=20&state=${state}${type ? "&type=" + type : ""}`,
    { signal },
  );
export const getPortalDraft = (
  s: PortalScope,
  key: string,
  signal?: AbortSignal,
) => portalRequest<DraftRecord>(s, "/" + id(key), { signal });
export const createPortalDraft = (
  s: PortalScope,
  input: {
    name: string;
    documentType: DocumentType;
    baseId: string;
    requestId: string;
  },
  signal?: AbortSignal,
) => portalRequest<DraftRecord>(s, "", write(input, "POST", signal));
export const savePortalDraft = (
  s: PortalScope,
  key: string,
  input: {
    name: string;
    design: PortalDesign;
    expectedRevision: number;
    requestId: string;
  },
  signal?: AbortSignal,
) => portalRequest<DraftRecord>(s, "/" + id(key), write(input, "PUT", signal));
export const portalAction = <T = DraftRecord>(
  s: PortalScope,
  key: string,
  action: "duplicate" | "publish" | "restore" | "activate" | "archive",
  input: Record<string, unknown>,
  signal?: AbortSignal,
) =>
  portalRequest<T>(
    s,
    `/${id(key)}/${action}`,
    write({ ...input, requestId: crypto.randomUUID() }, "POST", signal),
  );
export const publishPortal = (
  s: PortalScope,
  r: DraftRecord,
  acknowledgedCodeHash?: string,
  signal?: AbortSignal,
) =>
  portalAction<PublishedPortal>(
    s,
    r.id,
    "publish",
    {
      expectedRevision: r.revision,
      expectedDesignHash: r.designHash,
      ...(acknowledgedCodeHash ? { acknowledgedCodeHash } : {}),
    },
    signal,
  );
export const exportPortal = (
  s: PortalScope,
  key: string,
  signal?: AbortSignal,
) =>
  portalRequest<{ filename: string; json: string }>(s, `/${id(key)}/export`, {
    signal,
  });
export const importPortal = (
  s: PortalScope,
  input: { name: string; documentType: DocumentType; source: string },
  signal?: AbortSignal,
) =>
  portalRequest<DraftRecord>(
    s,
    "/import",
    write({ ...input, requestId: crypto.randomUUID() }, "POST", signal),
  );
export const listVersions = (
  s: PortalScope,
  key: string,
  page = 1,
  signal?: AbortSignal,
) =>
  portalRequest<{ rows: PortalVersion[]; total: number }>(
    s,
    `/${id(key)}/versions?page=${page}`,
    { signal },
  );
export const getPortalVersion = (
  s: PortalScope,
  key: string,
  version: string,
  signal?: AbortSignal,
) =>
  portalRequest<PublishedPortal>(s, `/${id(key)}/versions/${id(version)}`, {
    signal,
  });
export const listPortalAssets = (
  s: PortalScope,
  page = 1,
  signal?: AbortSignal,
) =>
  portalRequest<{
    rows: { id: string; width: number; height: number; bytes: number }[];
    total: number;
  }>(s, `/assets?page=${page}`, { signal });
export const listSections = (s: PortalScope, signal?: AbortSignal) =>
  portalRequest<SavedSection[]>(s, "/sections", { signal });
export const saveSection = (
  s: PortalScope,
  input: {
    name: string;
    documentType: DocumentType;
    nodes: PortalDesign["nodes"];
    resources: PortalDesign["resources"];
    customBlocks: PortalDesign["customBlocks"];
  },
  signal?: AbortSignal,
) => portalRequest<SavedSection>(s, "/sections", write(input, "POST", signal));
export const validatePortalCode = (
  s: PortalScope,
  key: string,
  input: {
    blockId: string;
    block: PortalDesign["customBlocks"][string];
    resources: PortalDesign["resources"];
  },
  signal?: AbortSignal,
) =>
  portalRequest<{
    diagnostics: import("@/components/customer-pages/types").Diagnostic[];
  }>(s, `/${id(key)}/code-validate`, write(input, "POST", signal));
export const compilePortalPageSource = (
  s: PortalScope,
  key: string,
  input: { design: PortalDesign; html: string; css: string },
  signal?: AbortSignal,
) => portalRequest<{ design: PortalDesign; diagnostics: import("@/components/customer-pages/types").Diagnostic[] }>(
  s, `/${id(key)}/source-compile`, write(input, "POST", signal),
);
export const previewPortalCode = (
  s: PortalScope,
  r: DraftRecord,
  blockId: string,
  signal?: AbortSignal,
) =>
  portalRequest<
    import("@/components/customer-pages/CustomVisualFrame").VisualArtifact
  >(
    s,
    `/${id(r.id)}/code-preview`,
    write({ blockId, expectedRevision: r.revision }, "POST", signal),
  );
export const setCodePolicy = (
  s: PortalScope,
  enabled: boolean,
  expectedRevision: number,
  signal?: AbortSignal,
) =>
  portalRequest<{ enabled: boolean; revision: number }>(
    s,
    "/code-policy",
    write({ enabled, expectedRevision }, "PUT", signal),
  );
export async function uploadPortalImage(
  s: PortalScope,
  r: DraftRecord,
  file: File,
  signal?: AbortSignal,
) {
  assertPortalScope(s, signal);
  const body = new FormData();
  body.set("templateId", r.id);
  body.set("expectedRevision", String(r.revision));
  body.set("image", file);
  const response = await fetch(
    getApiBaseUrl() + "/settings/customer-pages/assets",
    {
      method: "POST",
      credentials: "include",
      body,
      signal,
      headers: {
        "X-Company-Id": s.companyId,
        ...(s.branchId ? { "X-Branch-Id": s.branchId } : {}),
      },
    },
  );
  assertPortalScope(s, signal);
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.message || "No se pudo cargar la imagen",
      response.status,
    );
  return result as {
    id: string;
    revision: number;
    width: number;
    height: number;
  };
}
export async function fetchPortalAsset(
  s: PortalScope,
  key: string,
  signal?: AbortSignal,
) {
  assertPortalScope(s, signal);
  const response = await fetch(
    getApiBaseUrl() + "/settings/customer-pages/assets/" + id(key),
    {
      credentials: "include",
      cache: "no-store",
      signal,
      headers: {
        "X-Company-Id": s.companyId,
        ...(s.branchId ? { "X-Branch-Id": s.branchId } : {}),
      },
    },
  );
  assertPortalScope(s, signal);
  if (!response.ok) throw new ApiError("Imagen no disponible", response.status);
  const blob = await response.blob();
  assertPortalScope(s, signal);
  if (blob.type !== "image/png" || blob.size > 25 * 1024 * 1024)
    throw Error("Imagen no válida");
  return blob;
}
export function downloadDesign(json: string, filename = "pagina-auna.json") {
  const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
