import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Anticipos de sueldo y su saldo pendiente. La planilla los descuenta sola. */
import { useEffect, useState } from 'react'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  cancelAdvance, createAdvance, fetchAdvances, fetchEmployeeDirectory,
  ADVANCE_STATUS_LABELS, type AdvancePayload,
} from '@/services/hrService'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

const emptyForm: AdvancePayload = { employee_id: '', amount: 0, installment: 0 }

export const AdvancesManagement = ({ employeeId, employeeName }: { employeeId?: string; employeeName?: string }) => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('hr.advances.manage')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AdvancePayload>({ ...emptyForm, employee_id: employeeId ?? '' })
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [employeePage, setEmployeePage] = useState(1)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeLabel, setEmployeeLabel] = useState('')
  useEffect(() => { const timer = setTimeout(() => { setEmployeeQuery(employeeSearch); setEmployeePage(1) }, 300); return () => clearTimeout(timer) }, [employeeSearch])
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { data, isLoading, isFetching, isError, refetch } = useQuery({ queryKey: ['hr-advances', employeeId, page, status], queryFn: () => fetchAdvances({ employee_id: employeeId, status: status === 'all' ? undefined : status, page, pageSize: 10 }) })
  const { data: employees, isLoading: employeesLoading, isError: employeesError } = useQuery({
    queryKey: ['hr-employees', 'advance-picker', employeePage, employeeQuery],
    queryFn: () => fetchEmployeeDirectory('advance', { q: employeeQuery || undefined, page: employeePage, pageSize: 10 }),
    enabled: dialogOpen && !employeeId,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hr-advances'] })
    qc.invalidateQueries({ queryKey: ['accounting'] })
  }

  const create = useMutation({
    mutationFn: createAdvance,
    onSuccess: () => { invalidate(); setDialogOpen(false); setForm({ ...emptyForm, employee_id: employeeId ?? '' }); setEmployeeLabel(''); toast({ title: 'Anticipo otorgado' }) },
    onError: (e: Error) => toast({ title: 'No se pudo otorgar', description: e.message, variant: 'destructive' }),
  })

  const cancel = useMutation({
    mutationFn: cancelAdvance,
    onSuccess: () => { invalidate(); setCancelId(null); toast({ title: 'Anticipo cancelado' }) },
    onError: (e: Error) => toast({ title: 'No se pudo cancelar', description: e.message, variant: 'destructive' }),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Anticipos</CardTitle>
        {canManage && <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nuevo anticipo</Button>}
      </CardHeader>
      <CompactFilterPanel className="px-6 pb-4" title="Filtros de anticipos" activeCount={Number(status !== 'all')} onClear={() => {setStatus('all');setPage(1)}} appliedFilters={status !== 'all' ? [{label: `Estado: ${ADVANCE_STATUS_LABELS[status as keyof typeof ADVANCE_STATUS_LABELS]}`,onRemove: () => {setStatus('all');setPage(1)}}] : []}>
        <Select value={status} onValueChange={value => { setStatus(value); setPage(1) }}><SelectTrigger className="max-w-xs" aria-label="Estado del anticipo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{Object.entries(ADVANCE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </CompactFilterPanel>
      <CardContent className="auna-data-table-shell p-0">
        {isFetching && data && <LoadingIndicator message="Actualizando anticipos…" className="px-4 py-2" />}
        {isError ? <div role="alert" className="p-8 text-center"><p>No se pudieron cargar los anticipos.</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingRows columns={7} message="Cargando anticipos…" /> : <>
              {(data?.items ?? []).map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell>{advance.date.slice(0, 10)}</TableCell>
                  <TableCell>{advance.employee?.first_name} {advance.employee?.last_name}</TableCell>
                  <TableCell className="text-right">{money(advance.amount)}</TableCell>
                  <TableCell className="text-right">{money(advance.installment)}</TableCell>
                  <TableCell className="text-right font-medium">{money(advance.balance)}</TableCell>
                  <TableCell>
                    <Badge className={advance.status === 'PENDIENTE' ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300'}>
                      {ADVANCE_STATUS_LABELS[advance.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && advance.status === 'PENDIENTE' && Number(advance.balance) === Number(advance.amount) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancel.isPending}
                        aria-label="Cancelar anticipo"
                        title="Cancelar anticipo"
                        onClick={() => setCancelId(advance.id)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin anticipos</TableCell>
                </TableRow>
              )}
              </>}
            </TableBody>
          </Table>
        )}
        {data && <Pagination currentPage={data.page} totalPages={data.totalPages} totalItems={data.totalItems} count={data.items.length} pageSize={10} onPageChange={setPage} loading={isLoading} itemLabel="anticipos" />}
      </CardContent>
      <ConfirmDialog appearance="auna" open={!!cancelId} onOpenChange={open => { if (!open && !cancel.isPending) setCancelId(null) }} title="Cancelar anticipo" description="Se anulará el anticipo y se revertirá su movimiento contable. Esta acción solo está disponible si aún no tiene descuentos aplicados." variant="destructive" loading={cancel.isPending} onConfirm={() => { if (cancelId) cancel.mutate(cancelId) }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent variant="auna" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo anticipo</DialogTitle>
            <DialogDescription className="sr-only">
              Registrar un anticipo a un empleado, con su cuota de descuento por planilla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Empleado</Label>
              {employeeId ? <Input readOnly value={employeeName ?? employeeId} /> : <>
              <Input aria-label="Buscar empleado" placeholder="Buscar empleado por nombre o código" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} />
              {employeesLoading && <LoadingIndicator message="Buscando empleados…" />}
              {employeesError && <p role="alert" className="text-sm text-destructive">No se pudo cargar el equipo. Necesitas el permiso «Ver empleados» para seleccionar un destinatario.</p>}
              {employees && !employees.items.length && <p className="text-sm text-muted-foreground">No se encontraron empleados activos.</p>}
              <Select value={form.employee_id} onValueChange={(v) => { setForm({ ...form, employee_id: v }); const selected = employees?.items.find(e => e.id === v); if (selected) setEmployeeLabel(`${selected.first_name} ${selected.last_name}`) }}>
                <SelectTrigger><SelectValue placeholder="Selecciona">{employeeLabel || undefined}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(employees?.items ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employees && <Pagination currentPage={employees.page} totalPages={employees.totalPages} onPageChange={setEmployeePage} />}
              </>}
            </div>
            <div><Label>Monto</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Cuota por planilla</Label><Input type="number" step="0.01" value={form.installment} onChange={(e) => setForm({ ...form, installment: Number(e.target.value) })} /></div>
            <div><Label>Motivo</Label><Input value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={create.isPending || !form.employee_id || form.amount <= 0 || form.installment <= 0 || form.installment > form.amount} onClick={() => create.mutate(form)}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Otorgar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default AdvancesManagement
