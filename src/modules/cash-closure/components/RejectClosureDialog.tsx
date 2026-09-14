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
 * RejectClosureDialog - Dialog for rejecting a closure
 */
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X, ThumbsDown } from 'lucide-react'

interface RejectClosureDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    reason: string
    onReasonChange: (reason: string) => void
    onConfirm: () => void
}

export const RejectClosureDialog = ({
    open,
    onOpenChange,
    reason,
    onReasonChange,
    onConfirm
}: RejectClosureDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rechazar Cierre de Caja</DialogTitle>
                    <DialogDescription className="sr-only">
                        Escribe el motivo del rechazo de este cierre de caja.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="rejection-reason">Razón del Rechazo *</Label>
                        <Textarea
                            id="rejection-reason"
                            value={reason}
                            onChange={(e) => onReasonChange(e.target.value)}
                            placeholder="Explica por qué se rechaza este cierre..."
                            rows={4}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false)
                                onReasonChange('')
                            }}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={!reason.trim()}
                        >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Confirmar Rechazo
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
