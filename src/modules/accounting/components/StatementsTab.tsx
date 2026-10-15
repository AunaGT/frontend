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
import { MetricStrip } from '@/components/shared/MetricStrip'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'
import { Download, FileBarChart2, Landmark, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTenant } from '@/context/useTenant'
import {
  getIncomeStatement, getBalanceSheet, getResultsByBranch,
  type IncomeStatementResponse, type BalanceSheetResponse, type StatementRow,
  type BranchResultsResponse,
} from '@/services/accountingService'
import { fmtQ, todayISO , rangoTexto } from './format'
import { exportStatements } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'

const firstOfYearISO = () => `${new Date().getFullYear()}-01-01`

const RowList = ({ rows }: { rows: StatementRow[] }) => (
  <>
    {rows.map((r) => (
      <div key={r.code} className="accounting-statement-row text-sm">
        <span className="text-muted-foreground">{r.code} — {r.name}</span>
        <span>{fmtQ(r.amount)}</span>
      </div>
    ))}
    {rows.length === 0 && <p className="text-sm text-muted-foreground py-1">Sin movimientos</p>}
  </>
)

const SubtotalRow = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className={`accounting-statement-row text-sm font-semibold border-t mt-1 ${accent ? (value >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300') : ''}`}>
    <span>{label}</span>
    <span>{fmtQ(value)}</span>
  </div>
)

