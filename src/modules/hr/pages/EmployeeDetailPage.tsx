import { usePageTrail } from '@/components/layout/PageNavigation'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Download, Edit, FileText, History, Mail, UserMinus, UserRound, Wallet } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { fetchEmployeeById, fetchLinkableUsers, updateEmployee, terminateEmployee, uploadEmployeePhoto, EMPLOYEE_STATUS_LABELS, type EmployeePayload } from '@/services/hrService'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { EmployeeForm } from './EmployeeForm'
import { EmployeePhotoPicker } from './EmployeePhotoPicker'
import { EmployeeSummary } from './EmployeeSummary'
import { EmployeeAttendance } from './EmployeeAttendance'
import { EmployeeHistory } from './EmployeeHistory'
import { EmployeeDocuments } from './EmployeeDocuments'
import AdvancesManagement from './AdvancesManagement'
import './hr.css'
import '@/components/shared/recordEditLayout.css'

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>(), navigate = useNavigate(), { toast } = useToast(), qc = useQueryClient(), { hasPermission } = useAuthPermissions()
  const canEdit = hasPermission('hr.employees.edit'), canDelete = hasPermission('hr.employees.delete')
  const { company } = useTenant()
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState(new URLSearchParams(window.location.search).get('editar') === '1' && canEdit)
  const [tab, setTab] = useState('resumen'), [deleteOpen, setDeleteOpen] = useState(false), [form, setForm] = useState<EmployeePayload | null>(null)
  usePageTrail([{ label: 'Empleados', to: '/rrhh', permissions: ['hr.employees.view'] }, { label: 'Detalle' }, ...(editing ? [{ label: 'Editar' }] : tab !== 'resumen' ? [{ label: ({asistencia:'Asistencia',anticipos:'Anticipos',historial:'Historial',documentos:'Documentos'} as Record<string,string>)[tab] || 'Resumen' }] : [])])
  const initializedDraft = useRef<string>()
  const query = useQuery({ queryKey: ['hr-employee', id], queryFn: () => fetchEmployeeById(id!), enabled: !!id })
  const employee = query.data
  const download = async () => {
    if (!employee) return
    setExporting(true)
    try { const { generateEmployeePDF } = await import('./generateEmployeePDF'); generateEmployeePDF([employee], company?.name || 'Auna') } catch (error) { toast({ title: 'No se pudo descargar la ficha', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }) } finally { setExporting(false) }
  }
  const links = useQuery({ queryKey: ['hr-linkable-users', id], queryFn: () => fetchLinkableUsers(id), enabled: editing && canEdit && !!id })
  useEffect(() => {
    if (!employee) return
    if (editing && initializedDraft.current === employee.id) return
    initializedDraft.current = employee.id
    const extras = { gender: employee.gender || '', marital_status: employee.marital_status || '', nationality: employee.nationality || '', workday: employee.workday || '', work_schedule: employee.work_schedule || '', supervisor_id: employee.supervisor_id || null }
    setForm({ first_name: employee.first_name, last_name: employee.last_name, hire_date: employee.hire_date.slice(0, 10), base_salary: Number(employee.base_salary), bonificacion_incentivo: Number(employee.bonificacion_incentivo), dpi: employee.dpi || '', nit: employee.nit || '', birth_date: employee.birth_date?.slice(0, 10) || '', igss_number: employee.igss_number || '', phone: employee.phone || '', email: employee.email || '', address: employee.address || '', position: employee.position || '', department: employee.department || '', contract_type: employee.contract_type, pay_frequency: employee.pay_frequency, payment_method: employee.payment_method, bank_name: employee.bank_name || '', bank_account: employee.bank_account || '', user_id: employee.user?.id || null })
    setForm(previous => previous && { ...previous, ...extras })
  }, [employee, editing])
  const refresh = () => { for (const key of ['hr-employee', 'hr-employees', 'hr-employee-history', 'hr-employee-overview']) qc.invalidateQueries({ queryKey: key === 'hr-employees' ? [key] : [key, id] }) }
  const save = useMutation({ mutationFn: (payload: EmployeePayload) => updateEmployee(id!, payload), onSuccess: () => { refresh(); setEditing(false); toast({ title: 'Empleado actualizado' }) }, onError: (error: Error) => toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' }) })
  const terminate = useMutation({ mutationFn: () => terminateEmployee(id!), onSuccess: () => { refresh(); setDeleteOpen(false); toast({ title: 'Empleado dado de baja' }) }, onError: (error: Error) => toast({ title: 'No se pudo dar de baja', description: error.message, variant: 'destructive' }) })
  const photo = useMutation({ mutationFn: (file: File) => uploadEmployeePhoto(id!, file), onSuccess: () => { refresh(); toast({ title: 'Fotografía actualizada' }) }, onError: (error: Error) => toast({ title: 'No se pudo cargar la fotografía', description: error.message, variant: 'destructive' }) })
  if (query.isPending) return <div className="hr-record-page p-8"><h1 className="sr-only">Expediente del empleado</h1><LoadingState variant="detail" message="Cargando expediente…" /></div>
  if (query.isError || !employee || !form) return <div className="hr-record-page p-8"><p>No se pudo cargar el expediente.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
  const tabs = [{ value: 'resumen', label: 'Resumen', icon: UserRound }, ...(hasPermission('hr.attendance.view') ? [{ value: 'asistencia', label: 'Asistencia', icon: CalendarDays }] : []), ...(hasPermission('hr.advances.view') ? [{ value: 'anticipos', label: 'Anticipos', icon: Wallet }] : []), { value: 'historial', label: 'Historial', icon: History }, ...(hasPermission('hr.documents.view') ? [{ value: 'documentos', label: 'Documentos', icon: FileText }] : [])]
  return <div className="hr-record-page"><div className="hr-record-container space-y-5">{query.isFetching && <LoadingIndicator message="Actualizando expediente…" />}
    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={exporting} onClick={() => void download()}><Download className="mr-2 h-4 w-4" />{exporting ? 'Preparando ficha…' : 'Descargar ficha'}</Button></div>
    <header className="flex flex-wrap items-center justify-between gap-5"><div className="flex min-w-0 items-center gap-5">{employee.photo_url ? <img src={employee.photo_url} alt="Fotografía del empleado" className="h-24 w-24 shrink-0 rounded-full border object-cover" /> : <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-brand-orange/10 text-3xl text-brand-orange">{employee.first_name[0]}{employee.last_name[0]}</span>}<div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">{employee.first_name} {employee.last_name}</h1><Badge variant="outline" className={employee.status === 'ACTIVO' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-red-500/15 text-red-600 dark:text-red-300'}>{EMPLOYEE_STATUS_LABELS[employee.status]}</Badge></div><p className="mt-2 text-sm text-muted-foreground">ID {employee.code} · {employee.department || 'Sin departamento'} · {employee.branch?.name || 'Sin sucursal'}</p></div></div><div className="flex flex-wrap gap-2">{canEdit && !editing && <Button variant="outline" onClick={() => { setTab('resumen'); setEditing(true) }}><Edit className="mr-2 h-4 w-4" />Editar</Button>}{employee.email && <Button asChild className="bg-brand-orange text-white hover:bg-brand-orange/90"><a href={`mailto:${employee.email}`}><Mail className="mr-2 h-4 w-4" />Enviar mensaje</a></Button>}{canDelete && !editing && employee.status !== 'BAJA' && <Button variant="outline" onClick={() => setDeleteOpen(true)}><UserMinus className="mr-2 h-4 w-4" />Dar de baja</Button>}</div></header>
    {editing && canEdit ? <form className="record-edit" onSubmit={e => { e.preventDefault(); save.mutate(form) }}>
      <div className="record-edit-identity">
        <EmployeePhotoPicker preview={employee.photo_url || undefined} onFileSelect={file => photo.mutate(file)} onReject={message => toast({ title: 'Imagen no válida', description: message, variant: 'destructive' })} disabled={save.isPending || photo.isPending} isUploading={photo.isPending} />
        <section className="record-edit-panel" aria-labelledby="hr-access-heading">
          <h3 id="hr-access-heading" className="record-edit-heading"><UserRound aria-hidden="true" />Acceso al sistema</h3>
          <div><Label htmlFor="hr-linked-user">Cuenta de acceso vinculada</Label><select id="hr-linked-user" className="auna-control auna-control-select hr-native-select" disabled={save.isPending || links.isPending || links.isError} value={form.user_id || ''} onChange={e => setForm({ ...form, user_id: e.target.value || null })}><option value="">Sin vincular</option>{links.data?.items.map(user => <option value={user.id} key={user.id}>{user.name} · {user.email}</option>)}</select>{links.isError && <p className="text-xs text-destructive">No se pudieron cargar las cuentas. La vinculación actual se conserva.</p>}</div>
        </section>
      </div>
      <EmployeeForm className="record-edit-columns" value={form} onChange={setForm} disabled={save.isPending} />
      <div className="record-edit-actions"><Button type="button" variant="outline" disabled={save.isPending || photo.isPending} onClick={() => { setEditing(false); query.refetch() }}>Cancelar cambios</Button><Button type="submit" disabled={save.isPending || photo.isPending} className="bg-brand-orange text-white hover:bg-brand-orange/90">{save.isPending ? 'Guardando…' : 'Guardar cambios'}</Button></div>
    </form> : <Tabs value={tab} onValueChange={setTab}><div className="overflow-x-auto"><TabsList variant="detail">{tabs.map(item => <TabsTrigger key={item.value} value={item.value}><item.icon className="mr-2 h-4 w-4" />{item.label}</TabsTrigger>)}</TabsList></div><TabsContent value="resumen"><EmployeeSummary employee={employee} onTab={setTab} /></TabsContent>{hasPermission('hr.attendance.view') && <TabsContent value="asistencia"><EmployeeAttendance employeeId={employee.id} /></TabsContent>}{hasPermission('hr.advances.view') && <TabsContent value="anticipos"><AdvancesManagement employeeId={employee.id} /></TabsContent>}<TabsContent value="historial"><EmployeeHistory employeeId={employee.id} /></TabsContent>{hasPermission('hr.documents.view') && <TabsContent value="documentos"><EmployeeDocuments employeeId={employee.id} /></TabsContent>}</Tabs>}
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>¿Dar de baja a este empleado?</AlertDialogTitle><AlertDialogDescription>Se marcará como baja con fecha de hoy. Su expediente y documentos se conservarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={terminate.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={terminate.isPending} onClick={e => { e.preventDefault(); terminate.mutate() }}>{terminate.isPending ? 'Guardando…' : 'Confirmar baja'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></div>
}
