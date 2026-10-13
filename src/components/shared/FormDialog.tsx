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
 * FormDialog - Reusable dialog for create/edit forms
 */
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface FormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children: React.ReactNode
    onSubmit: (e: React.FormEvent) => void | Promise<void>
    submitText?: string
    cancelText?: string
    loading?: boolean
    submitDisabled?: boolean
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    appearance?: 'default' | 'auna'
}

export const FormDialog = ({
    open,
    onOpenChange,
    title,
    description,
    children,
    onSubmit,
    submitText = 'Guardar',
    cancelText = 'Cancelar',
    loading = false,
    submitDisabled = false,
    maxWidth = 'md',
    appearance = 'default',
}: FormDialogProps) => {
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await onSubmit(e)
    }

    const maxWidthClass = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
    }[maxWidth]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant={appearance} className={`${maxWidthClass} max-h-[90vh] overflow-y-auto`}>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && (
                            <DialogDescription>{description}</DialogDescription>
                        )}
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {children}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            {cancelText}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || submitDisabled}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                submitText
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
