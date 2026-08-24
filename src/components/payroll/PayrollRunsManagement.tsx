/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Listado de planillas del año, con KPIs y generación de una nueva corrida. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  createPayrollRun, fetchPayrollRuns,
  PAYROLL_STATUS_LABELS, PAYROLL_TYPE_LABELS,
  type PayrollRunPayload, type PayrollStatus, type PayrollType,
} from '@/services/payrollService'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

const STATUS_VARIANT: Record<PayrollStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR: 'outline',
  CONFIRMADA: 'default',
  PAGADA: 'secondary',
  ANULADA: 'destructive',
}

const today = () => new Date().toISOString().slice(0, 10)

export const PayrollRunsManagement = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const canCreate = hasPermission('payroll.create')

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<PayrollRunPayload>({ type: 'ORDINARIA', pay_date: today() })

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs', year],
    queryFn: () => fetchPayrollRuns({ year }),
  })

  const runs = data?.items ?? []
  const activas = runs.filter((r) => r.status !== 'ANULADA')
  const kpi = {
    costo: activas.reduce((s, r) => s + Number(r.total_earnings) + Number(r.total_employer_cost), 0),
    neto: activas.reduce((s, r) => s + Number(r.total_net), 0),
    corridas: activas.length,
  }

  const create = useMutation({
    mutationFn: createPayrollRun,
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      setDialogOpen(false)
      toast({ title: `Planilla ${run.code} generada` })
      navigate(`/nomina/${run.id}`)
    },
    onError: (e: Error) => toast({ title: 'No se pudo generar', description: e.message, variant: 'destructive' }),
  })

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nómina</h1>
        <div className="flex items-center gap-2">
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
          {canCreate && <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nueva planilla</Button>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Costo total del año</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{money(kpi.costo)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Neto pagado</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{money(kpi.neto)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Corridas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{kpi.corridas}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Empleados</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id} className="cursor-pointer" onClick={() => navigate(`/nomina/${run.id}`)}>
                    <TableCell className="font-mono text-xs">{run.code}</TableCell>
                    <TableCell>{run.name}</TableCell>
                    <TableCell>{PAYROLL_TYPE_LABELS[run.type]}</TableCell>
                    <TableCell>{run.pay_date.slice(0, 10)}</TableCell>
                    <TableCell className="text-right">{run._count?.payslips ?? '—'}</TableCell>
                    <TableCell className="text-right">{money(run.total_net)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[run.status]}>{PAYROLL_STATUS_LABELS[run.status]}</Badge></TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin planillas en {year}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva planilla</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PayrollType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYROLL_TYPE_LABELS) as PayrollType[]).map((t) => (
                    <SelectItem key={t} value={t}>{PAYROLL_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nombre</Label><Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Agosto 2026" /></div>
            <div><Label>Fecha de pago</Label><Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></div>
            {form.type === 'ORDINARIA' && (
              <>
                <div><Label>Inicio del período</Label><Input type="date" value={form.period_start ?? ''} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div><Label>Fin del período</Label><Input type="date" value={form.period_end ?? ''} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              </>
            )}
            {form.type !== 'ORDINARIA' && (
              <p className="text-xs text-muted-foreground">
                El período de cómputo se calcula solo: 1 de diciembre a 30 de noviembre para el
                aguinaldo, 1 de julio a 30 de junio para el bono 14.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button disabled={create.isPending} onClick={() => create.mutate(form)}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PayrollRunsManagement
