import type { PayableEntry } from "./api/payablesTypes";
export function togglePayableSelection(
  rows: PayableEntry[],
  row: PayableEntry,
): PayableEntry[] {
  if (rows.some((r) => r.id === row.id))
    return rows.filter((r) => r.id !== row.id);
  if (row.balance === null || row.status === "REVIEW")
    throw Error("Esta entrada requiere revisión del saldo histórico");
  if (row.excluded || Number(row.balance) <= 0)
    throw Error("Esta entrada no tiene saldo por pagar");
  if (rows.length >= 100) throw Error("Puedes seleccionar hasta 100 entradas");
  if (
    rows.some(
      (r) => r.supplierId !== row.supplierId || r.branchId !== row.branchId,
    )
  )
    throw Error("Selecciona entradas del mismo proveedor y sucursal");
  return [...rows, row];
}
