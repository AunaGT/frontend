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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Download, Percent } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getTaxesReport, type TaxesReportResponse } from '@/services/accountingService'
import { fmtQ, MONTH_LABELS } from './format'
import { exportTaxes } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'

const cell = (v: number) => (v !== 0 ? fmtQ(v) : '')

export const TaxesTab = () => {
  const { toast } = useToast()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<TaxesReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  useEffect(() => {
    let active = true
    setLoading(true)
    getTaxesReport(year)
      .then((res) => { if (active) setData(res) })
      .catch((e) => {
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el reporte de impuestos', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [year, toast])

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-5 w-5" />Impuestos (IVA)
          </CardTitle>
          <div className="flex items-center gap-2">
            {data && (
              <Badge variant="outline">
                {pequeno
                  ? `Pequeño contribuyente · ${Math.round(data.pequenoRate * 100)}%`
                  : `Régimen general · IVA ${Math.round(data.ivaRate * 100)}%`}
              </Badge>
            )}
            <Button
              variant="outline" size="sm"
              disabled={!data || !hasMovements || loading}
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-4 w-4 mr-2" />Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-[140px]">
            <Label className="text-xs">Año</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            Calculado sobre los asientos automáticos de ventas, devoluciones y compras. El régimen y las tasas se cambian en Configuración.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !data ? (
          <p className="py-10 text-center text-muted-foreground">No se pudo cargar el reporte.</p>
        ) : !hasMovements ? (
          <p className="py-10 text-center text-muted-foreground">Sin operaciones contabilizadas en {year}.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summary.map((s) => (
                <div key={s.label} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-semibold">{fmtQ(s.value)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
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
                      <td className={`px-3 py-2 text-right font-medium ${m.toPay < 0 ? 'text-green-600' : ''}`}>
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
      </CardContent>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar reporte de impuestos"
        summary={`Año ${year}, mes por mes.`}
        formats={['xlsx']}
        onExport={() => {
          if (data) exportTaxes(data)
          setExportOpen(false)
        }}
      />
    </Card>
  )
}
