/**
 * Pestaña de métodos de pago en Datos maestros (ventas y cierre de caja).
 */

import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { useState, useEffect } from 'react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/context/useTenant'
import { settlementKindLabel, type SettlementKind, type PaymentMethodScope } from '@/services/paymentMethodsService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { CatalogFilters } from './CatalogFilters'
import { CatalogRowActions } from './CatalogRowActions'
import { useCatalogSearch } from './useCatalogSearch'
import { Pagination } from '@/components/shared/Pagination'
import { MetricStrip } from '@/components/shared/MetricStrip'
import {
  usePaymentMethodsCatalog,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  paymentMethodUsageCounts,
  catalogApiErrorMessage,
  paymentMethodScopeChanged,
  isPaymentMethodScopeCurrent,
  type PaymentMethodCatalog,
} from '@/hooks/usePaymentMethodsCatalog'
import { Plus, Loader2 } from 'lucide-react'

type MethodDialogState = {
  open: boolean
  mode: 'create' | 'edit'
  item?: PaymentMethodCatalog
  scope?: PaymentMethodScope
  nextEnabled?: boolean
}

export function PaymentMethodsTab() {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { company, branch, isConsolidated } = useTenant()
  const scope = { companyId: company?.id ?? '', branchId: branch?.id ?? 'all' }
  const canManageCatalogs = hasPermission('catalogs.manage') && !isConsolidated && Boolean(branch)

  const { page: currentPage, setPage: setCurrentPage, pageSize } = usePersistedListUiState(
    'catalogs/payment-methods',
    { defaultPage: 1, defaultPageSize: 10 }
  )

  const { search, setSearch, query } = useCatalogSearch()
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [state, setState] = useState<'all' | 'active' | 'inactive'>('all')
  useResetPageOnFilterChange(setCurrentPage, [query, order, state])
  const { data, isLoading, isFetching, error } = usePaymentMethodsCatalog({
    includeSummary: true,
    page: currentPage,
    pageSize,
    search: query, order, state,
  })
  const items = data?.items ?? []

  const [dialog, setDialog] = useState<MethodDialogState>({ open: false, mode: 'create' })
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodCatalog | null>(null)
  const deleteMutation = useDeletePaymentMethod()
  useEffect(() => {
    setDialog({ open: false, mode: 'create' })
    setDeleteTarget(null)
  }, [company?.id, branch?.id])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync({ ...scope, id: deleteTarget.id, data: undefined })
      if (!isPaymentMethodScopeCurrent(scope)) return
      setDeleteTarget(null)
      toast({
        title: 'Método eliminado',
        description: 'El método de pago ha sido eliminado correctamente',
      })
    } catch (error) {
      if (paymentMethodScopeChanged(error) || !isPaymentMethodScopeCurrent(scope)) return
      toast({
        variant: 'destructive',
        title: 'Error',
        description: catalogApiErrorMessage(error, 'No se pudo eliminar el método de pago'),
      })
    }
  }

  return (
    <>
      <MetricStrip className="mb-5" label="Resumen de métodos de pago" loading={isLoading} items={[
        { label: 'Métodos', value: error ? '—' : data?.summary?.total ?? '—' },
        { label: 'Activos', value: error ? '—' : data?.summary?.active ?? '—' },
        { label: 'Inactivos', value: error ? '—' : data?.summary?.inactive ?? '—' },
        { label: 'Cobro inmediato', value: error ? '—' : data?.summary?.immediate ?? '—' },
        { label: 'Crédito', value: error ? '—' : data?.summary?.credit ?? '—' },
      ]} />
      <>

        <CatalogFilters actions={<>{canManageCatalogs && (
              <Button
                onClick={() => setDialog({ open: true, mode: 'create', scope })}
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span>Nuevo método</span>
              </Button>
            )}</>} search={search} onSearch={setSearch} order={order} onOrder={setOrder} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label htmlFor="pm-state">Estado</Label>
        <select id="pm-state" className="h-10 rounded-md border bg-background px-3 text-sm" value={state} onChange={e=>setState(e.target.value as typeof state)}>
          <option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
        </select>
        {isConsolidated && <p className="text-sm text-muted-foreground">Selecciona una sucursal para administrar los medios de esta empresa.</p>}
      </div>
      <Card className="auna-data-table-shell auna-surface">
        <CardContent className="catalog-content">
          {isFetching && data && <LoadingIndicator message="Actualizando métodos de pago…" />}
          {error ? <p role="alert" className="p-6 text-destructive">{catalogApiErrorMessage(error, 'No se pudieron cargar los métodos de pago')}</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo / origen</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Cierres de caja</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableLoadingRows columns={8} message="Cargando métodos de pago…" /> : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No hay métodos de pago registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((method) => {
                    const usage = paymentMethodUsageCounts(method)
                    const inUse = usage.total > 0
                    return (
                      <TableRow key={method.id}>
                        <TableCell className="font-medium">{method.id}</TableCell>
                        <TableCell>{method.name}</TableCell>
                        <TableCell><div>{settlementKindLabel(method.settlement_kind, method.is_credit)}</div><span className="text-xs text-muted-foreground">{method.origin === 'COMPANY' ? 'Propio' : method.origin === 'BASIC' ? 'Básico compartido' : 'Compartido legado'}</span></TableCell>
                        <TableCell>{method.position}</TableCell>
                        <TableCell>{usage.sales}</TableCell>
                        <TableCell>{usage.closures}</TableCell>
                        <TableCell>
                          <Badge variant={method.enabled ? 'default' : 'secondary'}>{method.enabled ? 'Activo' : 'Inactivo'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageCatalogs && (
                            <div className="flex justify-end items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={()=>setDialog({open:true,mode:'edit',item:method,scope,nextEnabled:!method.enabled})}>{method.enabled?'Desactivar':'Activar'}</Button>
                            <Button variant="ghost" size="sm" onClick={()=>setDialog({open:true,mode:'create',item:method,scope})}>Crear variante</Button>
                            <CatalogRowActions
                              onEdit={() => setDialog({ open: true, mode: 'edit', item: method, scope })}
                              onDelete={method.origin === 'COMPANY' && !inUse ? () => setDeleteTarget(method) : undefined}
                              deleteDisabled={inUse}
                              disabled={deleteMutation.isPending}
                            /></div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}

        </CardContent>
      </Card>
<div className="auna-pagination-outside">{data && data.totalPages > 0 && data.totalItems > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={data.page}
                totalPages={data.totalPages}
                onPageChange={setCurrentPage}
                hasNextPage={data.nextPage !== null}
                hasPrevPage={data.prevPage !== null}
                loading={isLoading}
                totalItems={data.totalItems}
                pageSize={pageSize}
                count={items.length}
                itemLabel="métodos de pago"
              />
            </div>
          )}</div></>

      <PaymentMethodDialog dialog={dialog} setDialog={setDialog} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar método de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Se eliminará «${deleteTarget.name}» de forma permanente. No podrás usarlo en ventas ni cierres nuevos.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PaymentMethodDialog({
  dialog,
  setDialog,
}: {
  dialog: MethodDialogState
  setDialog: (v: MethodDialogState) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SettlementKind>('BANK')
  const [enabled, setEnabled] = useState(true)
  const [position, setPosition] = useState(0)
  const [formError, setFormError] = useState('')
  const createMutation = useCreatePaymentMethod()
  const updateMutation = useUpdatePaymentMethod()

  useEffect(() => {
    if (!dialog.open) return
    setFormError('')
    setKind(dialog.item?.settlement_kind ?? 'BANK')
    setEnabled(dialog.nextEnabled ?? dialog.item?.enabled ?? true)
    setPosition(dialog.item?.position ?? 0)
    if (dialog.mode === 'create' || !dialog.item) {
      setName(dialog.item ? `${dialog.item.name} (propio)`.slice(0,50) : '')
    } else {
      setName(dialog.item.name)
    }
  }, [dialog.open, dialog.mode, dialog.item])
  const canRename = dialog.mode === 'create' || (dialog.item?.origin === 'COMPANY' && paymentMethodUsageCounts(dialog.item).total === 0)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
      setDialog({ open: false, mode: 'create' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre es requerido',
      })
      return
    }
    if (trimmed.length > 50) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre no puede superar 50 caracteres',
      })
      return
    }

    try {
      const scope = dialog.scope!
      if (dialog.mode === 'create') {
        await createMutation.mutateAsync({ ...scope, data: { name: trimmed, settlement_kind: kind } })
        if (!isPaymentMethodScopeCurrent(scope)) return
        toast({
          title: 'Método creado',
          description: 'El método de pago ha sido creado correctamente',
        })
      } else if (dialog.item) {
        await updateMutation.mutateAsync({ ...scope, id: dialog.item.id, data: { ...(canRename && trimmed !== dialog.item.name ? { name: trimmed } : {}), enabled, position } })
        if (!isPaymentMethodScopeCurrent(scope)) return
        toast({
          title: 'Método actualizado',
          description: 'El método de pago ha sido actualizado correctamente',
        })
      }
      handleOpenChange(false)
    } catch (error) {
      if (paymentMethodScopeChanged(error) || !isPaymentMethodScopeCurrent(dialog.scope)) return
      setFormError(catalogApiErrorMessage(error, 'Ocurrió un error'))
      toast({
        variant: 'destructive',
        title: 'Error',
        description: catalogApiErrorMessage(error, 'Ocurrió un error'),
      })
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogContent variant="auna">
        <DialogHeader>
          <DialogTitle>
            {dialog.mode === 'create' ? 'Nuevo método de pago' : 'Editar método de pago'}
          </DialogTitle>
          <DialogDescription>
            {dialog.mode === 'create'
              ? 'Crea un método de cobro para el punto de venta y el arqueo de caja'
              : 'Configura la disponibilidad y el orden solo para esta empresa. Los nombres con historial y los tipos se conservan.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Nombre del método</Label>
              <Input
                id="pm-name"
                placeholder="Ej: Efectivo, Tarjeta, Transferencia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={!canRename}
              />
            </div>
            {dialog.mode === 'create' ? <div className="space-y-2">
              <Label htmlFor="pm-kind">Tipo de medio</Label>
              <select id="pm-kind" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={kind} onChange={e=>setKind(e.target.value as SettlementKind)}>
                <option value="CASH">Efectivo</option><option value="BANK">Medio bancario</option><option value="CREDIT">Venta a crédito</option>
              </select>
              <p className="text-sm text-muted-foreground">Crédito genera saldo por cobrar; no representa dinero recibido. El tipo no se cambia después.</p>
            </div> : <>
              <Label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />Activo para nuevos movimientos</Label>
              {!enabled && <p className="text-sm text-muted-foreground">Al guardar se bloquearán nuevos cobros, pagos y reintegros por este medio. Su historial seguirá disponible.</p>}
              <div className="space-y-2"><Label htmlFor="pm-position">Orden de presentación</Label><Input id="pm-position" type="number" min={0} max={1000000} step={1} value={position} onChange={e=>setPosition(Number(e.target.value))} /></div>
            </>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialog.mode === 'create' ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
