/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Listado de empleados: alta y edición viven en su propia página (/rrhh/empleados). */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, UserMinus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { fetchEmployees, terminateEmployee, EMPLOYEE_STATUS_LABELS, type Employee } from '@/services/hrService'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

const initials = (employee: Employee) =>
  `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase()

const EmployeeAvatar = ({ employee }: { employee: Employee }) =>
  employee.photo_url ? (
    <img
      src={employee.photo_url}
      alt={`${employee.first_name} ${employee.last_name}`}
      className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-liquor-amber/15 text-xs font-semibold text-liquor-amber ring-1 ring-liquor-amber/25">
      {initials(employee)}
    </div>
  )

export const EmployeesManagement = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const canCreate = hasPermission('hr.employees.create')
  const canDelete = hasPermission('hr.employees.delete')

  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['hr-employees', search],
    queryFn: () => fetchEmployees({ q: search || undefined }),
  })

  const terminate = useMutation({
    mutationFn: (id: string) => terminateEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      toast({ title: 'Empleado dado de baja' })
    },
    onError: (e: Error) => toast({ title: 'No se pudo dar de baja', description: e.message, variant: 'destructive' }),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Empleados</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o DPI"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8"
            />
          </div>
          {canCreate && (
            <Button onClick={() => navigate('/rrhh/empleados/nuevo')}>
              <Plus className="mr-2 h-4 w-4" />Nuevo
            </Button>
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
                  className="cursor-pointer"
                  onClick={() => navigate(`/rrhh/empleados/${employee.id}`)}
                >
                  <TableCell className="font-mono text-xs">{employee.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar employee={employee} />
                      <span>{employee.first_name} {employee.last_name}</span>
                    </div>
                  </TableCell>
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
    </Card>
  )
}

export default EmployeesManagement
