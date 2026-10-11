/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { useEffect, useState } from 'react'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getTrialBalance, type TrialBalanceResponse } from '@/services/accountingService'
import { fmtQ, TYPE_LABELS, todayISO , rangoTexto } from './format'
import { exportTrialBalance } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'

const firstOfMonthISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export const TrialBalanceTab = () => {
  const { toast } = useToast()
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState<TrialBalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    getTrialBalance({ from: from || undefined, to: to || undefined })
      .then((res) => { if (active) setData(res) })
      .catch((e) => {
        if (active) { setLoadError(true); setData(null) }
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar la balanza', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, to, toast, retry])

  const squared = data ? data.totals.debit === data.totals.credit : false

  return (
    <section className="space-y-5" aria-label="Balanza de comprobación">
      <MetricStrip label="Resumen de balanza" loading={loading} items={[
        { label: 'Cuentas con movimientos', value: data ? data.rows.length : '—' },
        { label: 'Debe del período', value: data ? fmtQ(data.totals.debit) : '—' },
        { label: 'Haber del período', value: data ? fmtQ(data.totals.credit) : '—' },
        { label: 'Diferencia', value: data ? fmtQ(data.totals.debit - data.totals.credit) : '—', alert: Boolean(data && !squared) },
      ]} />
      <CompactFilterPanel title="Filtros de balanza" search={<div className="flex flex-wrap items-center gap-2 py-2"><span className="text-sm text-muted-foreground">Período: {rangoTexto(from, to)}</span>{data && !loading && <Badge variant={squared ? 'outline' : 'destructive'}>{squared ? 'Cuadrada' : 'Descuadrada'}</Badge>}</div>} actions={<Button
              variant="outline" size="sm"
              disabled={!data || data.rows.length === 0 || loading}
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-4 w-4 mr-2" />Exportar
            </Button>} activeCount={Number(from !== firstOfMonthISO())+Number(to !== todayISO())} onClear={() => {setFrom(firstOfMonthISO());setTo(todayISO());}} appliedFilters={[...(from !== firstOfMonthISO() ? [{label: `Desde: ${from || 'Sin límite'}`,onRemove: () => setFrom(firstOfMonthISO())}] : []),...(to !== todayISO() ? [{label: `Hasta: ${to || 'Sin límite'}`,onRemove: () => setTo(todayISO())}] : [])]}>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" className="w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" className="w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CompactFilterPanel>

        {loading ? (
          <LoadingState message="Cargando balance…" columns={['Código', 'Cuenta', 'Tipo', 'Saldo inicial', 'Debe', 'Haber', 'Saldo final']} />
        ) : loadError ? (
          <div role="alert" className="py-8 text-center"><p>No se pudo cargar la balanza.</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Reintentar</Button></div>
        ) : !data || data.rows.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Sin movimientos en el rango seleccionado.</p>
        ) : (
          <div className="auna-data-table-shell overflow-x-auto">
            <table className="auna-data-table">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Código</th>
                  <th className="text-left font-medium px-3 py-2">Cuenta</th>
                  <th className="text-left font-medium px-3 py-2">Tipo</th>
                  <th className="text-right font-medium px-3 py-2">Saldo inicial</th>
                  <th className="text-right font-medium px-3 py-2">Debe</th>
                  <th className="text-right font-medium px-3 py-2">Haber</th>
                  <th className="text-right font-medium px-3 py-2">Saldo final</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.account_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{row.code}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{TYPE_LABELS[row.type]}</Badge></td>
                    <td className="px-3 py-2 text-right">{fmtQ(row.initialBalance)}</td>
                    <td className="px-3 py-2 text-right">{row.debit > 0 ? fmtQ(row.debit) : ''}</td>
                    <td className="px-3 py-2 text-right">{row.credit > 0 ? fmtQ(row.credit) : ''}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtQ(row.finalBalance)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/40 font-semibold">
                  <td colSpan={4} className="px-3 py-2">Totales del período</td>
                  <td className="px-3 py-2 text-right">{fmtQ(data.totals.debit)}</td>
                  <td className="px-3 py-2 text-right">{fmtQ(data.totals.credit)}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar balanza de comprobación"
        fileName="balanza-comprobacion"
        summary={`${rangoTexto(from, to)} (${data?.rows.length ?? 0} cuenta(s)).`}
        formats={['xlsx']}
        onExport={({ fileName }) => {
          if (data) exportTrialBalance(data, { from: from || undefined, to: to || undefined }, fileName)
          setExportOpen(false)
        }}
      />
    </section>
  )
}
