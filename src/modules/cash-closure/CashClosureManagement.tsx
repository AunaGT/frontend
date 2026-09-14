/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Listado e historial de cierres de caja. El registro de un nuevo cierre está en /cierre-caja/nuevo.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Plus, Calculator } from 'lucide-react'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useCashClosureForm, useCashClosureAPI, useMineClosureGate, canRegisterMineClosure, mineClosureBlockedHint } from './hooks'
import { ClosuresHistoryList } from './components'
import { CASH_CLOSURE_CREATE_PATH } from './CashClosureCreatePage'
import { readListUiPersisted } from '@/hooks/usePersistedListUiState'

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

  const { gate: mineClosureGate } = useMineClosureGate({
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
          ? mineClosureBlockedHint(mineClosureGate.reason)
          : null
      : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cierre de caja</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Historial de arqueos. Para registrar un cierre, use el turno ya cerrado en «Nueva venta».
          </p>
        </div>
        {canCreateClosure && (
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <Button
              asChild={canOpenCreate}
              disabled={!canOpenCreate}
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
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
          </div>
        )}
      </div>

      {canCreateClosure && canCreateOwn && (
        <Card className="border-dashed">
          <CardContent className="py-4 flex items-start gap-3">
            <Calculator className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              {canOpenCreate ? (
                <>
                  Hay un turno cerrado pendiente de arqueo. Pulse <strong>Registrar cierre</strong> para contar
                  efectivo y cuadrar el turno.
                </>
              ) : (
                <>
                  No hay turno cerrado pendiente de arqueo. Abra caja en «Nueva venta», venda, cierre el turno y
                  vuelva aquí.
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {canViewHistory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              {form.isSeller ? 'Último cierre de caja' : 'Historial de cierres'}
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Haz clic en un cierre para ver el detalle, descargar PDF o aprobar / rechazar según tu rol.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!form.isSeller && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Select
                      value={historyStatus || 'all'}
                      onValueChange={(v) => setHistoryStatus(v === 'all' ? '' : v)}
                    >
                      <SelectTrigger className="w-[140px] h-9">
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
                    <Label className="text-xs">Desde</Label>
                    <input
                      type="date"
                      className="flex h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <input
                      type="date"
                      className="flex h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
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
                      <SelectTrigger className="w-[72px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 25, 50, 100].map((num) => (
                          <SelectItem key={num} value={String(num)}>
                            {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <ClosuresHistoryList
                closures={api.closures}
                isLoading={api.isLoadingClosures}
                isSeller={form.isSeller}
                currentPage={api.currentPage}
                totalPages={api.totalPages}
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CashClosureManagement
