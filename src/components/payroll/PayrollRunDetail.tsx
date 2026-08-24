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
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  cancelPayrollRun, confirmPayrollRun, fetchPayrollRun, payPayrollRun, recalculatePayrollRun,
  PAYROLL_STATUS_LABELS, PAYROLL_TYPE_LABELS,
} from '@/services/payrollService'
import PayslipCard from './PayslipCard'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

export const PayrollRunDetail = () => {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()

  const { data: run, isLoading } = useQuery({
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

  if (isLoading || !run) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{run.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{run.code}</span> · {PAYROLL_TYPE_LABELS[run.type]} ·{' '}
            {run.period_start.slice(0, 10)} a {run.period_end.slice(0, 10)} · pago {run.pay_date.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{PAYROLL_STATUS_LABELS[run.status]}</Badge>
          {run.status === 'BORRADOR' && hasPermission('payroll.create') && (
            <Button variant="outline" disabled={busy} onClick={() => recalc.mutate()}>Recalcular</Button>
          )}
          {run.status === 'BORRADOR' && hasPermission('payroll.confirm') && (
            <Button disabled={busy} onClick={() => confirm.mutate()}>Confirmar</Button>
          )}
          {run.status === 'CONFIRMADA' && hasPermission('payroll.pay') && (
            <Button disabled={busy} onClick={() => pay.mutate()}>Marcar pagada</Button>
          )}
          {(run.status === 'BORRADOR' || run.status === 'CONFIRMADA') && hasPermission('payroll.cancel') && (
            <Button variant="destructive" disabled={busy} onClick={() => cancel.mutate()}>Anular</Button>
          )}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Devengos</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{money(run.total_earnings)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Deducciones</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{money(run.total_deductions)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Neto</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{money(run.total_net)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Costo patronal</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{money(run.total_employer_cost)}</CardContent></Card>
      </div>

      <div className="space-y-3">
        {run.payslips.map((payslip) => <PayslipCard key={payslip.id} payslip={payslip} />)}
      </div>
    </div>
  )
}

export default PayrollRunDetail