export const StatementsTab = () => {
  const { toast } = useToast()
  const { branches, company } = useTenant()
  // '' = toda la empresa · 'company' = solo asientos sin sucursal
  const [branchFilter, setBranchFilter] = useState('')
  const [byBranch, setByBranch] = useState<BranchResultsResponse | null>(null)
  const [from, setFrom] = useState(firstOfYearISO())
  const [to, setTo] = useState(todayISO())
  const [asOf, setAsOf] = useState(todayISO())
  const [exportOpen, setExportOpen] = useState(false)
  const [pnl, setPnl] = useState<IncomeStatementResponse | null>(null)
  const [bs, setBs] = useState<BalanceSheetResponse | null>(null)
  const [loadingPnl, setLoadingPnl] = useState(true)
  const [loadingBs, setLoadingBs] = useState(true)
  const [retry, setRetry] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingPnl(true)
    getIncomeStatement({ from: from || undefined, to: to || undefined, branch_id: branchFilter || undefined })
      .then((res) => { if (active) setPnl(res) })
      .catch((e) => {
        if (active) setPnl(null)
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el estado de resultados', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoadingPnl(false) })
    return () => { active = false }
  }, [from, to, branchFilter, toast, retry])

  useEffect(() => {
    let active = true
    setByBranch(null)
    getResultsByBranch({ from: from || undefined, to: to || undefined })
      .then((res) => { if (active) setByBranch(res) })
      .catch(() => { /* el desglose es complementario: no interrumpe la pantalla */ })
    return () => { active = false }
  }, [from, to, retry])

  useEffect(() => {
    let active = true
    setLoadingBs(true)
    getBalanceSheet(asOf || undefined)
      .then((res) => { if (active) setBs(res) })
      .catch((e) => {
        if (active) setBs(null)
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el balance general', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoadingBs(false) })
    return () => { active = false }
  }, [asOf, toast, retry])

  return (
    <div className="space-y-5">
      <MetricStrip label="Resumen de estados financieros" loading={loadingPnl || loadingBs} items={[
        { label: 'Total activo', value: bs ? fmtQ(bs.totalAssets) : '—', hint: `Al ${asOf || 'hoy'} · Toda la empresa` },
        { label: 'Total pasivo', value: bs ? fmtQ(bs.totalLiabilities) : '—', hint: `Al ${asOf || 'hoy'} · Toda la empresa` },
        { label: 'Capital', value: bs ? fmtQ(bs.totalEquity) : '—', hint: `Al ${asOf || 'hoy'} · Toda la empresa` },
        { label: 'Resultado del período', value: pnl ? fmtQ(pnl.netIncome) : '—', hint: rangoTexto(from, to), alert: Boolean(pnl && pnl.netIncome < 0) },
      ]} />
          <CompactFilterPanel title="Filtros de resultados" search={<p className="py-2 text-sm text-muted-foreground">{rangoTexto(from, to)}</p>} actions={<Button variant="outline" disabled={!pnl || !bs || loadingPnl || loadingBs || exporting} onClick={() => setExportOpen(true)}><Download className="h-4 w-4 mr-2" />Exportar</Button>} activeCount={Number(from !== firstOfYearISO())+Number(to !== todayISO())+Number(Boolean(branchFilter))} onClear={() => {setFrom(firstOfYearISO());setTo(todayISO());setBranchFilter('');}} appliedFilters={[...(from !== firstOfYearISO() ? [{label: `Desde: ${from || 'Sin límite'}`,onRemove: () => setFrom(firstOfYearISO())}] : []),...(to !== todayISO() ? [{label: `Hasta: ${to || 'Sin límite'}`,onRemove: () => setTo(todayISO())}] : []),...(branchFilter ? [{label: `Sucursal: ${branchFilter === 'company' ? 'Solo empresa' : branches.find(b => b.id === branchFilter)?.name || 'Seleccionada'}`,onRemove: () => setBranchFilter('')}] : [])]}>
          <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" className="w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" className="w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          {branches.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Sucursal</Label>
                <Select value={branchFilter || 'all'} onValueChange={(v) => setBranchFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="Toda la empresa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toda la empresa</SelectItem>
                    <SelectItem value="company">Solo empresa</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
        </CompactFilterPanel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Estado de Resultados */}
      <Card className="auna-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileBarChart2 className="h-5 w-5" />Estado de Resultados
          </CardTitle>
          <CardDescription>Ingresos, costos y gastos del período (sin asientos de cierre).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Período: {rangoTexto(from, to)}</p>
          {loadingPnl ? (
            <LoadingState variant="detail" className="auna-loading-embedded" message="Cargando estado financiero…" />
          ) : pnl && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Ingresos</h4>
                <RowList rows={pnl.income} />
                <SubtotalRow label="Total ingresos" value={pnl.totalIncome} />
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">(−) Costos</h4>
                <RowList rows={pnl.costs} />
                <SubtotalRow label="Total costos" value={pnl.totalCosts} />
              </div>
              <SubtotalRow label="= Utilidad bruta" value={pnl.grossProfit} accent />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">(−) Gastos</h4>
                <RowList rows={pnl.expenses} />
                <SubtotalRow label="Total gastos" value={pnl.totalExpenses} />
              </div>
              <div className="border-t-2 pt-2">
                <SubtotalRow label="= Utilidad neta del período" value={pnl.netIncome} accent />
              </div>
            </div>
          )}
          {!loadingPnl && !pnl && <div role="alert" className="py-6"><p>No se pudo cargar el estado de resultados.</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Reintentar</Button></div>}
        </CardContent>
      </Card>

      {/* Balance General */}
      <Card className="auna-surface">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Landmark className="h-5 w-5" />Balance General
              </CardTitle>
              <CardDescription>Posición financiera de toda la empresa a la fecha indicada; no se filtra por sucursal.</CardDescription>
            </div>
            {bs && !loadingBs && (
              <Badge variant={bs.balanced ? 'default' : 'destructive'}>
                {bs.balanced ? 'Cuadrado' : 'Descuadrado'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 w-[170px]">
            <Label className="text-xs">Al</Label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          {loadingBs ? (
            <LoadingState variant="detail" className="auna-loading-embedded" message="Cargando estado financiero…" />
          ) : bs && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Activo</h4>
                <RowList rows={bs.assets} />
                <SubtotalRow label="Total activo" value={bs.totalAssets} />
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pasivo</h4>
                <RowList rows={bs.liabilities} />
                <SubtotalRow label="Total pasivo" value={bs.totalLiabilities} />
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Capital</h4>
                <RowList rows={bs.equity} />
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">Resultado del ejercicio (no cerrado)</span>
                  <span className={bs.currentResult >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{fmtQ(bs.currentResult)}</span>
                </div>
                <SubtotalRow label="Total capital" value={bs.totalEquity} />
              </div>
              <div className="border-t-2 pt-2">
                <SubtotalRow label="Pasivo + Capital" value={bs.totalLiabilities + bs.totalEquity} />
              </div>
            </div>
          )}
          {!loadingBs && !bs && <div role="alert" className="py-6"><p>No se pudo cargar el balance general.</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Reintentar</Button></div>}
        </CardContent>
      </Card>
      </div>

      {/* Resultado por sucursal: mismo período que el estado de resultados */}
      {byBranch && byBranch.branches.length > 1 && (
        <Card className="auna-surface">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5" />Resultado por sucursal
            </CardTitle>
            <CardDescription>
              Cada sucursal es un centro de costo; la suma es el resultado de la empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="auna-data-table-shell auna-table-embedded overflow-x-auto">
              <table className="auna-data-table">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3 font-medium">Sucursal</th>
                    <th className="text-right py-2 px-3 font-medium">Ingresos</th>
                    <th className="text-right py-2 px-3 font-medium">Costos</th>
                    <th className="text-right py-2 px-3 font-medium">Gastos</th>
                    <th className="text-right py-2 pl-3 font-medium">Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {byBranch.branches.map((b) => (
                    <tr key={b.branch_id ?? 'company'} className="border-b last:border-0">
                      <td className="py-2 pr-3">{b.name}</td>
                      <td className="py-2 px-3 text-right">{fmtQ(b.income)}</td>
                      <td className="py-2 px-3 text-right">{fmtQ(b.costs)}</td>
                      <td className="py-2 px-3 text-right">{fmtQ(b.expenses)}</td>
                      <td className={`py-2 pl-3 text-right font-medium ${b.netIncome >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {fmtQ(b.netIncome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2 pr-3">Total empresa</td>
                    <td className="py-2 px-3 text-right">{fmtQ(byBranch.totals.income)}</td>
                    <td className="py-2 px-3 text-right">{fmtQ(byBranch.totals.costs)}</td>
                    <td className="py-2 px-3 text-right">{fmtQ(byBranch.totals.expenses)}</td>
                    <td className="py-2 pl-3 text-right">{fmtQ(byBranch.totals.netIncome)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar estados financieros"
        fileName="estados-financieros"
        summary={`Estado de resultados ${rangoTexto(from, to).toLowerCase()} y balance general al ${asOf || 'día de hoy'}. Salen los dos en el mismo archivo.`}
        formats={['xlsx']}
        pending={exporting}
        onExport={async ({ fileName }) => {
          if (!pnl || !bs || loadingPnl || loadingBs || exporting) return
          setExporting(true)
          try {
            await exportStatements(pnl, bs, { from: from || undefined, to: to || undefined, asOf: asOf || undefined }, fileName, { companyName: company?.name || 'Empresa', scopeLabel: branchFilter === 'company' ? 'Solo empresa' : branches.find(branch => branch.id === branchFilter)?.name || 'Toda la empresa' })
            setExportOpen(false)
          } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo exportar', variant: 'destructive' })
          } finally { setExporting(false) }
        }}
      />
    </div>
  )
}
