/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'


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
import {
  usePaymentTerms,
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
  useDeletePaymentTerm,
  useRestorePaymentTerm,
  PaymentTerm,
} from '@/hooks/usePaymentTerms'

import { Plus, Loader2, FileUp } from 'lucide-react'
import { CatalogFilters } from './CatalogFilters'
import { CatalogRowActions } from './CatalogRowActions'
import { useCatalogSearch } from './useCatalogSearch'
import '../catalogs.css'
import { Pagination } from '@/components/shared/Pagination'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'


import { catalogsModule } from '../manifest'

/** Filas de catálogo: API actual devuelve `_count.supplier_payment_terms`; respuestas antiguas `suppliers`. */
function paymentTermSupplierUsageCount(term: {
  _count?: { supplier_payment_terms?: number; suppliers?: number }
}): number {
  const c = term._count
  return c?.supplier_payment_terms ?? c?.suppliers ?? 0
}
type PaymentTermDialogState = { open: boolean; mode: 'create' | 'edit'; item?: PaymentTerm }
export function PaymentTermsPanel() {
 const navigate = useNavigate()
 const [showDeleted, setShowDeleted] = useState(false)
 const [dialog, setDialog] = useState<PaymentTermDialogState>({open:false, mode:'create'})
 return <><PaymentTermsTab showDeleted={showDeleted} setShowDeleted={setShowDeleted} dialog={dialog} setDialog={setDialog} onImportClick={() => navigate(catalogsModule.paths.paymentTermsImport)} /><PaymentTermDialog dialog={dialog} setDialog={setDialog} /></>
}
function PaymentTermsTab({
  showDeleted,
  setShowDeleted,
  dialog,
  setDialog,
  onImportClick,
}: {
  showDeleted: boolean
  setShowDeleted: (value: boolean) => void
  dialog: PaymentTermDialogState
  setDialog: (value: PaymentTermDialogState) => void
  onImportClick: () => void
}) {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canManageCatalogs = hasPermission('catalogs.manage')
  const { page: currentPage, setPage: setCurrentPage, pageSize } = usePersistedListUiState(
    'catalogs/payment-terms',
    { defaultPage: 1, defaultPageSize: 10 }
  )
  const { search, setSearch, query } = useCatalogSearch()
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  useResetPageOnFilterChange(setCurrentPage, [showDeleted, query, order])

  const { data: paymentTermsData, isLoading, isFetching, error: termsError } = usePaymentTerms({
    includeSummary: true,
    page: currentPage,
    pageSize,
    includeDeleted: showDeleted,
    search: query, order,
  })
  const paymentTerms = paymentTermsData?.items || []

  const deleteMutation = useDeletePaymentTerm()
  const restoreMutation = useRestorePaymentTerm()
  const [deleteConfirmTerm, setDeleteConfirmTerm] = useState<PaymentTerm | null>(null)
  const [restoreConfirmTerm, setRestoreConfirmTerm] = useState<PaymentTerm | null>(null)

  const confirmDeletePaymentTerm = async () => {
    if (!deleteConfirmTerm) return
    try {
      await deleteMutation.mutateAsync(deleteConfirmTerm.id)
      setDeleteConfirmTerm(null)
      toast({
        title: 'Término eliminado',
        description: 'El término de pago ha sido eliminado correctamente',
      })
    } catch (error: unknown) {
      const apiError = error as Error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.message || 'No se pudo eliminar el término de pago',
      })
    }
  }

  const confirmRestorePaymentTerm = async () => {
    if (!restoreConfirmTerm) return
    try {
      await restoreMutation.mutateAsync(restoreConfirmTerm.id)
      setRestoreConfirmTerm(null)
      toast({
        title: 'Término restaurado',
        description: 'El término de pago ha sido restaurado correctamente',
      })
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo restaurar el término de pago',
      })
    }
  }

  return (
    <><MetricStrip className="mb-5" label="Resumen de términos de pago" loading={isLoading} items={[
      { label: 'Términos', value: termsError ? '—' : paymentTermsData?.summary?.total ?? '—' },
      { label: 'Pago inmediato', value: termsError ? '—' : paymentTermsData?.summary?.immediate ?? '—' },
      { label: 'Con plazo', value: termsError ? '—' : paymentTermsData?.summary?.credit ?? '—' },
      { label: 'Sin plazo definido', value: termsError ? '—' : paymentTermsData?.summary?.unspecified ?? '—' },
    ]} />

      <CatalogFilters actions={<><div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleted(!showDeleted)}
              className="text-xs sm:text-sm"
            >
              {showDeleted ? 'Ocultar' : 'Ver eliminados'}
            </Button>
            {canManageCatalogs && (
              <>
                <Button
                  variant="outline"
                  onClick={onImportClick}
                  className="text-xs sm:text-sm"
                >
                  <FileUp className="w-4 h-4 sm:mr-2" />
                  <span>Importar</span>
                </Button>
                <Button
                  onClick={() => setDialog({ open: true, mode: 'create' })}
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span>Nuevo término</span>
                </Button>
              </>
            )}
          </div></>} search={search} onSearch={setSearch} order={order} onOrder={setOrder} />
      <Card className="auna-data-table-shell auna-surface">
      <CardContent className="catalog-content">
        {isFetching && paymentTermsData && <LoadingIndicator message="Actualizando términos de pago…" />}
        {termsError ? <p role="alert" className="p-6 text-destructive">{termsError.message}</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="whitespace-nowrap">Días neto</TableHead>
                <TableHead>Proveedores</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingRows columns={6} message="Cargando términos de pago…" /> : paymentTerms?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay términos de pago registrados
                  </TableCell>
                </TableRow>
              ) : (
                paymentTerms?.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">{term.id}</TableCell>
                    <TableCell>{term.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {term.net_days != null ? `${term.net_days} d` : '—'}
                    </TableCell>
                    <TableCell>{paymentTermSupplierUsageCount(term)}</TableCell>
                    <TableCell>
                      {term.deleted ? (
                        <Badge variant="destructive">Eliminado</Badge>
                      ) : (
                        <Badge className="catalog-status">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageCatalogs && (
                        <CatalogRowActions
                          onEdit={term.deleted ? undefined : () => setDialog({ open: true, mode: 'edit', item: term })}
                          onDelete={term.deleted ? undefined : () => setDeleteConfirmTerm(term)}
                          onRestore={term.deleted ? () => setRestoreConfirmTerm(term) : undefined}
                          disabled={deleteMutation.isPending || restoreMutation.isPending}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

      </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteConfirmTerm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmTerm(null)
        }}
      >
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar término de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmTerm
                ? `Se marcará como eliminado «${deleteConfirmTerm.name}». Podrás restaurarlo desde «Ver eliminados».`
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
                void confirmDeletePaymentTerm()
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!restoreConfirmTerm}
        onOpenChange={(open) => {
          if (!open) setRestoreConfirmTerm(null)
        }}
      >
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar término de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreConfirmTerm
                ? `«${restoreConfirmTerm.name}» volverá a estar activo y disponible para asignar a proveedores.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmRestorePaymentTerm()
              }}
            >
              {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
<div className="auna-pagination-outside">{paymentTermsData && paymentTermsData.totalPages > 0 && paymentTermsData.totalItems > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={paymentTermsData.page}
              totalPages={paymentTermsData.totalPages}
              onPageChange={setCurrentPage}
              hasNextPage={paymentTermsData.nextPage !== null}
              hasPrevPage={paymentTermsData.prevPage !== null}
              loading={isLoading}
              totalItems={paymentTermsData.totalItems}
              pageSize={pageSize}
              count={paymentTerms.length}
              itemLabel="términos de pago"
            />
          </div>
        )}</div></>
  )
}

function PaymentTermDialog({
  dialog,
  setDialog,
}: {
  dialog: PaymentTermDialogState
  setDialog: (value: PaymentTermDialogState) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [netDays, setNetDays] = useState('')
  const createMutation = useCreatePaymentTerm()
  const updateMutation = useUpdatePaymentTerm()

  useEffect(() => {
    if (!dialog.open) return
    if (dialog.mode === 'create' || !dialog.item) {
      setName('')
      setNetDays('')
    } else {
      setName(dialog.item.name)
      setNetDays(dialog.item.net_days != null ? String(dialog.item.net_days) : '')
    }
  }, [dialog.open, dialog.mode, dialog.item])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
      setNetDays('')
      setDialog({ open: false, mode: 'create' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre es requerido',
      })
      return
    }

    let netDaysPayload: number | null | undefined
    if (netDays.trim() !== '') {
      const n = Number(netDays.trim())
      if (!Number.isFinite(n) || n < 0 || n > 3650) {
        toast({
          variant: 'destructive',
          title: 'Días neto',
          description: 'Indica un número entre 0 y 3650 o déjalo vacío',
        })
        return
      }
      netDaysPayload = Math.floor(n)
    } else {
      netDaysPayload = dialog.mode === 'edit' ? null : undefined
    }

    try {
      if (dialog.mode === 'create') {
        await createMutation.mutateAsync({
          name: name.trim(),
          net_days: netDaysPayload,
        })
        toast({
          title: 'Término creado',
          description: 'El término de pago ha sido creado correctamente',
        })
      } else if (dialog.item) {
        await updateMutation.mutateAsync({
          id: dialog.item.id,
          data: {
            name: name.trim(),
            net_days: netDaysPayload,
          },
        })
        toast({
          title: 'Término actualizado',
          description: 'El término de pago ha sido actualizado correctamente',
        })
      }

      handleOpenChange(false)
    } catch (error: unknown) {
      const apiError = error as Error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.message || 'Ocurrió un error',
      })
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogContent variant="auna">
        <DialogHeader>
          <DialogTitle>
            {dialog.mode === 'create' ? 'Nuevo Término de Pago' : 'Editar Término de Pago'}
          </DialogTitle>
          <DialogDescription>
            {dialog.mode === 'create'
              ? 'Crea un nuevo término de pago para asignar a proveedores'
              : 'Modifica los datos del término de pago'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del término</Label>
              <Input
                id="name"
                placeholder="Ej: 30 días, 60 días, Contado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="net-days">Días neto (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Plazo para calcular el vencimiento de una compra. Puedes ajustar la fecha al registrar mercancía.
              </p>
              <Input
                id="net-days"
                type="number"
                min={0}
                max={3650}
                placeholder="Ej: 30"
                value={netDays}
                onChange={(e) => setNetDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {dialog.mode === 'create' ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
