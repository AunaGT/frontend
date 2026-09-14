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
 * AvailabilityDialog - Dialog for handling product stock availability
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AvailabilityDialogState } from '../types'

interface AvailabilityDialogProps {
    state: AvailabilityDialogState
    additionalQty: string
    onAdditionalQtyChange: (value: string) => void
    onConfirm: () => void
    onCancel: () => void
}

export const AvailabilityDialog = ({
    state,
    additionalQty,
    onAdditionalQtyChange,
    onConfirm,
    onCancel
}: AvailabilityDialogProps) => {
    return (
        <Dialog open={state.open} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Producto sin stock suficiente</DialogTitle>
                    <DialogDescription>
                        El producto <strong>"{state.product?.name}"</strong> no tiene suficiente stock en el sistema.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-muted p-3 rounded-md space-y-1">
                        <div className="flex justify-between text-sm">
                            <span>Stock en sistema:</span>
                            <span className="font-medium">{state.availableStock} unidades</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Cantidad solicitada:</span>
                            <span className="font-medium text-orange-600">{state.requestedQty} unidades</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-1 mt-1">
                            <span>Faltante:</span>
                            <span className="font-medium text-red-600">
                                {Math.max(0, state.requestedQty - state.availableStock)} unidades
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="additional-qty" className="text-sm font-medium">
                            ¿Cuántas unidades adicionales hay disponibles físicamente?
                        </Label>
                        <Input
                            id="additional-qty"
                            type="number"
                            min="1"
                            placeholder="Ej: 5"
                            value={additionalQty}
                            onChange={(e) => onAdditionalQtyChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                            className="text-center text-lg"
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                            Total disponible: {state.availableStock} + {additionalQty || '0'} = <strong>{state.availableStock + (parseInt(additionalQty) || 0)}</strong> unidades
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button onClick={onConfirm}>
                        Continuar con Autorización
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
