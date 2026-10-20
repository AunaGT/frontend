import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { PayableStatus } from "./PayableStatus";
import type { PayableEntry } from "../api/payablesTypes";
export function usePayableFormat() {
  const { currencyCode, locale, timezone } = useSystemSettings();
  return {
    money: (value: string | number) =>
      new Intl.NumberFormat(locale || "es-GT", {
        style: "currency",
        currency: currencyCode || "GTQ",
      }).format(Number(value)),
    date: (value: string | null) =>
      value
        ? new Date(
            value.length === 10 ? value + "T12:00:00Z" : value,
          ).toLocaleDateString(locale || "es-GT", {
            timeZone: value.length === 10 ? "UTC" : timezone,
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Sin fecha",
  };
}
export function PayableEntries({
  rows,
  selected = [],
  onSelect,
  filtered = false,
  onReset,
}: {
  rows: PayableEntry[];
  filtered?: boolean;
  onReset?: () => void;
  selected?: PayableEntry[];
  onSelect?: (row: PayableEntry) => void;
}) {
  const navigate = useNavigate(),
    { money, date } = usePayableFormat();
  return (
    <Table className="min-w-[1000px]">
      <TableHeader>
        <TableRow>
          {onSelect && <TableHead className="w-10">Selección</TableHead>}
          {[
            "Entrada",
            "Proveedor / sucursal",
            "Emisión",
            "Vencimiento",
            "Total",
            "Abonos",
            "Liquidación histórica",
            "Saldo",
            "Estado",
            "Acciones",
          ].map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {!rows.length ? (
          <TableRow>
            <TableCell
              colSpan={onSelect ? 11 : 10}
              className="text-center text-muted-foreground"
            >
              <CollectionEmptyState compact filtered={filtered} onReset={onReset} title="Las compras tendrán su lugar aquí" description="Aquí aparecerán las entradas del proveedor que correspondan a esta consulta." />
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              {onSelect && (
                <TableCell>
                  <Checkbox
                    aria-label={"Seleccionar entrada " + r.reference}
                    checked={selected.some((s) => s.id === r.id)}
                    disabled={
                      r.balance === null || Number(r.balance) <= 0 || r.excluded
                    }
                    onCheckedChange={() => onSelect(r)}
                  />
                </TableCell>
              )}
              <TableCell>
                <button
                  className="font-semibold text-brand-orange hover:underline"
                  onClick={() => navigate("/mercancia/" + r.id)}
                >
                  {r.reference}
                </button>
              </TableCell>
              <TableCell>
                <button
                  className="text-left font-medium hover:underline"
                  onClick={() =>
                    navigate("/cartera/proveedores/" + r.supplierId)
                  }
                >
                  {r.supplierName}
                </button>
                <small className="block text-muted-foreground">
                  {r.branchName}
                </small>
              </TableCell>
              <TableCell>{date(r.date)}</TableCell>
              <TableCell>
                {date(r.dueDate)}
                {r.overdue && (
                  <small className="block text-destructive">
                    {r.overdueDays} días de atraso
                  </small>
                )}
              </TableCell>
              <TableCell>{money(r.total)}</TableCell>
              <TableCell>{money(r.documentedPaid)}</TableCell>
              <TableCell>{money(r.legacySettled)}</TableCell>
              <TableCell className="font-semibold">
                {r.balance === null ? "Por revisar" : money(r.balance)}
              </TableCell>
              <TableCell>
                <PayableStatus row={r} />
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={"Ver entrada " + r.reference}
                  onClick={() => navigate("/mercancia/" + r.id)}
                >
                  <Eye size={16} />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
