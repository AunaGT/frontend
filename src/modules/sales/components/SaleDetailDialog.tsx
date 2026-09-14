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
 * SaleDetailDialog - Dialog for viewing sale details with returns
 */
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, PackageX, RefreshCw, RotateCcw, Tag } from 'lucide-react'
import { Sale, SaleStatus } from '@/types'
import { formatMoney, formatDateTime } from '@/utils'
import { useNavigate } from 'react-router-dom'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

interface SaleDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sale: Sale | null
    locale?: string
    currencyCode?: string
}

const getStatusBadge = (status: SaleStatus) => {
    const badges: Record<string, React.ReactNode> = {
        pending: <Badge className='bg-yellow-500 text-white'>Pendiente</Badge>,
        paid: <Badge className='bg-blue-500 text-white'>Pagado</Badge>,
        completed: <Badge className='bg-green-500 text-white'>Completado</Badge>,
        cancelled: <Badge variant='destructive'>Cancelado</Badge>,
    }
    return badges[status] || <Badge variant='outline'>Desconocido</Badge>
}

export const SaleDetailDialog = ({
    open,
    onOpenChange,
    sale,
    locale,
    currencyCode
}: SaleDetailDialogProps) => {
    const navigate = useNavigate()
    const { hasPermission } = useAuthPermissions()
    const canManageReturns = hasPermission('returns.manage')

    if (!sale) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-3xl max-h-[90vh] overflow-hidden flex flex-col'>
                <DialogHeader>
                    <DialogTitle>Detalle de Venta {sale.reference ?? sale.id}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Productos, totales y devoluciones asociadas a esta venta.
                    </DialogDescription>
                </DialogHeader>
                <div className='space-y-4 overflow-y-auto pr-2'>
                    {/* Resumen rápido: fecha, estado, método de pago*/}
                    <div className='flex flex-wrap items-center gap-4 text-sm'>
                        <div><Label className='text-muted-foreground'>Fecha</Label><div className='font-medium'>{formatDateTime(sale.date, undefined, locale)}</div></div>
                        <div><Label className='text-muted-foreground'>Estado</Label><div>{getStatusBadge(sale.status)}</div></div>
                        <div><Label className='text-muted-foreground'>Método de pago</Label><div className='font-medium'>{sale.payment}</div></div>
                    </div>

                    {/* Returns Alert */}
                    {sale.hasReturns && (
                        <div className='bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3'>
                            <AlertTriangle className='w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5' />
                            <div>
                                <p className='text-sm font-medium text-orange-900'>Esta venta tiene devoluciones</p>
                                <p className='text-xs text-orange-700 mt-1'>
                                    Se han devuelto productos por un valor de {formatMoney(sale.totalReturned || 0, locale, currencyCode)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Products */}
                    <div>
                        <Label>Productos</Label>
                        <div className='border rounded-lg divide-y max-h-64 overflow-y-auto'>
                            {sale.products.map((p, i) => (
                                <div key={i} className='p-3 flex justify-between'>
                                    <div>
                                        <div className='font-medium'>{p.name}</div>
                                        <div className='text-sm text-muted-foreground'>Cantidad: {p.qty}</div>
                                    </div>
                                    <div className='text-right'>
                                        <div className='font-medium'>{formatMoney(p.price * p.qty, locale, currencyCode)}</div>
                                        <div className='text-sm text-muted-foreground'>{formatMoney(p.price, locale, currencyCode)} c/u</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Promotions Applied */}
                    {sale.promotions && sale.promotions.length > 0 && (
                        <div>
                            <Label className='flex items-center gap-2'>
                                <Tag className='w-4 h-4 text-green-600' />Promociones Aplicadas
                            </Label>
                            <div className='border border-green-200 rounded-lg divide-y mt-2 bg-green-50/30'>
                                {sale.promotions.map((promo, idx) => (
                                    <div key={idx} className='p-3 flex justify-between items-center'>
                                        <div>
                                            <div className='text-sm font-medium text-green-900'>
                                                {promo.promotion?.name || 'Promoción'}
                                            </div>
                                            {promo.code_used && (
                                                <div className='text-xs text-muted-foreground'>
                                                    Código: <code className='bg-muted px-1 rounded'>{promo.code_used}</code>
                                                </div>
                                            )}
                                            {promo.promotion?.type?.name && (
                                                <Badge variant='outline' className='text-xs mt-1'>
                                                    {promo.promotion.type.name}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className='text-right font-medium text-green-700'>
                                            -{formatMoney(promo.discount_applied, locale, currencyCode)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Returns Section */}
                    {sale.hasReturns && sale.returnDetails && sale.returnDetails.length > 0 && (
                        <div>
                            <Label className='flex items-center gap-2'>
                                <PackageX className='w-4 h-4 text-orange-600' />Devoluciones
                            </Label>
                            <div className='border border-orange-200 rounded-lg divide-y mt-2 bg-orange-50/30'>
                                {sale.returnDetails.map((ret, idx) => (
                                    <div key={idx} className='p-3 space-y-2'>
                                        <div className='flex justify-between items-start'>
                                            <div>
                                                <div className='text-sm font-medium text-orange-900'>Devolución {idx + 1}</div>
                                                <div className='text-xs text-muted-foreground'>{formatDateTime(ret.date)}</div>
                                            </div>
                                            <Badge variant={ret.status === 'Completada' ? 'default' : 'secondary'} className='text-xs'>
                                                {ret.status}
                                            </Badge>
                                        </div>
                                        {ret.reason && (
                                            <div className='text-xs text-muted-foreground italic'>Razón: {ret.reason}</div>
                                        )}
                                        <div className='space-y-1'>
                                            {ret.items.map((item, itemIdx) => (
                                                <div key={itemIdx} className='flex justify-between text-xs bg-white/50 p-2 rounded'>
                                                    <span>{item.productName} × {item.qty}</span>
                                                    <span className='font-medium text-orange-700'>-{formatMoney(item.refund, locale, currencyCode)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className='text-right text-sm font-bold text-orange-900 border-t pt-1'>
                                            Total devuelto: {formatMoney(ret.totalRefund, locale, currencyCode)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totals */}
                    <div className='bg-muted/50 p-4 rounded-lg space-y-2'>
                        {/* Show subtotal when there are promotions */}
                        {sale.discountTotal && sale.discountTotal > 0 ? (
                            <>
                                <div className='flex justify-between'>
                                    <span>Subtotal:</span>
                                    <span>{formatMoney(sale.subtotal || sale.total + sale.discountTotal, locale, currencyCode)}</span>
                                </div>
                                <div className='flex justify-between text-green-700'>
                                    <span>(-) Descuentos:</span>
                                    <span>-{formatMoney(sale.discountTotal, locale, currencyCode)}</span>
                                </div>
                            </>
                        ) : null}
                        {sale.hasReturns && (
                            <>
                                <div className='flex justify-between text-orange-700'>
                                    <span>(-) Devoluciones:</span>
                                    <span>-{formatMoney(sale.totalReturned || 0, locale, currencyCode)}</span>
                                </div>
                                <div className='flex justify-between text-lg font-bold border-t pt-2 text-green-700'>
                                    <span>Total Neto:</span>
                                    <span>{formatMoney(sale.adjustedTotal || sale.total, locale, currencyCode)}</span>
                                </div>
                            </>
                        )}
                        {sale.payment === 'Efectivo' && (
                            <>
                                <div className='flex justify-between'>
                                    <span>Monto Recibido:</span>
                                    <span>{formatMoney(sale.amountReceived, locale, currencyCode)}</span>
                                </div>
                                <div className='flex justify-between font-bold'>
                                    <span>Vuelto:</span>
                                    <span>{formatMoney(sale.change, locale, currencyCode)}</span>
                                </div>
                            </>
                        )}
                        {!sale.hasReturns && (
                            <div className='flex justify-between text-lg font-bold border-t pt-2'>
                                <span>Total</span>
                                <span>{formatMoney(sale.total, locale, currencyCode)}</span>
                            </div>
                        )}
                    </div>

                    {/* Return / Exchange Buttons - solo si tiene permiso returns.manage */}
                    {sale.status === 'completed' && canManageReturns && (
                        <div className='pt-4 border-t grid grid-cols-2 gap-2'>
                            <Button
                                variant='outline'
                                className='text-orange-600 border-orange-300 hover:bg-orange-50'
                                onClick={() => {
                                    onOpenChange(false)
                                    navigate(`/returns/new?sale_id=${sale.reference ?? sale.id}`)
                                }}
                            >
                                <RotateCcw className='w-4 h-4 mr-2' />Devolución
                            </Button>
                            <Button
                                variant='outline'
                                className='text-blue-600 border-blue-300 hover:bg-blue-50'
                                onClick={() => {
                                    onOpenChange(false)
                                    navigate(`/returns/new?sale_id=${sale.reference ?? sale.id}&mode=exchange`)
                                }}
                            >
                                <RefreshCw className='w-4 h-4 mr-2' />Cambio
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
