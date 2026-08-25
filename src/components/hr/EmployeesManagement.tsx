/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Expediente de empleados: alta, edición y baja lógica. */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  createEmployee, fetchEmployees, terminateEmployee, updateEmployee,
  EMPLOYEE_STATUS_LABELS, fetchLinkableUsers, type Employee, type EmployeePayload,
} from '@/services/hrService'

const emptyForm: EmployeePayload = {
  first_name: '', last_name: '', hire_date: '', base_salary: 0, bonificacion_incentivo: 250,
}

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

export const EmployeesManagement = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const canCreate = hasPermission('hr.employees.create')
  const canEdit = hasPermission('hr.employees.edit')
  const canDelete = hasPermission('hr.employees.delete')

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeePayload>(emptyForm)
  // Estado aparte y no derivado de igss_number: si no, marcar la casilla y
  // todavía no escribir el número la desmarcaría sola.
  const [afiliadoIgss, setAfiliadoIgss] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-employees', search],
    queryFn: () => fetchEmployees({ q: search || undefined }),
  })

  // Solo se pide con el diálogo abierto: el listado no necesita los usuarios.
  const { data: linkable } = useQuery({
    queryKey: ['hr-linkable-users', editing?.id ?? 'nuevo'],
    queryFn: () => fetchLinkableUsers(editing?.id),
    enabled: dialogOpen,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hr-employees'] })
    // Vincular o desvincular cambia qué usuarios quedan disponibles.
    qc.invalidateQueries({ queryKey: ['hr-linkable-users'] })
    qc.invalidateQueries({ queryKey: ['hr-advances'] })
  }

  const save = useMutation({
    mutationFn: (payload: EmployeePayload) =>
      editing ? updateEmployee(editing.id, payload) : createEmployee(payload),
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      toast({ title: editing ? 'Empleado actualizado' : 'Empleado creado' })
    },
    onError: (e: Error) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
  })

  const terminate = useMutation({
    mutationFn: (id: string) => terminateEmployee(id),
    onSuccess: () => { invalidate(); toast({ title: 'Empleado dado de baja' }) },
    onError: (e: Error) => toast({ title: 'No se pudo dar de baja', description: e.message, variant: 'destructive' }),
  })

  const openNew = () => { setEditing(null); setForm(emptyForm); setAfiliadoIgss(false); setDialogOpen(true) }
  const openEdit = (employee: Employee) => {
    setEditing(employee)
    setForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      hire_date: employee.hire_date.slice(0, 10),
      base_salary: Number(employee.base_salary),
      bonificacion_incentivo: Number(employee.bonificacion_incentivo),
      position: employee.position ?? '',
      department: employee.department ?? '',
      dpi: employee.dpi ?? '',
      igss_number: employee.igss_number ?? '',
      phone: employee.phone ?? '',
      user_id: employee.user?.id ?? null,
    })
    setAfiliadoIgss(Boolean(employee.igss_number?.trim()))
    setDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Empleados</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por nombre, código o DPI"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          {canCreate && (
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead className="text-right">Sueldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((employee) => (
                <TableRow
                  key={employee.id}
                  className={canEdit ? 'cursor-pointer' : undefined}
                  onClick={canEdit ? () => openEdit(employee) : undefined}
                >
                  <TableCell className="font-mono text-xs">{employee.code}</TableCell>
                  <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                  <TableCell>{employee.position ?? '—'}</TableCell>
                  <TableCell className="text-right">{money(employee.base_salary)}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'ACTIVO' ? 'default' : 'secondary'}>
                      {EMPLOYEE_STATUS_LABELS[employee.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canDelete && employee.status !== 'BAJA' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={terminate.isPending}
                        aria-label="Dar de baja al empleado"
                        title="Dar de baja"
                        onClick={(e) => { e.stopPropagation(); terminate.mutate(employee.id) }}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin empleados registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
            <DialogDescription className="sr-only">
              Datos personales, puesto, sueldo y afiliación al IGSS del empleado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nombre</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Apellido</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><Label>DPI</Label><Input value={form.dpi ?? ''} onChange={(e) => setForm({ ...form, dpi: e.target.value })} /></div>
            <div>
              {/* El número es la única marca de afiliación que hay: sin él la
                  nómina lo deja fuera de la planilla del IGSS. */}
              <label className="flex items-center gap-2 cursor-pointer">
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
                  <Input
                    autoFocus
                    value={form.igss_number ?? ''}
                    onChange={(e) => setForm({ ...form, igss_number: e.target.value })}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No se le retiene cuota laboral ni se le paga cuota patronal.
                </p>
              )}
            </div>
            <div><Label>Puesto</Label><Input value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><Label>Departamento</Label><Input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><Label>Fecha de ingreso</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>Teléfono</Label><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Sueldo base</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
            <div>
              <Label>Bonificación incentivo</Label>
              <Input type="number" step="0.01" value={form.bonificacion_incentivo ?? 250} onChange={(e) => setForm({ ...form, bonificacion_incentivo: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
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
              <p className="text-xs text-muted-foreground mt-1">
                Solo aparecen los usuarios que todavía no están vinculados a otro empleado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={save.isPending}
              onClick={() => {
                if (afiliadoIgss && !form.igss_number?.trim()) {
                  toast({
                    title: 'Falta el número de IGSS',
                    description: 'Escribilo, o destildá la casilla si el empleado no está afiliado.',
                    variant: 'destructive',
                  })
                  return
                }
                save.mutate(form)
              }}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default EmployeesManagement
