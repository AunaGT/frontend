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
 * DetailDialog - Reusable dialog for viewing item details
 */
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface DetailField {
    label: string
    value: React.ReactNode
    fullWidth?: boolean
}

interface DetailSection {
    title?: string
    fields: DetailField[]
}

interface DetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    sections: DetailSection[]
    footer?: React.ReactNode
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
}

export const DetailDialog = ({
    open,
    onOpenChange,
    title,
    sections,
    footer,
    maxWidth = 'lg',
}: DetailDialogProps) => {
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
            <DialogContent className={`${maxWidthClass} max-h-[90vh] overflow-y-auto`}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">Detalle de {title}.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {sections.map((section, sectionIndex) => (
                        <div key={sectionIndex}>
                            {section.title && (
                                <>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-3">
                                        {section.title}
                                    </h4>
                                    <Separator className="mb-4" />
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                {section.fields.map((field, fieldIndex) => (
                                    <div
                                        key={fieldIndex}
                                        className={field.fullWidth ? 'col-span-2' : ''}
                                    >
                                        <Label className="text-muted-foreground text-xs">
                                            {field.label}
                                        </Label>
                                        <div className="mt-1">{field.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {footer && (
                    <div className="mt-6 pt-4 border-t">
                        {footer}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
