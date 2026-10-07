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
 * ClosuresHistoryList - List of historical cash closures
 */
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { CashClosure } from '../types'
import { formatCurrency, formatDateTime, toNumber, closureRegisterName } from '../types'

interface ClosuresHistoryListProps {
    closures: CashClosure[]
    isLoading: boolean
    isSeller: boolean
    currentPage: number
    totalPages: number
    onViewClosure: (closureId: string) => void
    onPageChange: (page: number) => void
}

const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        'Pendiente': 'secondary',
        'Aprobado': 'default',
        'Rechazado': 'destructive',
        'Validado': 'outline',  // legacy
        'Cerrado': 'outline'    // legacy
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
}

export const ClosuresHistoryList = ({
    closures,
    isLoading,
    isSeller,
    currentPage,
    totalPages,
    onViewClosure,
    onPageChange
}: ClosuresHistoryListProps) => {
    const { currencyCode, locale } = useSystemSettings()
    if (isLoading) {
        return <LoadingState variant="cards" message="Cargando cierres…" />
    }

    if (!Array.isArray(closures) || closures.length === 0) {
        return <p className="text-center text-muted-foreground py-8">No hay cierres registrados</p>
    }

    return (
        <>
            <div className="auna-section-list auna-surface rounded-xl border px-4">
                {closures.map((closure) => (
                    <div
                        key={closure.id}
                        role="button"
                        tabIndex={0}
                        className="auna-section-row auna-section-row-interactive flex items-center justify-between py-4 transition-colors cursor-pointer"
                        onClick={() => onViewClosure(closure.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onViewClosure(closure.id)
                            }
                        }}
                    >
                        <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">Cierre #{closure.closure_number}</span>
                                {getStatusBadge(closure.status)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p>{formatDateTime(closure.start_date)} - {formatDateTime(closure.end_date)}</p>
                                <p>Cajero: {closure.cashier_name} · Caja: {closureRegisterName(closure)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                                <p className="font-bold">{formatCurrency(closure.actual_total, currencyCode, locale)}</p>
                                <p className={`text-sm ${toNumber(closure.difference) === 0 ? 'text-green-600' : toNumber(closure.difference) > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                    {toNumber(closure.difference) >= 0 ? '+' : ''}{formatCurrency(closure.difference, currencyCode, locale)}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {!isSeller && totalPages > 1 && (
                <div className="auna-pagination-outside">
                    <div className="auna-data-table-pagination">
                        <span className="text-sm text-muted-foreground mr-2">
                            Página {currentPage} de {totalPages}
                        </span>
                        <nav className="flex items-center gap-2" aria-label="Paginación de cierres">
                            <Button
                                variant="outline"
                                size="sm"
                                aria-label="Página anterior"
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                aria-label="Página siguiente"
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </nav>
                    </div>
                </div>
            )}
        </>
    )
}
