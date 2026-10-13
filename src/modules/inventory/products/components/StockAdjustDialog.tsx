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
 * StockAdjustDialog - Dialog for adjusting product stock
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PackagePlus, PackageMinus } from 'lucide-react'
import type { Product } from '@/types/product'
import type { StockAdjustment } from '../types'

interface StockAdjustDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    adjustment: StockAdjustment
    onAdjustmentChange: (field: keyof StockAdjustment, value: string) => void
    onConfirm: () => void
    isLoading: boolean
}

export const StockAdjustDialog = ({
    open,
    onOpenChange,
    product,
    adjustment,
    onAdjustmentChange,
    onConfirm,
    isLoading
}: StockAdjustDialogProps) => {
    if (!product) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ajustar Stock</DialogTitle>
                    <DialogDescription className="sr-only">
                        Sumar o restar unidades del stock de este producto, con motivo del ajuste.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <h3 className="font-medium">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">Stock actual: {product.stock} unidades</p>
                    </div>

                    <div>
                        <Label>Tipo de Ajuste</Label>
                        <div className="flex space-x-2 mt-2">
                            <Button
                                variant={adjustment.type === 'add' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onAdjustmentChange('type', 'add')}
                                className="flex-1"
                            >
                                <PackagePlus className="w-4 h-4 mr-2" />
                                Agregar
                            </Button>
                            <Button
                                variant={adjustment.type === 'remove' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onAdjustmentChange('type', 'remove')}
                                className="flex-1"
                            >
                                <PackageMinus className="w-4 h-4 mr-2" />
                                Quitar
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="amount">Cantidad</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="Ingrese cantidad"
                            value={adjustment.amount}
                            onChange={(e) => onAdjustmentChange('amount', e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="reason">Motivo</Label>
                        <Textarea
                            id="reason"
                            placeholder="Ej: Recepción de mercancía, producto dañado, etc."
                            value={adjustment.reason}
                            onChange={(e) => onAdjustmentChange('reason', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex space-x-2">
                        <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    Ajustando...
                                </>
                            ) : (
                                'Confirmar Ajuste'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
