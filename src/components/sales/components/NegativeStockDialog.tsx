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
 * NegativeStockDialog - Dialog showing products with negative stock
 */
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import type { NegativeStockDialogState } from '../types'

interface NegativeStockDialogProps {
    state: NegativeStockDialogState
    onClose: () => void
    onGoToInventory: () => void
}

export const NegativeStockDialog = ({
    state,
    onClose,
    onGoToInventory
}: NegativeStockDialogProps) => {
    return (
        <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        No se puede generar el Cierre de Caja
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Lista de productos con stock negativo que deben corregirse antes de generar el cierre de caja.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            Hay {state.products.length} producto(s) con stock negativo que deben ser corregidos antes de realizar el cierre de caja.
                            <br />
                            <strong>Por favor, ajusta el inventario de estos productos primero.</strong>
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Productos con stock negativo:</h4>
                        <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                            {state.products.map((product) => (
                                <div key={product.id} className="p-3 hover:bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium">{product.name}</p>
                                            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                                <span>Categoría: {product.category}</span>
                                                <span>Proveedor: {product.supplier}</span>
                                                {product.barcode && <span>Código: {product.barcode}</span>}
                                            </div>
                                        </div>
                                        <Badge variant="destructive" className="ml-4">
                                            Stock: {product.current_stock}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="font-semibold text-sm text-blue-900 mb-2">¿Cómo corregir el stock?</h5>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Ve al módulo de <strong>Inventario</strong> o <strong>Productos</strong></li>
                            <li>Busca cada producto listado arriba</li>
                            <li>Haz clic en "Ajustar Stock" para cada producto</li>
                            <li>Ingresa la cantidad correcta de stock disponible</li>
                            <li>Una vez corregidos todos, regresa aquí para generar el cierre</li>
                        </ol>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button onClick={onGoToInventory}>
                        Ir a Inventario
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
