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
 * Vista de detalle de empleado: foto a un costado (40%), datos al otro (60%),
 * edición inline. Mismo patrón que la ficha de usuario.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Banknote, Briefcase, Calendar, Edit, Loader2, Mail, Phone, UserMinus, Wallet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  fetchEmployeeById, fetchLinkableUsers, updateEmployee, terminateEmployee, uploadEmployeePhoto,
  EMPLOYEE_STATUS_LABELS, PAYMENT_METHOD_LABELS, type EmployeePayload,
} from '@/services/hrService'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const FREQUENCY_LABELS: Record<string, string> = { MENSUAL: 'Mensual', QUINCENAL: 'Quincenal' }

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()

  const canEdit = hasPermission('hr.employees.edit')
  const canDelete = hasPermission('hr.employees.delete')

  const [isEditing, setIsEditing] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [form, setForm] = useState<EmployeePayload | null>(null)
  const [afiliadoIgss, setAfiliadoIgss] = useState(false)

  const { data: employee, isLoading } = useQuery({
    queryKey: ['hr-employee', id],
    queryFn: () => fetchEmployeeById(id as string),
    enabled: Boolean(id),
  })

  const { data: linkable } = useQuery({
    queryKey: ['hr-linkable-users', id],
    queryFn: () => fetchLinkableUsers(id),
    enabled: isEditing && Boolean(id),
  })

  const resetForm = () => {
    if (!employee) return
    setForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      hire_date: employee.hire_date.slice(0, 10),
      base_salary: Number(employee.base_salary),
      bonificacion_incentivo: Number(employee.bonificacion_incentivo),
      dpi: employee.dpi ?? '',
      igss_number: employee.igss_number ?? '',
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      address: employee.address ?? '',
      position: employee.position ?? '',
      department: employee.department ?? '',
      pay_frequency: employee.pay_frequency,
      payment_method: employee.payment_method,
      bank_name: employee.bank_name ?? '',
      bank_account: employee.bank_account ?? '',
      user_id: employee.user?.id ?? null,
    })
    setAfiliadoIgss(Boolean(employee.igss_number?.trim()))
  }

  useEffect(() => { resetForm() }, [employee])

  const save = useMutation({
    mutationFn: (payload: EmployeePayload) => updateEmployee(id as string, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employee', id] })
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      setIsEditing(false)
      toast({ title: 'Empleado actualizado' })
    },
    onError: (e: Error) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
  })

  const terminate = useMutation({
    mutationFn: () => terminateEmployee(id as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employee', id] })
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      setIsDeleteOpen(false)
      toast({ title: 'Empleado dado de baja' })
    },
    onError: (e: Error) => toast({ title: 'No se pudo dar de baja', description: e.message, variant: 'destructive' }),
  })

  const handlePhotoFile = async (file: File) => {
    if (!id) return
    setIsUploadingPhoto(true)
    try {
      await uploadEmployeePhoto(id, file)
      qc.invalidateQueries({ queryKey: ['hr-employee', id] })
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      toast({ title: 'Foto actualizada' })
    } catch (e) {
      toast({ title: 'Error', description: (e as Error)?.message ?? 'No se pudo subir la foto', variant: 'destructive' })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  if (!id) { navigate('/rrhh'); return null }

  if (isLoading || !form) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    )
  }
  if (!employee) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/rrhh')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <div className="mt-6 text-center text-destructive">Empleado no encontrado.</div>
      </div>
    )
  }

  const displayPhoto = employee.photo_url || undefined
  const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(`${employee.first_name} ${employee.last_name}`)}&background=orange&color=fff&size=200`
  const isTransfer = form.payment_method === 'TRANSFERENCIA'

  const submit = () => {
    if (afiliadoIgss && !form.igss_number?.trim()) {
      toast({
        title: 'Falta el número de IGSS',
        description: 'Escribilo, o destildá la casilla si el empleado no está afiliado.',
        variant: 'destructive',
      })
      return
    }
    save.mutate(form)
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rrhh')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{employee.first_name} {employee.last_name}</h1>
            <p className="text-sm text-muted-foreground">
              {employee.code} · <Badge variant={employee.status === 'ACTIVO' ? 'default' : 'secondary'} className="align-middle">
                {EMPLOYEE_STATUS_LABELS[employee.status]}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canEdit && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" />Editar</Button>
          )}
          {canDelete && !isEditing && employee.status !== 'BAJA' && (
            <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
              <UserMinus className="mr-2 h-4 w-4" />Dar de baja
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja a este empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              «{employee.first_name} {employee.last_name}» quedará marcado como BAJA con fecha de hoy. No se elimina su expediente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={terminate.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={terminate.isPending}
              onClick={(e) => { e.preventDefault(); terminate.mutate() }}
            >
              {terminate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className={isEditing ? 'ring-2 ring-liquor-amber/30' : ''}>
        <CardHeader><CardTitle>Información del empleado</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {isEditing && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setIsEditing(false); resetForm() }} disabled={save.isPending}>
                Cancelar cambios
              </Button>
              <Button className="bg-liquor-amber hover:bg-liquor-amber/90 text-white" onClick={submit} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar cambios
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Foto - 40% */}
            <div className="lg:col-span-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Foto</p>
              <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-border bg-muted p-4">
                <div className="flex aspect-square w-full max-w-[280px] items-center justify-center overflow-hidden rounded-lg bg-muted">
                  <img
                    src={displayPhoto || defaultPhoto}
                    alt={`${employee.first_name} ${employee.last_name}`}
                    className="h-full w-full rounded-lg object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = defaultPhoto }}
                  />
                </div>
                {canEdit && (
                  <ImageUploadDropzone
                    onFileSelect={(f) => void handlePhotoFile(f)}
                    onReject={(msg) => toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })}
                    disabled={isUploadingPhoto}
                    isUploading={isUploadingPhoto}
                    helperText="Opcional. Máx 5MB."
                  />
                )}
              </div>
            </div>

            {/* Datos - 60% */}
            <div className="space-y-6 lg:col-span-3">
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Datos personales</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Nombre</Label>
                    {isEditing ? <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="mt-1" />
                      : <p className="mt-1 font-medium text-foreground">{employee.first_name}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Apellido</Label>
                    {isEditing ? <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="mt-1" />
                      : <p className="mt-1 font-medium text-foreground">{employee.last_name}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">DPI</Label>
                    {isEditing ? <Input value={form.dpi ?? ''} onChange={(e) => setForm({ ...form, dpi: e.target.value })} className="mt-1" />
                      : <p className="mt-1 text-foreground">{employee.dpi || '—'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" /> Teléfono</Label>
                    {isEditing ? <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
                      : <p className="mt-1 text-foreground">{employee.phone || '—'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
                    {isEditing ? <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                      : <p className="mt-1 text-foreground">{employee.email || '—'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2"><Briefcase className="h-4 w-4" /> Puesto</Label>
                    {isEditing ? <Input value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })} className="mt-1" />
                      : <p className="mt-1 text-foreground">{employee.position || '—'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Departamento</Label>
                    {isEditing ? <Input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1" />
                      : <p className="mt-1 text-foreground">{employee.department || '—'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Fecha de ingreso</Label>
                    {isEditing ? <Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} className="mt-1" />
                      : <p className="mt-1 text-foreground">{format(new Date(employee.hire_date), 'dd MMMM yyyy', { locale: es })}</p>}
                  </div>
                </div>

                <div className="mt-4">
                  {isEditing ? (
                    <>
                      <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={afiliadoIgss}
                          onCheckedChange={(v) => {
                            const on = v === true
                            setAfiliadoIgss(on)
                            if (!on) setForm((f) => f && { ...f, igss_number: '' })
                          }}
                        />
                        <span className="text-sm font-medium leading-none">Afiliado al IGSS</span>
                      </label>
                      {afiliadoIgss && (
                        <div className="mt-2 max-w-xs">
                          <Label>No. IGSS</Label>
                          <Input value={form.igss_number ?? ''} onChange={(e) => setForm({ ...form, igss_number: e.target.value })} />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Afiliado al IGSS: <span className="text-foreground">{employee.igss_number ? `Sí (${employee.igss_number})` : 'No'}</span>
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Compensación</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Salario base</Label>
                    {isEditing ? <Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} className="mt-1" />
                      : <p className="mt-1 text-foreground">Q {Number(employee.base_salary).toFixed(2)}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Bonificación incentivo</Label>
                    {isEditing ? <Input type="number" step="0.01" value={form.bonificacion_incentivo ?? 250} onChange={(e) => setForm({ ...form, bonificacion_incentivo: Number(e.target.value) })} className="mt-1" />
                      : <p className="mt-1 text-foreground">Q {Number(employee.bonificacion_incentivo).toFixed(2)}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Frecuencia de pago</Label>
                    {isEditing ? (
                      <Select value={form.pay_frequency ?? 'MENSUAL'} onValueChange={(v) => setForm({ ...form, pay_frequency: v as EmployeePayload['pay_frequency'] })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 text-foreground">{FREQUENCY_LABELS[employee.pay_frequency]}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4" /> Forma de pago</Label>
                    {isEditing ? (
                      <Select
                        value={form.payment_method ?? 'EFECTIVO'}
                        onValueChange={(v) => setForm({ ...form, payment_method: v as EmployeePayload['payment_method'] })}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 text-foreground">{PAYMENT_METHOD_LABELS[employee.payment_method]}</p>
                    )}
                  </div>
                  {(isEditing ? isTransfer : employee.payment_method === 'TRANSFERENCIA') && (
                    <>
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2"><Banknote className="h-4 w-4" /> Banco</Label>
                        {isEditing ? <Input value={form.bank_name ?? ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="mt-1" placeholder="Ej: Banrural" />
                          : <p className="mt-1 text-foreground">{employee.bank_name || '—'}</p>}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Cuenta bancaria</Label>
                        {isEditing ? <Input value={form.bank_account ?? ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="mt-1" />
                          : <p className="mt-1 text-foreground">{employee.bank_account || '—'}</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Usuario del sistema</Label>
                {isEditing ? (
                  <>
                    <Select value={form.user_id ?? '__none__'} onValueChange={(v) => setForm({ ...form, user_id: v === '__none__' ? null : v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin vincular</SelectItem>
                        {(linkable?.items ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name} · {u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Solo aparecen los usuarios que todavía no están vinculados a otro empleado.</p>
                  </>
                ) : (
                  <p className="mt-1 text-foreground">{employee.user ? `${employee.user.name} · ${employee.user.email}` : 'Sin vincular'}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
