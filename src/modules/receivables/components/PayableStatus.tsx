import { Badge } from "@/components/ui/badge";
import type { PayableEntry } from "../api/payablesTypes";
export function PayableStatus({ row }: { row: PayableEntry }) {
  return (
    <Badge
      variant="outline"
      className={
        row.status === "REVIEW" || row.overdue
          ? "text-destructive"
          : row.status === "PAID"
            ? "text-emerald-700 dark:text-emerald-300"
            : ""
      }
    >
      {row.status === "REVIEW"
        ? "Revisar saldo"
        : row.overdue
          ? "Vencido"
          : { PAID: "Pagado", PARTIAL: "Parcial", PENDING: "Pendiente" }[
              row.status
            ]}
    </Badge>
  );
}
