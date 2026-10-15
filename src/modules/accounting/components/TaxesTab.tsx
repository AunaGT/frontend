/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Reporte de impuestos por mes (apoyo para la declaración SAT).
 * Régimen general: IVA débito de ventas vs. IVA crédito de compras.
 * Pequeño contribuyente: tarifa fija sobre ventas brutas.
 */

import { useEffect, useState } from 'react'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getTaxesReport, type TaxesReportResponse } from '@/services/accountingService'
import { fmtQ, MONTH_LABELS } from './format'
import { exportTaxes } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { useTenant } from '@/context/useTenant'

const cell = (v: number) => (v !== 0 ? fmtQ(v) : '')

export const TaxesTab = () => {
  const { toast } = useToast()
  const { company } = useTenant()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<TaxesReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [retry, setRetry] = useState(0)
  const [exporting, setExporting] = useState(false)

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  useEffect(() => {
    let active = true
    setLoading(true)
    getTaxesReport(year)
      .then((res) => { if (active) setData(res) })
      .catch((e) => {
        if (active) setData(null)
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el reporte de impuestos', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [year, toast, retry])

  const pequeno = data?.regime === 'PEQUENO'
  const hasMovements = data ? data.months.some((m) => m.netSales !== 0 || m.toPay !== 0) : false

  const summary = data ? (pequeno
    ? [
        { label: 'Ventas netas del año', value: data.totals.netSales },
        { label: `IVA pequeño contribuyente (${Math.round(data.pequenoRate * 100)}%)`, value: data.totals.pequenoTax },
        { label: 'Total a pagar en el año', value: data.totals.toPay },
      ]
    : [
        { label: 'IVA débito (ventas)', value: data.totals.ivaDebit },
        { label: 'IVA crédito (compras)', value: data.totals.ivaCredit },
        { label: data.totals.toPay >= 0 ? 'IVA a pagar en el año' : 'IVA a favor en el año', value: Math.abs(data.totals.toPay) },
      ]) : []

  return (
    <section className="space-y-5" aria-label="Impuestos (IVA)">
      <MetricStrip label="Resumen anual de impuestos" loading={loading} items={summary.length ? summary.map(s => ({ ...s, value: fmtQ(s.value) })) : ['IVA débito (ventas)', 'IVA crédito (compras)', 'IVA a pagar en el año'].map(label => ({ label, value: '—' }))} />
        <div className="auna-page-toolbar">
          <div className="space-y-1 w-[140px]">
            <Label className="text-xs">Año</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {data && !loading && <Badge variant="outline">{pequeno ? `Pequeño contribuyente · ${Math.round(data.pequenoRate * 100)}%` : `Régimen general · IVA ${Math.round(data.ivaRate * 100)}%`}</Badge>}
          <Button className="sm:ml-auto" variant="outline" disabled={!data || !hasMovements || loading || exporting} onClick={() => setExportOpen(true)}><Download className="h-4 w-4 mr-2" />Exportar</Button>
        </div>
        <p className="text-xs text-muted-foreground">Calculado sobre los asientos automáticos de ventas, devoluciones y compras. El régimen y las tasas se cambian en Configuración.</p>

        {loading ? (
          <LoadingState variant="detail" message="Cargando impuestos…" />
        ) : !data ? (
          <div role="alert" className="py-8 text-center"><p>No se pudo cargar el reporte.</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Reintentar</Button></div>
        ) : !hasMovements ? (
          <p className="py-10 text-center text-muted-foreground">Sin operaciones contabilizadas en {year}.</p>
        ) : (
          <>
            <div className="auna-data-table-shell overflow-x-auto">
              <table className="auna-data-table">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-left font-medium px-3 py-2">Mes</th>
                    <th className="text-right font-medium px-3 py-2">Ventas netas</th>
                    {pequeno ? (
                      <th className="text-right font-medium px-3 py-2">IVA {Math.round(data.pequenoRate * 100)}% sobre ventas</th>
                    ) : (
                      <>
                        <th className="text-right font-medium px-3 py-2">IVA débito (ventas)</th>
                        <th className="text-right font-medium px-3 py-2">IVA crédito (compras)</th>
                      </>
                    )}
                    <th className="text-right font-medium px-3 py-2">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{MONTH_LABELS[m.month - 1]}</td>
                      <td className="px-3 py-2 text-right">{cell(m.netSales)}</td>
                      {pequeno ? (
                        <td className="px-3 py-2 text-right">{cell(m.pequenoTax)}</td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right">{cell(m.ivaDebit)}</td>
                          <td className="px-3 py-2 text-right">{cell(m.ivaCredit)}</td>
                        </>
                      )}
                      <td className={`px-3 py-2 text-right font-medium ${m.toPay < 0 ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                        {m.toPay !== 0 ? fmtQ(m.toPay) : ''}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/40 font-semibold">
                    <td className="px-3 py-2">Totales</td>
                    <td className="px-3 py-2 text-right">{fmtQ(data.totals.netSales)}</td>
                    {pequeno ? (
                      <td className="px-3 py-2 text-right">{fmtQ(data.totals.pequenoTax)}</td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right">{fmtQ(data.totals.ivaDebit)}</td>
                        <td className="px-3 py-2 text-right">{fmtQ(data.totals.ivaCredit)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right">{fmtQ(data.totals.toPay)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar reporte de impuestos"
        fileName={`impuestos-${year}`}
        summary={`Año ${year}, mes por mes.`}
        formats={['xlsx']}
        pending={exporting}
        onExport={async ({ fileName }) => {
          if (!data || loading || exporting) return
          setExporting(true)
          try {
            await exportTaxes(data, fileName, { companyName: company?.name || 'Empresa' })
            setExportOpen(false)
          } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo exportar', variant: 'destructive' })
          } finally { setExporting(false) }
        }}
      />
    </section>
  )
}
