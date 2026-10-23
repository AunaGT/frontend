import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { getActiveBranchId, getActiveCompanyId } from '@/services/api'
import { createDeduction, updateDeduction, cancelDeduction, fetchDeductions, fetchDeductionTargets, fetchEmployeeDirectory, deductionRequest, type DeductionPayload, type DeductionsScope, type EmployeeDeduction } from '@/services/hrService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageSizeSelect } from '@/components/shared/PageSizeSelect'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'

type Draft = DeductionPayload & { id?: string; employeeName?: string; targetName?: string; cancelling?: boolean }
const statuses: Record<string, string> = { PENDIENTE: 'Pendiente', APLICADO: 'Aplicado', CANCELADO: 'Cancelado' }

export default function DeductionsManagement({ employeeId, employeeName }: { employeeId?: string; employeeName?: string }) {
  const { company, branch, isConsolidated } = useTenant(), { user, hasPermission } = useAuthPermissions()
  const scope = { companyId: company?.id || '', branchId: branch?.id || (isConsolidated ? 'all' : '') }
  const canView = hasPermission('hr.deductions.view'), canManage = hasPermission('hr.deductions.manage') && !!branch?.id && !isConsolidated
  if (!canView || !scope.companyId || !scope.branchId) return null
  return <DeductionsWorkspace key={JSON.stringify([user?.id, scope, employeeId, canManage])} scope={scope} canManage={canManage} employeeId={employeeId} employeeName={employeeName} />
}

