import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
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

/** Listado de planillas del año, con KPIs y generación de una nueva corrida. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  createPayrollRun, fetchPayrollRuns,
  PAYROLL_STATUS_LABELS, PAYROLL_TYPE_LABELS,
  type PayrollRunPayload, type PayrollStatus, type PayrollType,
} from '../api/payrollService'
import { filterRuns, pageItems } from './payrollView.mjs'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

const STATUS_CLASS: Record<PayrollStatus, string> = {
  BORRADOR: 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  CONFIRMADA: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300',
  PAGADA: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ANULADA: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300',
}

// en-CA da 'yyyy-mm-dd' en zona local: con toISOString(), después de las 18:00
// en Guatemala la fecha de pago por defecto salta al día siguiente.
const today = () => new Date().toLocaleDateString('en-CA')

export const PayrollRunsManagement = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const canCreate = hasPermission('payroll.create')

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<PayrollRunPayload>({ type: 'ORDINARIA', pay_date: today() })

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['payroll-runs', year],
    queryFn: () => fetchPayrollRuns({ year }),
  })

  const runs = data?.items ?? []
  const visibleRuns = filterRuns(runs, { month, status, search })
  const totalPages = Math.max(1, Math.ceil(visibleRuns.length / 10))
  const currentPage = Math.min(page, totalPages)
  const latest = runs.find((run) => run.status !== 'ANULADA')
  const update = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1) }

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
    <div className="mx-auto max-w-[1520px] space-y-5 p-4 md:p-6">
      <header className="auna-module-heading">
        <div><p className="auna-module-eyebrow">Personas</p><h1>Corridas de nómina</h1><p className="auna-module-description">Gestiona y consulta las corridas de nómina por período.</p></div>
        {canCreate && <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nueva corrida</Button>}
      </header>

      <MetricStrip loading={isLoading} label="Última corrida activa" items={[{label:'Empleados · última corrida',value:latest?._count?.payslips ?? 0},{label:'Total bruto',value:money(latest?.total_earnings ?? 0)},{label:'Deducciones',value:money(latest?.total_deductions ?? 0)},{label:'Total neto',value:money(latest?.total_net ?? 0)}]} />

      <CompactFilterPanel title="Filtros de nómina" activeCount={Number(Boolean(search.trim())) + Number(Boolean(month)) + Number(Boolean(status)) + Number(year !== String(new Date().getFullYear()))} onClear={() => {setYear(String(new Date().getFullYear()));setMonth('');setStatus('');setSearch('');setPage(1)}} appliedFilters={[...(search.trim() ? [{label: `Búsqueda: ${search}`,onRemove: () => {setSearch('');setPage(1)}}] : []),...(month ? [{label: `Mes: ${new Intl.DateTimeFormat('es-GT',{month:'long'}).format(new Date(2026,Number(month)-1,1))}`,onRemove: () => {setMonth('');setPage(1)}}] : []),...(status ? [{label: `Estado: ${PAYROLL_STATUS_LABELS[status as PayrollStatus]}`,onRemove: () => {setStatus('');setPage(1)}}] : []),...(year !== String(new Date().getFullYear()) ? [{label: `Año: ${year}`,onRemove: () => {setYear(String(new Date().getFullYear()));setPage(1)}}] : [])]} search={<label className="space-y-1 text-xs text-muted-foreground">Buscar<div className="relative"><Search className="absolute left-3 top-3 h-4 w-4" /><Input aria-label="Buscar corridas" className="pl-9" placeholder="Buscar por período, descripción o código..." value={search} onChange={(e) => update(setSearch)(e.target.value)} /></div></label>}>
        <label className="space-y-1 text-xs text-muted-foreground">Año<Input aria-label="Año" type="number" min="2000" max="2100" value={year} onChange={(e) => { setYear(e.target.value); setPage(1) }} /></label>
        <label className="space-y-1 text-xs text-muted-foreground">Mes<select aria-label="Mes" className="auna-control auna-control-select flex w-full px-3" value={month} onChange={(e) => update(setMonth)(e.target.value)}><option value="">Todos</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{new Intl.DateTimeFormat('es-GT', { month: 'long' }).format(new Date(2026, i, 1))}</option>)}</select></label>
        <label className="space-y-1 text-xs text-muted-foreground">Estado<select aria-label="Estado" className="auna-control auna-control-select flex w-full px-3" value={status} onChange={(e) => update(setStatus)(e.target.value)}><option value="">Todos</option>{(Object.keys(PAYROLL_STATUS_LABELS) as PayrollStatus[]).map((item) => <option key={item} value={item}>{PAYROLL_STATUS_LABELS[item]}</option>)}</select></label>
      </CompactFilterPanel>

      <Card className="auna-data-table-shell">
        <CardContent className="p-0">
          {isFetching && data && <LoadingIndicator message="Actualizando corridas…" className="px-4 py-2" />}
          {isError ? (
            <div role="alert" className="space-y-3 p-6 text-center"><p>No se pudieron cargar las corridas. {error instanceof Error ? error.message : ''}</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="auna-data-table min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Empleados</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha de pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableLoadingRows columns={9} message="Cargando corridas…" /> : <>
                {pageItems(visibleRuns, currentPage, 10).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap text-sm">{run.period_start.slice(0, 10)}<span className="block text-muted-foreground">a {run.period_end.slice(0, 10)}</span></TableCell>
                    <TableCell><span className="font-medium">{run.name}</span><span className="block text-xs text-muted-foreground">{run.code} · {PAYROLL_TYPE_LABELS[run.type]}</span></TableCell>
                    <TableCell className="text-right">{run._count?.payslips ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(run.total_earnings)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(run.total_deductions)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{money(run.total_net)}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_CLASS[run.status]}>{PAYROLL_STATUS_LABELS[run.status]}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{run.pay_date.slice(0, 10)}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="outline" aria-label={`Ver corrida ${run.code}`} onClick={() => navigate(`/nomina/${run.id}`)}><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {visibleRuns.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No hay corridas para estos filtros.</TableCell></TableRow>
                )}
                </>}
              </TableBody>
            </Table>
            </div>
          )}
          <div className="auna-data-table-pagination"><span>Mostrando {visibleRuns.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, visibleRuns.length)} de {visibleRuns.length} corridas</span><nav aria-label="Paginación de corridas"><Button size="icon" variant="outline" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-9 text-center">{currentPage} / {totalPages}</span><Button size="icon" variant="outline" aria-label="Página siguiente" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button></nav></div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent variant="auna" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva planilla</DialogTitle>
            <DialogDescription className="sr-only">
              Tipo de planilla, nombre, fecha de pago y período a calcular.
            </DialogDescription>
          </DialogHeader>
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
