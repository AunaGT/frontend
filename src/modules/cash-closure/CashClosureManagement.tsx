import { TABLE_PAGE_SIZES } from '@/utils/pagination'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Listado e historial de cierres de caja. El registro de un nuevo cierre está en /cierre-caja/nuevo.
 */

import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Info, RotateCcw } from 'lucide-react'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useCashClosureForm, useCashClosureAPI, useMineClosureGate, canRegisterMineClosure, mineClosureBlockedHint } from './hooks'
import { ClosuresHistoryList } from './components'
import { CASH_CLOSURE_CREATE_PATH } from './CashClosureCreatePage'
import { readListUiPersisted } from '@/hooks/usePersistedListUiState'
import './cash-closure-workflow.css'

const CashClosureManagement = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const { timezone } = useSystemSettings()

  const form = useCashClosureForm()
  const api = useCashClosureAPI()

  const canCreateDay = hasPermission('cashclosure.create') || hasPermission('cashclosure.create_day')
  const canCreateOwn = hasPermission('cashclosure.create') || hasPermission('cashclosure.create_own')
  const canCreateClosure = canCreateDay || canCreateOwn

  const { gate: mineClosureGate, refresh: refreshMineClosureGate, isRefreshing } = useMineClosureGate({
    enabled: canCreateOwn,
    userId: user?.id,
    timezone,
  })

  const needsShiftForCreate = canCreateOwn && !canCreateDay
  const canOpenCreate =
    canCreateClosure &&
    (canCreateDay && !canCreateOwn ? true : canRegisterMineClosure(mineClosureGate))

  const [historyStatus, setHistoryStatus] = useState('')
  const [historyStartDate, setHistoryStartDate] = useState('')
  const [historyEndDate, setHistoryEndDate] = useState('')
  const activeHistoryFilters = [historyStatus, historyStartDate, historyEndDate].filter(Boolean).length

  const clearHistoryFilters = () => {
    setHistoryStatus('')
    setHistoryStartDate('')
    setHistoryEndDate('')
  }

  const historyFilterSigRef = useRef<string | null>(null)
  const historyFirstLoadRef = useRef(true)

  useEffect(() => {
    const filters =
      historyStatus || historyStartDate || historyEndDate
        ? {
            status: historyStatus || undefined,
            startDate: historyStartDate || undefined,
            endDate: historyEndDate || undefined,
          }
        : undefined
    const sig = JSON.stringify({
      st: filters?.status ?? '',
      sd: filters?.startDate ?? '',
      ed: filters?.endDate ?? '',
    })
    let page = 1
    if (historyFirstLoadRef.current) {
      historyFirstLoadRef.current = false
      const s = readListUiPersisted('cierre-caja/historial')
      page = Math.max(1, Number(s.page) || 1)
    } else if (historyFilterSigRef.current !== sig) {
      page = 1
    } else {
      page = api.currentPage
    }
    historyFilterSigRef.current = sig
    void api.fetchClosures(page, form.isSeller, undefined, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyStatus, historyStartDate, historyEndDate])

  const handleViewClosure = (closureId: string) => {
    navigate(`/cierre-caja/${closureId}`)
  }

  const canViewHistory = hasPermission('cashclosure.view')

  const createBlockedHint =
    needsShiftForCreate || canCreateOwn
      ? mineClosureGate.loading
        ? 'Comprobando turno en caja…'
        : !canRegisterMineClosure(mineClosureGate)
          ? mineClosureGate.reason === 'error'
            ? 'No se pudo verificar el turno. Reintenta la consulta; no necesitas abrir otro turno.'
            : mineClosureBlockedHint(mineClosureGate.reason)
          : null
      : null

  const pageActions = <>{canCreateClosure && (
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <Button
              asChild={canOpenCreate}
              disabled={!canOpenCreate}
            >
              {canOpenCreate ? (
                <Link to={CASH_CLOSURE_CREATE_PATH}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar cierre
                </Link>
              ) : (
                <span>
                  <Plus className="h-4 w-4 mr-2 inline" />
                  Registrar cierre
                </span>
              )}
            </Button>
            {createBlockedHint && (
              <p className="text-xs text-muted-foreground max-w-xs text-right">{createBlockedHint}</p>
            )}
            {mineClosureGate.reason === 'error' && <Button variant="outline" size="sm" onClick={refreshMineClosureGate} disabled={isRefreshing}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {isRefreshing ? 'Verificando turno…' : 'Reintentar'}
            </Button>}
          </div>
        )}</>
  return (
    <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">
      <h1 className="sr-only">Cierre de caja</h1>
      {!canViewHistory && <div className="auna-page-toolbar"><div className="compact-filter-actions">{pageActions}</div></div>}

      {canViewHistory && (
        <section className="space-y-5" aria-label="Historial de cierres">
              <MetricStrip label="Resumen de cierres" loading={api.isLoadingClosures} items={([['total', 'Cierres'], ['Pendiente', 'Pendientes'], ['Aprobado', 'Aprobados'], ['Rechazado', 'Rechazados']] as const).map(([key, label]) => ({ label, value: api.closureSummary?.[key] ?? '—' }))} />
              {form.isSeller && <div className="auna-page-toolbar"><div className="compact-filter-actions">{pageActions}</div></div>}

              {!form.isSeller && (
                <CompactFilterPanel actions={pageActions} title="Filtros de cierres" activeCount={activeHistoryFilters} onClear={clearHistoryFilters} appliedFilters={[...(historyStatus ? [{label: `Estado: ${historyStatus}`,onRemove: () => setHistoryStatus('')}] : []),...(historyStartDate ? [{label: `Desde: ${historyStartDate}`,onRemove: () => setHistoryStartDate('')}] : []),...(historyEndDate ? [{label: `Hasta: ${historyEndDate}`,onRemove: () => setHistoryEndDate('')}] : [])]} search={<div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Por página:</span>
                    <Select
                      value={String(api.pageSize)}
                      onValueChange={(v) => {
                        const n = Number(v)
                        api.setPageSize(n)
                        const f =
                          historyStatus || historyStartDate || historyEndDate
                            ? {
                                status: historyStatus || undefined,
                                startDate: historyStartDate || undefined,
                                endDate: historyEndDate || undefined,
                              }
                            : undefined
                        api.fetchClosures(1, form.isSeller, n, f)
                      }}
                    >
                      <SelectTrigger aria-label="Cierres por página" className="w-[72px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_PAGE_SIZES.map((num) => (
                          <SelectItem key={num} value={String(num)}>
                            {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>}>
                  <div className="space-y-1">
                    <Label htmlFor="closure-status" className="text-xs">Estado</Label>
                    <Select
                      value={historyStatus || 'all'}
                      onValueChange={(v) => setHistoryStatus(v === 'all' ? '' : v)}
                    >
                      <SelectTrigger id="closure-status" className="w-[140px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                        <SelectItem value="Aprobado">Aprobado</SelectItem>
                        <SelectItem value="Rechazado">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="closure-from" className="text-xs">Desde</Label>
                    <input
                      id="closure-from"
                      type="date"
                      className="auna-control flex w-[140px] px-3 py-1"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="closure-to" className="text-xs">Hasta</Label>
                    <input
                      id="closure-to"
                      type="date"
                      className="auna-control flex w-[140px] px-3 py-1"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                    />
                  </div>
                </CompactFilterPanel>
              )}
              {canCreateClosure && canCreateOwn && <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                {canOpenCreate ? 'Hay un turno cerrado pendiente de arqueo. Registra su cierre para verificar los montos.' : createBlockedHint || 'Para registrar un cierre, finaliza primero el turno desde Nueva venta.'}
              </p>}
              <h2 className="text-sm font-semibold">{form.isSeller ? 'Último cierre de caja' : 'Cierres registrados'}</h2>
              <ClosuresHistoryList
                closures={api.closures}
                isLoading={api.isLoadingClosures}
                isSeller={form.isSeller}
                currentPage={api.currentPage}
                totalPages={api.totalPages}
                filtered={activeHistoryFilters > 0}
                onReset={clearHistoryFilters}
                onViewClosure={handleViewClosure}
                onPageChange={(page) => {
                  const f =
                    historyStatus || historyStartDate || historyEndDate
                      ? {
                          status: historyStatus || undefined,
                          startDate: historyStartDate || undefined,
                          endDate: historyEndDate || undefined,
                        }
                      : undefined
                  api.fetchClosures(page, form.isSeller, undefined, f)
                }}
              />
        </section>
      )}
    </div>
  )
}

export default CashClosureManagement
