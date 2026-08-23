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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  createEmployee, fetchEmployees, terminateEmployee, updateEmployee,
  EMPLOYEE_STATUS_LABELS, type Employee, type EmployeePayload,
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

  const { data, isLoading } = useQuery({
    queryKey: ['hr-employees', search],
    queryFn: () => fetchEmployees({ q: search || undefined }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hr-employees'] })
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

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }
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
    })
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
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nombre</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Apellido</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><Label>DPI</Label><Input value={form.dpi ?? ''} onChange={(e) => setForm({ ...form, dpi: e.target.value })} /></div>
            <div><Label>No. IGSS</Label><Input value={form.igss_number ?? ''} onChange={(e) => setForm({ ...form, igss_number: e.target.value })} /></div>
            <div><Label>Puesto</Label><Input value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><Label>Departamento</Label><Input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><Label>Fecha de ingreso</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>Teléfono</Label><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Sueldo base</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
            <div>
              <Label>Bonificación incentivo</Label>
              <Input type="number" step="0.01" value={form.bonificacion_incentivo ?? 250} onChange={(e) => setForm({ ...form, bonificacion_incentivo: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default EmployeesManagement
