export type CarteraAccess = { receivable: boolean; payable: boolean };
export function carteraAccess(
  permissions: ReadonlySet<string>,
  modules: ReadonlySet<string> | null,
): CarteraAccess {
  const common = !!modules?.has("receivables") && modules.has("contacts");
  return {
    receivable:
      common && modules!.has("sales") && permissions.has("receivables.view"),
    payable:
      common &&
      modules!.has("merchandise") &&
      permissions.has("merchandise.details"),
  };
}
export function permittedSelection(
  requested: string | null,
  access: CarteraAccess,
): "cobrar" | "pagar" | null {
  if (requested === "pagar" && access.payable) return "pagar";
  if (requested === "cobrar" && access.receivable) return "cobrar";
  return access.receivable ? "cobrar" : access.payable ? "pagar" : null;
}
