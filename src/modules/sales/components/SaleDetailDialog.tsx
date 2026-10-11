/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Sale } from '@/types'
import { useNavigate } from 'react-router-dom'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { fetchSaleById } from '@/services/saleService'
import { normalizeRawSale } from '../hooks/useSalesData'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { SaleDetailContent, SaleStatusBadge } from './SaleDetailContent'

interface SaleDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  locale?: string
  currencyCode?: string
}

export const SaleDetailDialog = ({ open, onOpenChange, sale, locale, currencyCode }: SaleDetailDialogProps) => {
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const canManageReturns = hasPermission('returns.manage')
  const detail = useQuery({
    queryKey: ['sales', 'detail', sale?.id],
    queryFn: async () => normalizeRawSale(await fetchSaleById(sale!.reference ?? sale!.id)),
    enabled: open && Boolean(sale),
    staleTime: 0,
  })
  if (!sale) return null
  const completeSale = detail.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="auna" className="sale-detail-dialog">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-3 pr-6">
            <DialogTitle>Venta {sale.reference ?? sale.id}</DialogTitle>
            <SaleStatusBadge status={completeSale?.status ?? sale.status} />
          </div>
          <DialogDescription className="sr-only">Cliente, productos, pago y devoluciones asociadas a esta venta.</DialogDescription>
        </DialogHeader>
        <div className="sale-detail-dialog-body">
          {detail.isError ? <div className="space-y-3 py-4">
            <p role="alert" className="text-destructive">{detail.error instanceof Error ? detail.error.message : 'No se pudo cargar el detalle de la venta'}</p>
            <Button variant="outline" onClick={() => void detail.refetch()}>Reintentar</Button>
          </div> : !completeSale ? <LoadingState variant="detail" message="Cargando detalle…" /> : <>
            {detail.isFetching && <LoadingIndicator message="Actualizando detalle…" className="mb-3" />}
            <SaleDetailContent sale={completeSale} locale={locale} currencyCode={currencyCode} />
          </>}
        </div>
        {completeSale?.status === 'completed' && !detail.isError && canManageReturns && (
          <DialogFooter className="sale-detail-dialog-footer">
            <Button variant="outline" aria-label={`Registrar devolución de ${sale.reference ?? sale.id}`} onClick={() => {
              onOpenChange(false)
              navigate(`/returns/new?sale_id=${sale.reference ?? sale.id}`)
            }}>
              <RotateCcw aria-hidden /> Devolución
            </Button>
            <Button variant="outline" aria-label={`Registrar cambio de ${sale.reference ?? sale.id}`} onClick={() => {
              onOpenChange(false)
              navigate(`/returns/new?sale_id=${sale.reference ?? sale.id}&mode=exchange`)
            }}>
              <RefreshCw aria-hidden /> Cambio
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
