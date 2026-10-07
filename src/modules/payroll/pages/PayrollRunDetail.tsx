import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
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
 * Detalle de una corrida: sus recibos y los botones de transición. Cada botón
 * se muestra solo si el estado lo permite y el usuario tiene el permiso, y se
 * deshabilita mientras la mutación corre — sin recargas manuales.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Eye, ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  cancelPayrollRun, confirmPayrollRun, fetchPayrollRun, payPayrollRun, recalculatePayrollRun,
  PAYROLL_STATUS_LABELS, PAYROLL_TYPE_LABELS,
  type Payslip,
} from '../api/payrollService'
import PayslipCard from './PayslipCard'
import { filterPayslips, pageItems } from './payrollView.mjs'
import './payrollPrint.css'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

export const PayrollRunDetail = () => {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Payslip | null>(null)
  const printReceipt = () => {
    const cleanup = () => document.body.classList.remove('payroll-printing')
    document.body.classList.add('payroll-printing')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  const { data: run, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['payroll-runs', id],
    queryFn: () => fetchPayrollRun(id),
    enabled: Boolean(id),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payroll-runs'] })
    qc.invalidateQueries({ queryKey: ['hr-advances'] })
    qc.invalidateQueries({ queryKey: ['accounting'] })
  }

  const transition = (fn: (runId: string) => Promise<unknown>, title: string) => ({
    mutationFn: () => fn(id),
    onSuccess: () => { invalidate(); toast({ title }) },
    onError: (e: Error) => {
      // Un 409 acá es normal: alguien más ya movió la planilla. Hay que refrescar
      // para que los botones reflejen el estado real y no invite a reintentar.
      invalidate()
      toast({ title: 'No se pudo completar', description: e.message, variant: 'destructive' })
    },
  })

  const recalc = useMutation(transition(() => recalculatePayrollRun(id), 'Planilla recalculada'))
  const confirm = useMutation(transition(confirmPayrollRun, 'Planilla confirmada'))
  const pay = useMutation(transition(payPayrollRun, 'Planilla pagada'))
  const cancel = useMutation(transition(cancelPayrollRun, 'Planilla anulada'))
  const busy = recalc.isPending || confirm.isPending || pay.isPending || cancel.isPending

  if (isLoading) {
    return <div className="space-y-4"><Link to="/nomina" className="text-sm text-muted-foreground">← Nómina</Link><h1 className="text-xl font-semibold">Detalle de planilla</h1><LoadingState variant="detail" message="Cargando planilla…" /></div>
  }
  if (isError || !run) return <div role="alert" className="space-y-3 p-6"><p>No se pudo cargar la nómina. {error instanceof Error ? error.message : ''}</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div>

  const slips = filterPayslips(run.payslips, search)
  const totalPages = Math.max(1, Math.ceil(slips.length / 10))
  const currentPage = Math.min(page, totalPages)

  return (
    <div className="mx-auto max-w-[1520px] space-y-5 p-4 md:p-6">
      {isFetching && <LoadingIndicator message="Actualizando planilla…" />}<h1 className="sr-only">Detalle de nómina</h1>
      <Card className="auna-surface border-border/70 bg-card/90"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{run.name}</h2><Badge variant="outline" className={run.status === 'PAGADA' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : run.status === 'ANULADA' ? 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300' : run.status === 'CONFIRMADA' ? 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300'}>{PAYROLL_STATUS_LABELS[run.status]}</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground"><span className="font-mono">{run.code}</span> · {PAYROLL_TYPE_LABELS[run.type]} · {run.period_start.slice(0, 10)} a {run.period_end.slice(0, 10)} · pago {run.pay_date.slice(0, 10)}{run.branch ? ` · ${run.branch.name}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {run.status === 'BORRADOR' && hasPermission('payroll.create') && (
            <Button variant="outline" disabled={busy} onClick={() => recalc.mutate()}>Recalcular</Button>
          )}
          {run.status === 'BORRADOR' && hasPermission('payroll.confirm') && (
            <Button className="bg-orange-600 text-white hover:bg-orange-700" disabled={busy} onClick={() => confirm.mutate()}>Confirmar nómina</Button>
          )}
          {run.status === 'CONFIRMADA' && hasPermission('payroll.pay') && (
            <Button disabled={busy} onClick={() => pay.mutate()}>Marcar pagada</Button>
          )}
          {(run.status === 'BORRADOR' || run.status === 'CONFIRMADA') && hasPermission('payroll.cancel') && (
            <Button variant="destructive" disabled={busy} onClick={() => { if (window.confirm('¿Anular esta nómina? Esta acción no se puede deshacer.')) cancel.mutate() }}>Anular</Button>
          )}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </CardContent></Card>

      <MetricStrip label="Resumen de nómina" items={[{label:'Empleados',value:run.payslips.length},{label:'Total bruto',value:money(run.total_earnings)},{label:'Deducciones',value:money(run.total_deductions)},{label:'Total neto',value:money(run.total_net)},{label:'Costo patronal',value:money(run.total_employer_cost)}]} />

      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Empleados ({run.payslips.length})</h2><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar empleados" placeholder="Buscar empleado, código o puesto..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div></div>
      <><Card className="auna-data-table-shell"><CardContent className="p-0"><div className="overflow-x-auto"><Table className="auna-data-table min-w-[900px]"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Empleado</TableHead><TableHead>Puesto</TableHead><TableHead className="text-right">Días</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Deducciones</TableHead><TableHead className="text-right">Neto</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>
        {pageItems(slips, currentPage, 10).map((slip, index) => <TableRow key={slip.id}><TableCell>{(currentPage - 1) * 10 + index + 1}</TableCell><TableCell><span className="font-medium">{slip.employee?.first_name} {slip.employee?.last_name}</span><span className="block text-xs text-muted-foreground">{slip.employee?.code ?? '—'}</span></TableCell><TableCell>{slip.employee?.position ?? '—'}</TableCell><TableCell className="text-right">{Number(slip.days_worked)}</TableCell><TableCell className="text-right tabular-nums">{money(slip.total_earnings)}</TableCell><TableCell className="text-right tabular-nums">{money(slip.total_deductions)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{money(slip.net_pay)}</TableCell><TableCell className="text-right"><Button size="icon" variant="outline" aria-label={`Ver recibo de ${slip.employee?.first_name} ${slip.employee?.last_name}`} onClick={() => setSelected(slip)}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>)}
        {!slips.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No hay empleados para esta búsqueda.</TableCell></TableRow>}
      </TableBody></Table></div></CardContent></Card>
<div className="auna-pagination-outside"><div className="auna-data-table-pagination"><span>Mostrando {slips.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, slips.length)} de {slips.length} empleados</span><nav aria-label="Paginación de empleados"><Button size="icon" variant="outline" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-9 text-center">{currentPage} / {totalPages}</span><Button size="icon" variant="outline" aria-label="Página siguiente" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button></nav></div></div></>
      {run.status === 'BORRADOR' && <p className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-foreground">Revisa los totales y los recibos individuales antes de confirmar la nómina.</p>}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}><DialogContent variant="auna" className="payroll-receipt max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Recibo de nómina · {run.code}</DialogTitle><DialogDescription className="sr-only">Recibo detallado de {selected?.employee?.first_name} {selected?.employee?.last_name}.</DialogDescription></DialogHeader><div className="flex justify-end print:hidden"><Button variant="outline" onClick={printReceipt}><Printer className="mr-2 h-4 w-4" />Imprimir recibo</Button></div>{selected && <PayslipCard payslip={selected} />}</DialogContent></Dialog>
    </div>
  )
}

export default PayrollRunDetail
