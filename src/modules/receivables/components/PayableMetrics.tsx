import { MetricStrip } from "@/components/shared/MetricStrip";
import type { PayableSummary } from "../api/payablesTypes";
export function PayableMetrics({
  data,
  loading,
  money,
}: {
  data?: PayableSummary;
  loading?: boolean;
  money: (value: string) => string;
}) {
  return (
    <>
      <MetricStrip
        loading={loading}
        items={[
          {
            label: "Saldo por pagar",
            value: data ? money(data.pending) : "—",
            hint:
              data && !data.complete
                ? "No incluye saldos en revisión"
                : undefined,
          },
          {
            label: "Vencido",
            value: data ? money(data.overdue) : "—",
            alert: !!data && Number(data.overdue) > 0,
          },
          {
            label: "Próximos 30 días",
            value: data ? money(data.upcoming30Days) : "—",
          },
          { label: "Proveedores con saldo", value: data?.supplierCount ?? "—" },
          {
            label: "Requieren revisión",
            value: data?.reviewCount ?? "—",
            alert: !!data?.reviewCount,
          },
        ]}
      />
      {data && !data.complete && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          Hay registros históricos que requieren revisión. Sus saldos
          desconocidos no se incluyen en los totales.
        </p>
      )}
    </>
  );
}