export function DeductionsWorkspace({ scope, canManage, employeeId, employeeName }: { scope: DeductionsScope; canManage: boolean; employeeId?: string; employeeName?: string }) {
  const { toast } = useToast(), qc = useQueryClient(), { user } = useAuthPermissions(), { locale, currencyCode } = useSystemSettings()
  const money = (value: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(Number(value))
  const alive = useRef(true), errorRef = useRef<HTMLParagraphElement>(null)
  const current = () => alive.current && getActiveCompanyId() === scope.companyId && getActiveBranchId() === scope.branchId
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(employeeId ? 10 : 50)
  const [draft, setDraft] = useState<Draft | null>(null), [error, setError] = useState('')
  const [employeeQuery, setEmployeeQuery] = useState(''), [employeePage, setEmployeePage] = useState(1)
  const [targetQuery, setTargetQuery] = useState(''), [targetPage, setTargetPage] = useState(1)
  const identity = [user?.id, scope.companyId, scope.branchId, employeeId]
  const list = useQuery({ queryKey: ['hr-deductions', ...identity, q, status, page, pageSize], queryFn: ({ signal }) => fetchDeductions({ employee_id: employeeId, q, status, page, pageSize }, scope, signal) })
  const directory = useQuery({ queryKey: ['hr-deduction-directory', ...identity, employeeQuery, employeePage], queryFn: ({ signal }) => fetchEmployeeDirectory('deduction', { q: employeeQuery, page: employeePage }, deductionRequest(scope, signal)), enabled: canManage && !!draft && !employeeId && !draft.id })
  const targets = useQuery({ queryKey: ['hr-deduction-targets', ...identity, draft?.employee_id, targetQuery, targetPage], queryFn: ({ signal }) => fetchDeductionTargets(draft!.employee_id, { q: targetQuery, page: targetPage }, scope, signal), enabled: canManage && !!draft?.employee_id && !draft.cancelling })
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  const refresh = () => { for (const key of ['hr-deductions', 'payroll-runs', 'hr-employee-history', 'hr-employee-overview']) qc.invalidateQueries({ queryKey: [key] }) }
  const save = useMutation({
    mutationFn: async (value: Draft) => {
      if (!current() || !canManage) throw Error('El contexto cambió. Vuelve a abrir el formulario')
      if (value.cancelling) return cancelDeduction(value.id!, { revision: value.revision!, reason: value.reason.trim() }, scope)
      const payload: DeductionPayload = { employee_id: value.employee_id, amount: value.amount, reason: value.reason.trim(), target_run_id: value.target_run_id, ...(value.id ? { revision: value.revision } : {}) }
      return value.id ? updateDeduction(value.id, payload, scope) : createDeduction(payload, scope)
    },
    onSuccess: () => { refresh(); if (!current()) return; setDraft(null); setError(''); toast({ title: 'Descuento actualizado', description: 'Se aplicará únicamente al confirmar la nómina correspondiente.' }) },
    onError: (e: Error) => { if (current()) { setError(e.message); refresh() } },
  })
  const open = (row?: EmployeeDeduction, cancelling = false) => {
    setError(''); setEmployeeQuery(''); setEmployeePage(1); setTargetQuery(''); setTargetPage(1)
    setDraft(row ? { id: row.id, revision: row.revision, employee_id: row.employee_id, employeeName: `${row.employee.first_name} ${row.employee.last_name}`, amount: row.amount, reason: cancelling ? '' : row.reason, target_run_id: row.target_run_id, targetName: row.target_run?.code, cancelling } : { employee_id: employeeId || '', employeeName, amount: '', reason: '', target_run_id: null })
  }
  const change = (patch: Partial<Draft>) => setDraft(previous => previous && { ...previous, ...patch })
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (!draft || save.isPending) return
    if (!draft.reason.trim() || draft.reason.trim().length > 1000) { setError('Indica un motivo de 1 a 1000 caracteres'); return }
    if (!draft.cancelling && (!draft.employee_id || !/^\d{1,10}(?:\.\d{1,2})?$/.test(draft.amount) || Number(draft.amount) <= 0)) { setError('Selecciona un empleado e indica un monto positivo con hasta dos decimales'); return }
    setError(''); save.mutate({ ...draft })
  }
  const pageButtons = (value: number, total: number, update: (n: number) => void, pending = false) => <div className="flex items-center gap-3"><Button type="button" size="sm" variant="outline" disabled={value <= 1 || pending} onClick={() => update(value - 1)}>Anterior</Button><span className="text-sm">{value} / {total}</span><Button type="button" size="sm" variant="outline" disabled={value >= total || pending} onClick={() => update(value + 1)}>Siguiente</Button></div>
  return <section className="space-y-4" aria-label="Descuentos de salario">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm text-muted-foreground">Programa un descuento indicando el monto y el motivo. No cambia el salario base ni se aplica hasta confirmar una nómina ordinaria.</p>{canManage && <Button disabled={!!draft || save.isPending} onClick={() => open()}>Nuevo descuento</Button>}</div>
    {draft && canManage && <Dialog open onOpenChange={opened => { if (!opened && !save.isPending) { setDraft(null); setError('') } }}>
      <DialogContent variant="auna" className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl" onEscapeKeyDown={event => { if (save.isPending) event.preventDefault() }} onPointerDownOutside={event => { if (save.isPending) event.preventDefault() }}>
      <DialogHeader><DialogTitle>{draft.cancelling ? 'Cancelar descuento' : draft.id ? 'Editar descuento pendiente' : 'Nuevo descuento'}</DialogTitle><DialogDescription>{draft.cancelling ? 'Indica por qué se cancela. El registro y su historial se conservarán.' : 'Define el monto, explica el motivo y elige en qué nómina se aplicará.'}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4" aria-label={draft.cancelling ? 'Cancelar descuento' : 'Registrar descuento'} aria-busy={save.isPending}>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="deduction-employee">Empleado</Label>{employeeId || draft.id ? <p id="deduction-employee" className="py-2 font-medium">{draft.employeeName || employeeId}</p> : <><Input aria-label="Buscar empleado para descuento" placeholder="Nombre o código del empleado" value={employeeQuery} onChange={e => { setEmployeeQuery(e.target.value); setEmployeePage(1) }} /><select id="deduction-employee" className="auna-control auna-control-select w-full" value={draft.employee_id} required disabled={save.isPending} onChange={e => { const row = directory.data?.items.find(r => r.id === e.target.value); change({ employee_id: e.target.value, employeeName: row ? `${row.first_name} ${row.last_name}` : '', target_run_id: null }); setTargetPage(1) }}><option value="">Selecciona un empleado</option>{draft.employee_id && !directory.data?.items.some(r => r.id === draft.employee_id) && <option value={draft.employee_id}>{draft.employeeName}</option>}{directory.data?.items.map(row => <option key={row.id} value={row.id}>{row.first_name} {row.last_name} · {row.code}</option>)}</select>{directory.isPending && <p className="text-sm">Buscando empleados…</p>}{directory.isError && <Button type="button" variant="outline" onClick={() => void directory.refetch()}>Reintentar empleados</Button>}{(directory.data?.totalPages || 1) > 1 && pageButtons(employeePage, directory.data!.totalPages, setEmployeePage, directory.isFetching)}</>}</div>
        <div className="space-y-2"><Label htmlFor="deduction-amount">Monto a descontar</Label>{draft.cancelling ? <p>{money(draft.amount)}</p> : <Input id="deduction-amount" inputMode="decimal" value={draft.amount} required maxLength={13} disabled={save.isPending} onChange={e => change({ amount: e.target.value })} placeholder="0.00" aria-describedby="deduction-amount-help" />}<p id="deduction-amount-help" className="text-xs text-muted-foreground">Importe único en {currencyCode}; no se divide en cuotas.</p></div>
        <div className="space-y-2"><Label htmlFor="deduction-reason">{draft.cancelling ? 'Motivo de cancelación' : 'Motivo del descuento'} *</Label><Textarea id="deduction-reason" required maxLength={1000} rows={3} value={draft.reason} disabled={save.isPending} onChange={e => change({ reason: e.target.value })} aria-describedby="deduction-reason-help" /><p id="deduction-reason-help" className="text-xs text-muted-foreground">{draft.cancelling ? 'El registro original se conservará en el historial.' : 'Aparecerá en el recibo del empleado. Describe el acuerdo o la razón con claridad.'}</p></div>
        {!draft.cancelling && <div className="space-y-2"><Label htmlFor="deduction-target">¿Cuándo se descontará?</Label><select id="deduction-target" className="auna-control auna-control-select w-full" value={draft.target_run_id || ''} disabled={save.isPending || !draft.employee_id} onChange={e => change({ target_run_id: e.target.value || null })}><option value="">Próxima nómina ordinaria</option>{draft.target_run_id && !targets.data?.items.some(r => r.id === draft.target_run_id) && <option value={draft.target_run_id}>{draft.targetName || 'Destino actual'} · revisa su disponibilidad</option>}{targets.data?.items.map(row => <option key={row.id} value={row.id}>{row.code} · {row.name} · {row.pay_date.slice(0, 10)}</option>)}</select><p className="text-xs text-muted-foreground">La primera nómina ordinaria elegible que confirmes, o un borrador específico. No se descuenta de aguinaldo ni bono 14.</p>{draft.employee_id && <><Input aria-label="Buscar nómina específica" placeholder="Buscar nómina por nombre o código" value={targetQuery} onChange={e => { setTargetQuery(e.target.value); setTargetPage(1) }} disabled={save.isPending} />{targets.isPending && <p className="text-sm">Buscando nóminas…</p>}{targets.isError && <Button type="button" variant="outline" onClick={() => void targets.refetch()}>Reintentar nóminas</Button>}{!targets.isPending && !targets.isError && !targets.data?.items.length && <p className="text-xs text-muted-foreground">No hay borradores que coincidan e incluyan al empleado; puedes dejarlo para la próxima nómina ordinaria.</p>}{(targets.data?.totalPages || 1) > 1 && pageButtons(targetPage, targets.data!.totalPages, setTargetPage, targets.isFetching)}</>}</div>}
      </div>
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => { setDraft(null); setError('') }}>Volver al listado</Button><Button type="submit" variant={draft.cancelling ? 'destructive' : 'default'} disabled={save.isPending}>{save.isPending ? 'Guardando…' : draft.cancelling ? 'Confirmar cancelación' : 'Guardar descuento'}</Button></div>
      </form></DialogContent></Dialog>}
    <div className="flex flex-wrap items-center gap-3"><Input aria-label="Buscar descuentos" className="max-w-md" placeholder="Buscar por empleado o motivo" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} /><select className="auna-control auna-control-select !w-auto" aria-label="Estado del descuento" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">Todos los estados</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {list.isFetching && !list.isPending && <LoadingIndicator message="Actualizando descuentos…" />}
    {list.isError ? <div role="alert" className="space-y-2"><p>No se pudieron cargar los descuentos.</p><Button variant="outline" onClick={() => void list.refetch()}>Reintentar</Button></div> : <div className="auna-data-table-shell overflow-x-auto"><Table><TableHeader><TableRow>{!employeeId && <TableHead>Empleado</TableHead>}<TableHead>Monto</TableHead><TableHead>Motivo</TableHead><TableHead>Nómina</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>
      {list.isPending && <TableLoadingRows columns={employeeId ? 5 : 6} message="Cargando descuentos…" />}
      {list.data?.items.map(row => <TableRow key={row.id}>{!employeeId && <TableCell>{row.employee.first_name} {row.employee.last_name}<span className="block text-xs text-muted-foreground">{row.employee.code}</span></TableCell>}<TableCell className="whitespace-nowrap tabular-nums">{money(row.amount)}</TableCell><TableCell className="max-w-sm whitespace-normal break-words">{row.reason}{row.cancelled_reason && <p className="mt-1 text-xs text-muted-foreground">Cancelado: {row.cancelled_reason}</p>}</TableCell><TableCell>{row.applied_run?.code || row.target_run?.code || 'Próxima ordinaria'}{row.status === 'PENDIENTE' && row.target_run?.status === 'ANULADA' && <p className="text-xs text-destructive">Reprograma el descuento: esta nómina está anulada.</p>}</TableCell><TableCell><Badge variant="outline">{statuses[row.status]}</Badge></TableCell><TableCell>{canManage && row.status === 'PENDIENTE' ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!!draft || save.isPending} onClick={() => open(row)}>Editar</Button><Button size="sm" variant="outline" disabled={!!draft || save.isPending} onClick={() => open(row, true)}>Cancelar descuento</Button></div> : <span className="text-xs text-muted-foreground">{row.status === 'APLICADO' ? 'Conservado en el recibo' : 'Solo consulta'}</span>}</TableCell></TableRow>)}
      {!list.isPending && !list.data?.items.length && <TableRow><TableCell colSpan={employeeId ? 5 : 6}><CollectionEmptyState compact title="Todo en orden por aquí" description="Cuando necesites registrar un descuento de salario, podrás programarlo y seguir su aplicación desde aquí." filtered={!!q || !!status} onReset={() => { setQ(''); setStatus(''); setPage(1) }} action={canManage && !draft ? <Button onClick={() => open()}>Registrar descuento</Button> : undefined} /></TableCell></TableRow>}
    </TableBody></Table></div>}
    {list.data && <div className="auna-pagination-outside flex flex-wrap items-center justify-between gap-3"><PageSizeSelect label="Descuentos por página" value={pageSize} onChange={value => { setPageSize(value); setPage(1) }} /><span className="text-sm text-muted-foreground">{list.data.totalItems} descuentos</span>{pageButtons(list.data.page, list.data.totalPages, setPage, list.isFetching)}</div>}
  </section>
}
