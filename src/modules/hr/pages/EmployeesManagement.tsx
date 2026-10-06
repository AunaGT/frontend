import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { MetricStrip } from '@/components/shared/MetricStrip'
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

/** Listado de empleados: alta y edición viven en su propia página (/rrhh/empleados). */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserMinus, Search, Eye, Pencil, MoreHorizontal } from 'lucide-react'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useTenant } from '@/context/useTenant'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { fetchEmployees, terminateEmployee, EMPLOYEE_STATUS_LABELS, type Employee } from '@/services/hrService'

const initials = (employee: Employee) =>
  `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase()

const EmployeeAvatar = ({ employee }: { employee: Employee }) =>
  employee.photo_url ? (
    <img
      src={employee.photo_url}
      alt={`${employee.first_name} ${employee.last_name}`}
      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-semibold text-brand-orange ring-1 ring-brand-orange/25">
      {initials(employee)}
    </div>
  )

export const EmployeesManagement = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const canDelete = hasPermission('hr.employees.delete')
  const { branches, company } = useTenant()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [position, setPosition] = useState('')
  const [branch, setBranch] = useState('all')
  const [pageSize, setPageSize] = useState(8)
  const [selected, setSelected] = useState<Employee | null>(null)
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1) }, 300); return () => clearTimeout(timer) }, [search])

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['hr-employees', query, status, position, branch, page, pageSize],
    queryFn: () => fetchEmployees({ q: query || undefined, status: status === 'all' ? undefined : status, position: position || undefined, branch_id: branch === 'all' ? undefined : branch, page, pageSize }),
  })

  const terminate = useMutation({
    mutationFn: (id: string) => terminateEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      toast({ title: 'Empleado dado de baja' })
      setSelected(null)
    },
    onError: (e: Error) => toast({ title: 'No se pudo dar de baja', description: e.message, variant: 'destructive' }),
  })
  useEffect(() => { setSelectedIds([]) }, [query, status, position, branch, page, pageSize])
  const downloadSelected = async () => {
    setExporting(true)
    try { const { generateEmployeePDF } = await import('./generateEmployeePDF'); generateEmployeePDF(data?.items.filter(item => selectedIds.includes(item.id)) || [], company?.name || 'Auna') } catch (error) { toast({ title: 'No se pudo descargar las fichas', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }) } finally { setExporting(false) }
  }

  return (
    <div className="space-y-5">
    <MetricStrip loading={isLoading} label="Resumen de empleados" items={[{label:'Total de empleados',value:data?.summary?.total ?? '—'},{label:'Activos sin licencia',value:data?.summary?.active ?? '—'},{label:'En licencia hoy',value:data?.summary?.onLeave ?? '—'},{label:'Inactivos',value:data?.summary?.inactive ?? '—'}]} />
    <Card className="border-0 bg-transparent shadow-none">
      {!!selectedIds.length && <div className="flex items-center justify-between gap-3 pb-3"><p className="text-sm">{selectedIds.length} empleados seleccionados en esta página</p><Button variant="outline" disabled={exporting} onClick={() => void downloadSelected()}>{exporting ? 'Preparando…' : 'Descargar fichas seleccionadas'}</Button></div>}
      <CompactFilterPanel title="Filtros de empleados" activeCount={Number(Boolean(search.trim())) + Number(status !== 'all') + Number(Boolean(position)) + Number(branch !== 'all')} onClear={() => {setSearch('');setQuery('');setStatus('all');setPosition('');setBranch('all');setPage(1)}} appliedFilters={[...(search.trim() ? [{label: `Búsqueda: ${search}`,onRemove: () => {setSearch('');setQuery('');setPage(1)}}] : []),...(status !== 'all' ? [{label: `Estado: ${EMPLOYEE_STATUS_LABELS[status as keyof typeof EMPLOYEE_STATUS_LABELS]}`,onRemove: () => {setStatus('all');setPage(1)}}] : []),...(position ? [{label: `Puesto: ${position}`,onRemove: () => {setPosition('');setPage(1)}}] : []),...(branch !== 'all' ? [{label: `Sucursal: ${branches.find(b => b.id === branch)?.name || 'Seleccionada'}`,onRemove: () => {setBranch('all');setPage(1)}}] : [])]} search={<div><Label htmlFor="hr-search">Buscar empleado</Label><div className="relative mt-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="hr-search" className="pl-9" placeholder="Nombre, apellido, correo o código…" value={search} onChange={e => setSearch(e.target.value)} /></div></div>}>
        <div><Label>Estado</Label><Select value={status} onValueChange={value => { setStatus(value); setPage(1) }}><SelectTrigger className="mt-1" aria-label="Estado del empleado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="hr-position-filter">Puesto</Label><Input className="mt-1" id="hr-position-filter" placeholder="Cualquier puesto" value={position} onChange={e => { setPosition(e.target.value); setPage(1) }} /></div>
        <div><Label>Sucursal</Label><Select value={branch} onValueChange={value => { setBranch(value); setPage(1) }}><SelectTrigger className="mt-1" aria-label="Sucursal del empleado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Ámbito actual</SelectItem>{branches.map(item => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      </CompactFilterPanel>
      <CardContent className="auna-data-table-shell mt-5 p-0">
        {isFetching && data && <LoadingIndicator message="Actualizando empleados…" className="px-4 py-2" />}
        {isError ? <div role="alert" className="p-8 text-center"><p>No se pudieron cargar los empleados.</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox aria-label="Seleccionar empleados de esta página" checked={!!data?.items.length && data.items.every(item => selectedIds.includes(item.id))} onCheckedChange={checked => setSelectedIds(checked ? data?.items.map(item => item.id) || [] : [])} /></TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingRows columns={7} message="Cargando empleados…" /> : <>
              {(data?.items ?? []).map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/rrhh/empleados/${employee.id}`)}
                >
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox aria-label={`Seleccionar ${employee.first_name} ${employee.last_name}`} checked={selectedIds.includes(employee.id)} onCheckedChange={checked => setSelectedIds(ids => checked ? [...ids, employee.id] : ids.filter(id => id !== employee.id))} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar employee={employee} />
                      <div><span className="font-semibold">{employee.first_name} {employee.last_name}</span><p className="text-xs text-muted-foreground">{employee.code}{employee.email ? ` | ${employee.email}` : ''}</p></div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.position ?? '—'}</TableCell>
                  <TableCell>{employee.branch?.name ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{employee.hire_date.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge className={employee.status === 'ACTIVO' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : employee.status === 'BAJA' ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300'}>
                      {EMPLOYEE_STATUS_LABELS[employee.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" aria-label="Ver expediente" onClick={e => { e.stopPropagation(); navigate(`/rrhh/empleados/${employee.id}`) }}><Eye className="h-4 w-4" /></Button>
                    {hasPermission('hr.employees.edit') && <Button variant="ghost" size="icon" aria-label="Editar empleado" onClick={e => { e.stopPropagation(); navigate(`/rrhh/empleados/${employee.id}?editar=1`) }}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && employee.status !== 'BAJA' && (
                      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Más opciones del empleado" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" onClick={e => e.stopPropagation()}><DropdownMenuItem disabled={terminate.isPending} onSelect={() => setSelected(employee)}><UserMinus className="mr-2 h-4 w-4" />Dar de baja</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Sin empleados registrados
                  </TableCell>
                </TableRow>
              )}
              </>}
            </TableBody>
          </Table>
        )}
        {data && <><Pagination currentPage={data.page} totalPages={data.totalPages} totalItems={data.totalItems} pageSize={pageSize} count={data.items.length} onPageChange={setPage} loading={isLoading} itemLabel="empleados" /><div className="flex justify-end border-t p-3"><label className="flex items-center gap-2 text-sm">Filas por página<select className="auna-control auna-control-select hr-native-select !w-20 !mt-0" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[8, 16, 32].map(size => <option key={size}>{size}</option>)}</select></label></div></>}
      </CardContent>
    </Card>
    <ConfirmDialog appearance="auna" open={!!selected} onOpenChange={open => { if (!open && !terminate.isPending) setSelected(null) }} title="Dar de baja al empleado" description={`¿Dar de baja a ${selected?.first_name ?? ''} ${selected?.last_name ?? ''}? Se conservará su historial laboral y de nómina.`} confirmText="Dar de baja" variant="destructive" loading={terminate.isPending} onConfirm={() => { if (selected) terminate.mutate(selected.id) }} />
    </div>
  )
}

export default EmployeesManagement
