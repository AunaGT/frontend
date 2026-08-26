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
 * Vista para dar de alta un empleado. Mismo estilo que la de usuarios: página
 * dedicada, no modal. La foto se sube después de crear (necesita el id).
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image as ImageIcon, Loader2, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { useToast } from '@/hooks/use-toast'
import {
  createEmployee, fetchLinkableUsers, uploadEmployeePhoto,
  PAYMENT_METHOD_LABELS, type EmployeePayload,
} from '@/services/hrService'

const FREQUENCY_LABELS: Record<string, string> = { MENSUAL: 'Mensual', QUINCENAL: 'Quincenal' }

const emptyForm: EmployeePayload = {
  first_name: '', last_name: '', hire_date: '', base_salary: 0, bonificacion_incentivo: 250,
  pay_frequency: 'MENSUAL', payment_method: 'EFECTIVO',
}

export default function EmployeeCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState<EmployeePayload>(emptyForm)
  // Estado aparte y no derivado de igss_number: si no, marcar la casilla y
  // todavía no escribir el número la desmarcaría sola.
  const [afiliadoIgss, setAfiliadoIgss] = useState(false)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoPreviewRef = useRef<string | null>(null)

  useEffect(() => {
    if (!photoFile) {
      if (photoPreviewRef.current) { URL.revokeObjectURL(photoPreviewRef.current); photoPreviewRef.current = null }
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current)
    photoPreviewRef.current = url
    setPhotoPreview(url)
    return () => {
      if (photoPreviewRef.current) { URL.revokeObjectURL(photoPreviewRef.current); photoPreviewRef.current = null }
    }
  }, [photoFile])

  // Usuarios de la empresa que todavía no tienen empleado, para vincular de una vez.
  const { data: linkable } = useQuery({
    queryKey: ['hr-linkable-users', 'nuevo'],
    queryFn: () => fetchLinkableUsers(),
  })

  const create = useMutation({
    mutationFn: (payload: EmployeePayload) => createEmployee(payload),
    onSuccess: async (employee) => {
      if (photoFile) {
        setIsUploadingPhoto(true)
        try {
          await uploadEmployeePhoto(employee.id, photoFile)
        } catch {
          toast({ title: 'Empleado creado', description: 'La foto no pudo subirse; podés intentarlo de nuevo en su ficha' })
        } finally {
          setIsUploadingPhoto(false)
        }
      }
      toast({ title: 'Empleado creado' })
      navigate(`/rrhh/empleados/${employee.id}`)
    },
    onError: (e: Error) => toast({ title: 'No se pudo crear', description: e.message, variant: 'destructive' }),
  })

  const isLoading = create.isPending || isUploadingPhoto
  const isTransfer = form.payment_method === 'TRANSFERENCIA'

  const submit = () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: 'Nombre y apellido son obligatorios', variant: 'destructive' })
      return
    }
    if (!form.hire_date) {
      toast({ title: 'La fecha de ingreso es obligatoria', variant: 'destructive' })
      return
    }
    if (afiliadoIgss && !form.igss_number?.trim()) {
      toast({
        title: 'Falta el número de IGSS',
        description: 'Escribilo, o destildá la casilla si el empleado no está afiliado.',
        variant: 'destructive',
      })
      return
    }
    create.mutate(form)
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/rrhh')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo empleado</h1>
          <p className="text-sm text-muted-foreground">Crear una ficha en RRHH</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Información del empleado</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Foto - 40% */}
            <div className="lg:col-span-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Foto</p>
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-md border border-border bg-muted p-4">
                {photoPreview ? (
                  <img src={photoPreview} alt="Vista previa" className="max-h-64 w-full rounded-lg object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ImageIcon className="mb-2 h-12 w-12" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
                <ImageUploadDropzone
                  onFileSelect={setPhotoFile}
                  onReject={(msg) => toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })}
                  disabled={isLoading}
                  isUploading={isUploadingPhoto}
                  selectionLabel={photoFile?.name ?? null}
                  onClearSelection={() => setPhotoFile(null)}
                  helperText="Opcional. Máx 5MB."
                />
              </div>
            </div>

            {/* Datos - 60% */}
            <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Label>Nombre</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><Label>Apellido</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                <div><Label>DPI</Label><Input value={form.dpi ?? ''} onChange={(e) => setForm({ ...form, dpi: e.target.value })} /></div>
                <div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={afiliadoIgss}
                      onCheckedChange={(v) => {
                        const on = v === true
                        setAfiliadoIgss(on)
                        if (!on) setForm((f) => ({ ...f, igss_number: '' }))
                      }}
                    />
                    <span className="text-sm font-medium leading-none">Afiliado al IGSS</span>
                  </label>
                  {afiliadoIgss ? (
                    <div className="mt-2">
                      <Label>No. IGSS</Label>
                      <Input autoFocus value={form.igss_number ?? ''} onChange={(e) => setForm({ ...form, igss_number: e.target.value })} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No se le retiene cuota laboral ni se le paga cuota patronal.</p>
                  )}
                </div>
                <div><Label>Puesto</Label><Input value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
                <div><Label>Departamento</Label><Input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                <div><Label>Fecha de ingreso</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
                <div><Label>Teléfono</Label><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Compensación</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><Label>Sueldo base</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
                  <div>
                    <Label>Bonificación incentivo</Label>
                    <Input type="number" step="0.01" value={form.bonificacion_incentivo ?? 250} onChange={(e) => setForm({ ...form, bonificacion_incentivo: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Frecuencia de pago</Label>
                    <Select value={form.pay_frequency ?? 'MENSUAL'} onValueChange={(v) => setForm({ ...form, pay_frequency: v as EmployeePayload['pay_frequency'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Forma de pago</Label>
                    <Select
                      value={form.payment_method ?? 'EFECTIVO'}
                      onValueChange={(v) => setForm({ ...form, payment_method: v as EmployeePayload['payment_method'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isTransfer && (
                    <>
                      <div><Label>Banco</Label><Input value={form.bank_name ?? ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Ej: Banrural" /></div>
                      <div><Label>Cuenta bancaria</Label><Input value={form.bank_account ?? ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <Label>Usuario del sistema</Label>
                <Select
                  value={form.user_id ?? '__none__'}
                  onValueChange={(v) => setForm({ ...form, user_id: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin vincular</SelectItem>
                    {(linkable?.items ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} · {u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solo aparecen los usuarios que todavía no están vinculados a otro empleado.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => navigate('/rrhh')} disabled={isLoading}>Cancelar</Button>
                <Button className="bg-liquor-amber hover:bg-liquor-amber/90 text-white" onClick={submit} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Crear empleado
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
