import type { Diagnostic } from "@/components/customer-pages/types";
export function codeDiagnostics(error: unknown): Diagnostic[] {
  const e = error as {
    data?: { diagnostics?: Diagnostic[] };
    message?: string;
  };
  return Array.isArray(e.data?.diagnostics)
    ? e.data.diagnostics
    : [
        {
          path: "code",
          code: "CODE_CHECK_FAILED",
          message: e.message || "No se pudo validar el bloque",
          severity: "error",
        },
      ];
}
