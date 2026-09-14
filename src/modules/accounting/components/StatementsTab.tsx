/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
      <div key={r.code} className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground">{r.code} — {r.name}</span>
        <span>{fmtQ(r.amount)}</span>
      </div>
    ))}
    {rows.length === 0 && <p className="text-sm text-muted-foreground py-1">Sin movimientos</p>}
  </>
)

const SubtotalRow = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className={`flex justify-between text-sm font-semibold border-t pt-1.5 mt-1 ${accent ? (value >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
    <span>{label}</span>
    <span>{fmtQ(value)}</span>
  </div>
)

export const StatementsTab = () => {
  const { toast } = useToast()
  const { branches } = useTenant()
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

  useEffect(() => {
    let active = true
    setLoadingPnl(true)
    getIncomeStatement({ from: from || undefined, to: to || undefined, branch_id: branchFilter || undefined })
      .then((res) => { if (active) setPnl(res) })
      .catch((e) => {
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el estado de resultados', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoadingPnl(false) })
    return () => { active = false }
  }, [from, to, branchFilter, toast])

  useEffect(() => {
    let active = true
    getResultsByBranch({ from: from || undefined, to: to || undefined })
      .then((res) => { if (active) setByBranch(res) })
      .catch(() => { /* el desglose es complementario: no interrumpe la pantalla */ })
    return () => { active = false }
  }, [from, to])

  useEffect(() => {
    let active = true
    setLoadingBs(true)
    getBalanceSheet(asOf || undefined)
      .then((res) => { if (active) setBs(res) })
      .catch((e) => {
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el balance general', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoadingBs(false) })
    return () => { active = false }
  }, [asOf, toast])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline" size="sm"
          disabled={!pnl || !bs || loadingPnl || loadingBs}
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4 mr-2" />Exportar
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Estado de Resultados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileBarChart2 className="h-5 w-5" />Estado de Resultados
          </CardTitle>
          <CardDescription>Ingresos, costos y gastos del período (sin asientos de cierre).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {branches.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Sucursal</Label>
                <Select value={branchFilter || 'all'} onValueChange={(v) => setBranchFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Toda la empresa" /></SelectTrigger>
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
          </div>
          {loadingPnl ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
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
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <SubtotalRow label="= Utilidad neta del período" value={pnl.netIncome} accent />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance General */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Landmark className="h-5 w-5" />Balance General
              </CardTitle>
              <CardDescription>Posición financiera a la fecha indicada.</CardDescription>
            </div>
            {bs && (
              <Badge variant={bs.balanced ? 'default' : 'destructive'}>
                {bs.balanced ? 'Cuadrado' : 'Descuadrado'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 w-[170px]">
            <Label className="text-xs">Al</Label>
            <Input type="date" className="h-9" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          {loadingBs ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
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
                  <span className={bs.currentResult >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtQ(bs.currentResult)}</span>
                </div>
                <SubtotalRow label="Total capital" value={bs.totalEquity} />
              </div>
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <SubtotalRow label="Pasivo + Capital" value={bs.totalLiabilities + bs.totalEquity} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Resultado por sucursal: mismo período que el estado de resultados */}
      {byBranch && byBranch.branches.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5" />Resultado por sucursal
            </CardTitle>
            <CardDescription>
              Cada sucursal es un centro de costo; la suma es el resultado de la empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                      <td className={`py-2 pl-3 text-right font-medium ${b.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
        summary={`Estado de resultados ${rangoTexto(from, to).toLowerCase()} y balance general al ${asOf || 'día de hoy'}. Salen los dos en el mismo archivo.`}
        formats={['xlsx']}
        onExport={() => {
          if (pnl && bs) {
            exportStatements(pnl, bs, { from: from || undefined, to: to || undefined, asOf: asOf || undefined })
          }
          setExportOpen(false)
        }}
      />
    </div>
  )
}
