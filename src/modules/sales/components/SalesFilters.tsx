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
 * SalesFilters - Filter bar for sales list
 */
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { SaleStatusKey } from '../types'
import type { ReactNode } from 'react'

const PERIOD_LABELS: Record<string, string> = { today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', all: 'Todo el historial' }

interface SalesFiltersProps {
    actions?: ReactNode
    searchTerm: string
    onSearchChange: (value: string) => void
    statusFilter: SaleStatusKey | 'all'
    onStatusChange: (value: SaleStatusKey | 'all') => void
    paymentFilter: string
    onPaymentChange: (value: string) => void
    period?: string
    onPeriodChange?: (value: string) => void
    paymentMethods?: readonly { id: number | string; name: string; is_credit?: boolean }[]
    paymentMethodsLoading?: boolean
    showStatusFilter?: boolean
    isGlobalSearch?: boolean
    searchHint?: string | null
}

export const SalesFilters = ({
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusChange,
    paymentFilter,
    onPaymentChange,
    isGlobalSearch = false,
    searchHint = null,
    period = 'today', onPeriodChange, paymentMethods, paymentMethodsLoading = false, showStatusFilter = true, actions,
}: SalesFiltersProps) => {
    const methods = paymentMethods ?? ['Efectivo', 'Tarjeta', 'Transferencia'].map(name => ({ id: name, name, is_credit: false }))
    const appliedFilters = [
        ...(isGlobalSearch && !searchHint && searchTerm.trim() ? [{label: `Búsqueda: ${searchTerm}`,onRemove: () => onSearchChange('')}] : []),
        ...(statusFilter !== 'all' ? [{label: `Estado: ${({completed:'Completado',cancelled:'Cancelado'} as Record<string,string>)[statusFilter] || statusFilter}`,onRemove: () => onStatusChange('all')}] : []),
        ...(paymentFilter !== 'all' ? [{label: `Pago: ${paymentFilter}`,onRemove: () => onPaymentChange('all')}] : []),
        ...(onPeriodChange && period !== 'today' ? [{label: `Período: ${PERIOD_LABELS[period] || period}`,onRemove: () => onPeriodChange('today')}] : []),
    ]
    return <div className="space-y-2"><CompactFilterPanel actions={actions} title="Filtros de ventas" activeCount={appliedFilters.length} appliedFilters={appliedFilters} onClear={() => {onSearchChange('');onStatusChange('all');onPaymentChange('all');onPeriodChange?.('today')}} search={
        <div className="space-y-2"><Label htmlFor="sales-search">Buscar</Label><div className="relative min-w-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="sales-search" aria-label="Buscar ventas" placeholder="Cliente, folio o ID fiscal…" value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="pl-10" /></div></div>
    }>
        {showStatusFilter && <div className="space-y-2"><Label>Estado</Label><Select value={statusFilter} onValueChange={(v: SaleStatusKey | 'all') => onStatusChange(v)}><SelectTrigger aria-label="Estado de venta"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="completed">Completado</SelectItem><SelectItem value="cancelled">Cancelado</SelectItem></SelectContent></Select></div>}
        {onPeriodChange && <div className="space-y-2"><Label>Período</Label><Select value={period} onValueChange={onPeriodChange}><SelectTrigger aria-label="Período de ventas"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PERIOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
        <div className="space-y-2"><Label>Método de pago</Label><Select value={paymentFilter} onValueChange={onPaymentChange} disabled={paymentMethodsLoading}><SelectTrigger aria-label="Método de pago"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los métodos</SelectItem>{methods.map(method => <SelectItem key={method.id} value={method.name}>{method.is_credit ? `A crédito · ${method.name}` : method.name}</SelectItem>)}</SelectContent></Select></div>
    </CompactFilterPanel>{searchHint ? <p className="text-xs text-amber-700 dark:text-amber-400">{searchHint}</p> : isGlobalSearch ? <p className="text-xs text-muted-foreground">La búsqueda consulta todo el historial; el resumen mantiene el período seleccionado.</p> : null}</div>
}
