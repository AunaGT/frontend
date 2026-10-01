/**
 * Pestaña de cajas registradoras (POS) en Datos maestros.
 * Crear cajas, renombrarlas, marcar la predeterminada y activar/desactivar.
 * La asignación de caja a un usuario se hace desde la ficha del usuario.
 */

import { useState, useEffect } from 'react'
import { CatalogFilters } from './CatalogFilters'
import { useCatalogSearch } from './useCatalogSearch'
import { Pagination } from '@/components/shared/Pagination'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  listCashRegisters,
  createCashRegister,
  updateCashRegister,
  setCashRegisterUsers,
  type CashRegisterDto,
} from '@/services/cashSessionsService'
import { getUsers, type User } from '@/services/userService'
import { useTenant } from '@/context/useTenant'
import { Pencil, Plus, Loader2, Star, Users, Search } from 'lucide-react'

const REGISTERS_QUERY_KEY = ['cash-registers', 'manage'] as const

type RegisterDialogState = {
  open: boolean
  mode: 'create' | 'edit'
  item?: CashRegisterDto
}

export function CashRegistersTab() {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('settings.manage')
  const { branch } = useTenant()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [search, order, status, branch?.id])

  const { data: registers = [], isLoading, error: registersError } = useQuery({
    queryKey: [...REGISTERS_QUERY_KEY, branch?.id],
    queryFn: () => listCashRegisters(true),
  })
  const filteredRegisters = registers.filter(reg =>
    `${reg.name} ${reg.code}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (status === 'all' || reg.active === (status === 'active'))
  ).sort((a, b) => a.name.localeCompare(b.name, 'es') * (order === 'asc' ? 1 : -1))
  const totalPages = Math.max(1, Math.ceil(filteredRegisters.length / 10))
  const safePage = Math.min(page, totalPages)
  const visibleRegisters = filteredRegisters.slice((safePage - 1) * 10, safePage * 10)

  const [dialog, setDialog] = useState<RegisterDialogState>({ open: false, mode: 'create' })
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [saving, setSaving] = useState(false)

  // Diálogo de asignación de usuarios a una caja
  const [assignTarget, setAssignTarget] = useState<CashRegisterDto | null>(null)
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set())
  const { search: assignSearch, setSearch: setAssignSearch, query: assignQuery } = useCatalogSearch()
  const [assignPage, setAssignPage] = useState(1)
  useEffect(() => { setAssignPage(1) }, [assignQuery])
  const [assignSaving, setAssignSaving] = useState(false)

  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useQuery({
    queryKey: ['users', 'for-register-assign', assignTarget?.branch?.id, assignQuery, assignPage],
    queryFn: () => getUsers({ page: assignPage, pageSize: 20, search: assignQuery, branch_id: assignTarget?.branch?.id }),
    enabled: assignTarget != null,
  })
  const allUsers: User[] = usersData?.items ?? []

  const openAssign = (reg: CashRegisterDto) => {
    setAssignSearch('')
    setAssignPage(1)
    setAssignSelected(new Set((reg.assigned_users ?? []).map((u) => u.id)))
    setAssignTarget(reg)
  }

  const toggleAssigned = (userId: string, checked: boolean) => {
    setAssignSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  const handleAssignSave = async () => {
    if (!assignTarget) return
    setAssignSaving(true)
    try {
      await setCashRegisterUsers(assignTarget.id, Array.from(assignSelected))
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({
        title: 'Usuarios asignados',
        description: `Asignación de la caja "${assignTarget.name}" actualizada`,
      })
      setAssignTarget(null)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar la asignación',
      })
    } finally {
      setAssignSaving(false)
    }
  }

  const filteredUsers = allUsers

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-registers'] })
    queryClient.invalidateQueries({ queryKey: REGISTERS_QUERY_KEY })
  }

  const openCreate = () => {
    setFormName('')
    setFormCode('')
    setDialog({ open: true, mode: 'create' })
  }

  const openEdit = (item: CashRegisterDto) => {
    setFormName(item.name)
    setFormCode(item.code)
    setDialog({ open: true, mode: 'edit', item })
  }

  const handleSave = async () => {
    const name = formName.trim()
    if (!name) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es requerido' })
      return
    }
    setSaving(true)
    try {
      if (dialog.mode === 'create') {
        await createCashRegister({ name, code: formCode.trim() || undefined })
        toast({ title: 'Caja creada', description: `La caja "${name}" fue creada correctamente` })
      } else if (dialog.item) {
        await updateCashRegister(dialog.item.id, { name })
        toast({ title: 'Caja actualizada', description: `La caja "${name}" fue actualizada` })
      }
      invalidate()
      setDialog({ open: false, mode: 'create' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar la caja',
      })
    } finally {
      setSaving(false)
    }
  }

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => updateCashRegister(id, { is_default: true }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Caja predeterminada actualizada' })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo cambiar la predeterminada',
      })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateCashRegister(id, { active }),
    onSuccess: (updated) => {
      invalidate()
      toast({
        title: updated.active ? 'Caja activada' : 'Caja desactivada',
        description: `La caja "${updated.name}" fue ${updated.active ? 'activada' : 'desactivada'}`,
      })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo cambiar el estado',
      })
    },
  })

  return (
    <>
      <Card className="auna-data-table-shell">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Cajas registradoras</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Gestiona las cajas y sus usuarios en {branch?.name ?? 'la sucursal activa'}.
                Cambia de sucursal en el selector superior para administrar otra sede.
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={openCreate} size="sm" className="h-11 bg-brand-orange text-white hover:bg-brand-orange-strong w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nueva caja
              </Button>
            )}
          </div>
        </CardHeader>
        <CatalogFilters search={search} onSearch={setSearch} order={order} onOrder={setOrder} />
        <div className="px-6 pb-4"><select aria-label="Estado de las cajas" value={status} onChange={e => setStatus(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todos los estados</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></div>
        <CardContent className="catalog-content">
          {registersError ? <p role="alert" className="p-6 text-destructive">{registersError.message}</p> : isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Cargando cajas...
            </div>
          ) : visibleRegisters.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay cajas registradas
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Usuarios asignados</TableHead>
                    {canManage && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRegisters.map((reg) => (
                    <TableRow key={reg.id} className={!reg.active ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {reg.name}
                          {reg.is_default && (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="w-3 h-3" />
                              Predeterminada
                            </Badge>
                          )}
                          {reg.has_open_session && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                              Turno abierto
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{reg.code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reg.branch?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={reg.active ? 'catalog-status' : undefined} variant={reg.active ? 'default' : 'secondary'}>
                          {reg.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.assigned_users && reg.assigned_users.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            {reg.assigned_users.map((u) => u.name).join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            {reg.active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Asignar usuarios a esta caja"
                                onClick={() => openAssign(reg)}
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                            )}
                            {!reg.is_default && reg.active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Marcar como predeterminada"
                                disabled={setDefaultMutation.isPending}
                                onClick={() => setDefaultMutation.mutate(reg.id)}
                              >
                                <Star className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Editar nombre"
                              onClick={() => openEdit(reg)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {!reg.is_default && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={reg.active ? 'text-destructive' : 'text-emerald-600'}
                                disabled={toggleActiveMutation.isPending}
                                onClick={() =>
                                  toggleActiveMutation.mutate({ id: reg.id, active: !reg.active })
                                }
                              >
                                {reg.active ? 'Desactivar' : 'Activar'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!registersError && !isLoading && <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRegisters.length} pageSize={10} count={visibleRegisters.length} itemLabel="cajas" />}
      </Card>

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      >
        <DialogContent variant="auna" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.mode === 'create' ? 'Nueva caja' : 'Editar caja'}</DialogTitle>
            <DialogDescription>
              {dialog.mode === 'create'
                ? `Se creará en la sucursal ${branch?.name ?? 'activa'}.`
                : 'Cambia el nombre de la caja. El código no se puede modificar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-name">Nombre</Label>
              <Input
                id="register-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej. Caja 2, Mostrador, Bodega"
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-code">Código</Label>
              <Input
                id="register-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Se genera del nombre si se deja vacío"
                maxLength={40}
                disabled={dialog.mode === 'edit'}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, mode: 'create' })}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialog.mode === 'create' ? 'Crear caja' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de asignación de usuarios */}
      <Dialog open={assignTarget != null} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent variant="auna" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar usuarios — {assignTarget?.name}</DialogTitle>
            <DialogDescription>
              Los usuarios marcados usarán esta caja al abrir turno en el POS. Cada usuario solo
              puede tener una caja: si estaba en otra, se mueve a esta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="pl-9"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
              {usersError ? <p role="alert" className="p-4 text-destructive">{usersError.message}</p> : isLoadingUsers ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cargando usuarios...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No se encontraron usuarios
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const checked = assignSelected.has(u.id)
                  const otherRegister =
                    u.cash_register && u.cash_register.id !== assignTarget?.id
                      ? u.cash_register.name
                      : null
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => toggleAssigned(u.id, c === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{u.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {u.email}
                          {u.role?.name ? ` · ${u.role.name}` : ''}
                        </span>
                      </span>
                      {otherRegister && !checked && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          En {otherRegister}
                        </Badge>
                      )}
                    </label>
                  )
                })
              )}
            </div>
            {usersData && <Pagination currentPage={usersData.page} totalPages={usersData.totalPages} onPageChange={setAssignPage} totalItems={usersData.totalItems} pageSize={20} count={allUsers.length} itemLabel="usuarios" loading={isLoadingUsers} />}
            <p className="text-xs text-muted-foreground">
              {assignSelected.size} usuario{assignSelected.size === 1 ? '' : 's'} seleccionado
              {assignSelected.size === 1 ? '' : 's'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={assignSaving}>
              Cancelar
            </Button>
            <Button onClick={handleAssignSave} disabled={assignSaving || isLoadingUsers || !!usersError}>
              {assignSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
