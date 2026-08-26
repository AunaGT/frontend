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
 * ProductDetailDialog - Dialog for viewing product details
 */
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QrCode } from 'lucide-react'
import type { Product } from '@/types/product'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

interface ProductDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
}

const getStatusBadge = (product: Product) => {
    if (product.stock === 0 || product.status === 'out_of_stock') {
        return <Badge variant="destructive">Sin Stock</Badge>
    } else if (product.stock <= product.minStock || product.status === 'low_stock') {
        return <Badge className="bg-liquor-amber text-liquor-bronze">Stock Bajo</Badge>
    } else {
        return <Badge className="bg-liquor-gold text-liquor-bronze">Disponible</Badge>
    }
}

export const ProductDetailDialog = ({
    open,
    onOpenChange,
    product
}: ProductDetailDialogProps) => {
    const { hasPermission } = useAuthPermissions()
    const canCreateProducts = hasPermission('products.create')

    if (!product) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* max-h y overflow para que en móvil/escritorio el contenido no empuje la X fuera de la pantalla */}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detalle del Producto</DialogTitle>
                    <DialogDescription className="sr-only">
                        Información completa del producto: precio, stock, categoría y proveedor.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {product.imageUrl && (
                        <div className="w-full rounded-md overflow-hidden border border-border bg-muted flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full max-h-64 object-contain"
                            />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Nombre</Label>
                            <div className="font-medium">{product.name}</div>
                        </div>
                        <div>
                            <Label>Categoría</Label>
                            <div><Badge variant="outline">{String(product.category)}</Badge></div>
                        </div>
                        <div>
                            <Label>Marca</Label>
                            <div className="font-medium">{product.brand}</div>
                        </div>
                        <div>
                            <Label>Tamaño</Label>
                            <div className="font-medium">{product.size}</div>
                        </div>
                        <div>
                            <Label>Precio de Venta</Label>
                            <div className="font-medium text-primary">Q {product.price.toFixed(2)}</div>
                        </div>
                        {canCreateProducts && (
                            <div>
                                <Label>Costo</Label>
                                <div className="font-medium">Q {product.cost.toFixed(2)}</div>
                            </div>
                        )}
                        <div>
                            <Label>Stock Actual</Label>
                            <div className="font-medium">{product.stock} unidades</div>
                        </div>
                        <div>
                            <Label>Stock Mínimo</Label>
                            <div className="font-medium">{product.minStock} unidades</div>
                        </div>
                    </div>

                    <div>
                        <Label>Proveedor</Label>
                        <div className="font-medium">{product.supplier}</div>
                    </div>

                    <div>
                        <Label>Código de Barras</Label>
                        <div className="flex items-center space-x-2">
                            <code className="bg-muted px-2 py-1 rounded">{product.barcode}</code>
                            <QrCode className="w-6 h-6 text-muted-foreground" />
                        </div>
                    </div>

                    {product.description && (
                        <div>
                            <Label>Descripción</Label>
                            <div className="text-muted-foreground">{product.description}</div>
                        </div>
                    )}

                    <div>
                        <Label>Estado</Label>
                        <div>{getStatusBadge(product)}</div>
                    </div>

                    {canCreateProducts && (
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Margen de Ganancia:</span>
                                    <div className="font-medium">
                                        Q {(product.price - product.cost).toFixed(2)} (
                                        {(((product.price - product.cost) / product.price) * 100).toFixed(1)}%)
                                    </div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Valor de Inventario:</span>
                                    <div className="font-medium">Q {(product.stock * product.cost).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
