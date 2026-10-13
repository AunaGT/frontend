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
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
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
        return <LoadingState variant="table" message="Cargando cierres…" />
    }

    if (!Array.isArray(closures) || closures.length === 0) {
        return <p className="text-center text-muted-foreground py-8">No hay cierres registrados</p>
    }

    return (
        <>
            <div className="auna-data-table-shell auna-surface rounded-xl border overflow-x-auto" role="region" aria-label="Cierres registrados" tabIndex={0}>
              <table className="auna-data-table cash-closure-history-table">
                <caption className="sr-only">Historial de cierres de caja</caption>
                <thead><tr>
                  <th scope="col">Cierre</th><th scope="col">Período</th><th scope="col">Caja</th><th scope="col">Cajero</th>
                  <th scope="col" className="cash-closure-money">Total esperado</th><th scope="col" className="cash-closure-money">Total contado</th>
                  <th scope="col" className="cash-closure-money">Diferencia</th><th scope="col">Estado</th><th scope="col" className="text-right">Acciones</th>
                </tr></thead>
                <tbody>
                {closures.map((closure) => (
                    <tr key={closure.id}>
                      <th scope="row"><Button variant="link" className="h-auto p-0 font-semibold" onClick={() => onViewClosure(closure.id)}>Cierre #{closure.closure_number}</Button></th>
                      <td><span className="block whitespace-nowrap">{formatDateTime(closure.start_date)}</span><span className="block whitespace-nowrap text-xs text-muted-foreground">Hasta {formatDateTime(closure.end_date)}</span></td>
                      <td>{closureRegisterName(closure)}</td>
                      <td>{closure.cashier_name}</td>
                      <td className="cash-closure-money">{formatCurrency(closure.theoretical_total, currencyCode, locale)}</td>
                      <td className="cash-closure-money font-semibold">{formatCurrency(closure.actual_total, currencyCode, locale)}</td>
                      <td className={`cash-closure-money ${toNumber(closure.difference) === 0 ? 'text-emerald-700 dark:text-emerald-300' : toNumber(closure.difference) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                        {toNumber(closure.difference) > 0 ? '+' : ''}{formatCurrency(closure.difference, currencyCode, locale)}
                      </td>
                      <td>{getStatusBadge(closure.status)}</td>
                      <td className="text-right"><Button variant="outline" size="icon" aria-label={`Ver cierre #${closure.closure_number}`} onClick={() => onViewClosure(closure.id)}><Eye className="h-4 w-4" aria-hidden="true" /></Button></td>
                    </tr>
                ))}
                </tbody>
              </table>
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
