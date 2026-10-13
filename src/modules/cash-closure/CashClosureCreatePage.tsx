/**
 * Registro de un nuevo cierre de caja (wizard completo).
 */

import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Calculator, ChevronDown, Save, Settings2, RotateCcw } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useCashClosureForm, useCashClosureAPI, useMineClosureGate, mineClosureBlockedHint } from './hooks'
import {
  TheoreticalSummary,
  PaymentMethodsForm,
  DenominationsCounter,
  ClosureSummaryCard,
} from './components'
import { isCashPaymentMethodName } from './types'
import { fetchCashSessionCurrent } from '@/services/cashSessionsService'
import { useExperienceProfile } from '@/hooks/useExperienceProfile'
import './cash-closure-workflow.css'

export const CASH_CLOSURE_CREATE_PATH = '/cierre-caja/nuevo'

export function CashClosureCreatePage() {
  usePageTrail([{ label: 'Cierre de caja', to: '/cierre-caja' }, { label: 'Nuevo cierre' }])
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const { showAdvancedByDefault } = useExperienceProfile()
  const { currencyCode, locale, cashClosureMaxDiffPct, timezone } = useSystemSettings()

  const form = useCashClosureForm()
  const api = useCashClosureAPI()

  const canCreateDay = hasPermission('cashclosure.create') || hasPermission('cashclosure.create_day')
  const canCreateOwn = hasPermission('cashclosure.create') || hasPermission('cashclosure.create_own')
  const showClosureTypeSelector = canCreateDay && canCreateOwn

  const [closureScope, setClosureScope] = useState<'day' | 'mine'>(() =>
    canCreateDay && !canCreateOwn ? 'day' : 'mine'
  )
  const effectiveScope = showClosureTypeSelector ? closureScope : canCreateDay ? 'day' : 'mine'

  const { setStartDate, setEndDate } = form

  const onSessionDates = useCallback(
    (dates: { startDate: string; endDate: string }) => {
      setStartDate(dates.startDate)
      setEndDate(dates.endDate)
    },
    [setStartDate, setEndDate]
  )

  const { gate: mineClosureGate, refresh: refreshMineClosureGate, isRefreshing } = useMineClosureGate({
    enabled: effectiveScope === 'mine',
    userId: user?.id,
    timezone,
    onSessionDates,
  })

  const [showConfirmSaveDialog, setShowConfirmSaveDialog] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(showAdvancedByDefault)
  const [showDifferenceReason, setShowDifferenceReason] = useState(false)
  const [countedPaymentMethodIds, setCountedPaymentMethodIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (effectiveScope !== 'day') return
    void api.getLastClosureDate('day').then((result) => {
      if (result?.suggestedStart && result?.suggestedEnd) {
        form.setStartDate(result.suggestedStart)
        form.setEndDate(result.suggestedEnd)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScope])

  const handleCalculateTheoretical = async () => {
    const cashierId = effectiveScope === 'mine' ? (user?.id ?? undefined) : undefined
    let cashRegisterSessionId: string | undefined
    if (effectiveScope === 'mine') {
      if (!mineClosureGate.canCalculate || mineClosureGate.loading || !mineClosureGate.closableSessionId) {
        toast({
          title: 'No puede calcular ahora',
          description: mineClosureBlockedHint(mineClosureGate.reason),
          variant: 'destructive',
        })
        return
      }
      const r = await fetchCashSessionCurrent()
      if (!r.ok) {
        toast({ title: 'No se pudo verificar el turno', description: r.message, variant: 'destructive' })
        refreshMineClosureGate()
        return
      }
      if (r.session?.status === 'OPEN') {
        toast({
          title: 'Caja con turno abierto',
          description:
            'Mientras haya turno abierto en esta caja no se calcula el cierre. Use «Fin de turno» en «Nueva venta».',
          variant: 'destructive',
        })
        refreshMineClosureGate()
        return
      }
      const cs = r.closableSession
      if (!cs?.id || cs.status !== 'CLOSED' || cs.cash_closure_id) {
        toast({
          title: 'Sin turno listo para arqueo',
          description: 'No hay turno cerrado pendiente de cierre contable, o ya fue arqueado.',
          variant: 'destructive',
        })
        refreshMineClosureGate()
        return
      }
      if (String(cs.opened_by_id) !== String(user?.id)) {
        toast({
          title: 'Sesión no válida',
          description: 'Solo puede arquear su propio turno en esta caja.',
          variant: 'destructive',
        })
        refreshMineClosureGate()
        return
      }
      cashRegisterSessionId = cs.id
    }
    const data = await api.calculateTheoretical(form.startDate, form.endDate, cashierId, cashRegisterSessionId)
    if (data) {
      form.initializeFromTheoretical(data)
      setCountedPaymentMethodIds(new Set())
      setShowDifferenceReason(false)
    }
  }

  const performSaveClosure = async () => {
    if (!api.theoreticalData) return false
    let cashRegisterSessionId: string | undefined
    if (effectiveScope === 'mine') {
      const r = await fetchCashSessionCurrent()
      if (!r.ok) {
        toast({ title: 'No se pudo verificar el turno', description: r.message, variant: 'destructive' })
        return false
      }
      if (r.session?.status === 'OPEN') {
        toast({
          title: 'Caja con turno abierto',
          description: 'Cierre el turno en «Nueva venta» antes de guardar el arqueo.',
          variant: 'destructive',
        })
        refreshMineClosureGate()
        return false
      }
      const cs = r.closableSession
      if (!cs?.id || cs.status !== 'CLOSED' || cs.cash_closure_id) {
        toast({
          title: 'No hay turno para vincular',
          description: 'El turno ya no está disponible para este cierre. Recalcule o actualice.',
          variant: 'destructive',
        })
        refreshMineClosureGate()
        return false
      }
      if (String(cs.opened_by_id) !== String(user?.id)) {
        toast({ title: 'Sesión no válida', description: 'Solo puede guardar el cierre de su turno.', variant: 'destructive' })
        return false
      }
      cashRegisterSessionId = cs.id
    }
    const success = await api.saveClosure({
      startDate: form.startDate,
      endDate: form.endDate,
      cashierName: form.cashierName,
      cashierId: effectiveScope === 'mine' ? (user?.id ?? undefined) : undefined,
      cashRegisterSessionId: effectiveScope === 'mine' ? cashRegisterSessionId : undefined,
      theoreticalData: api.theoreticalData,
      actualTotal: form.getActualTotal(),
      notes: form.notes,
      paymentBreakdown: form.paymentBreakdown,
      denominations: form.denominations,
    })
    if (success) {
      form.resetForm()
      navigate('/cierre-caja')
    }
    return success
  }

  const handleSaveClosure = async () => {
    if (!api.theoreticalData) {
      toast({ title: 'Error', description: 'Primero debes calcular el cierre teórico', variant: 'destructive' })
      return
    }
    const theoreticalTotal = api.theoreticalData.theoretical.net_total
    const missingCount = form.paymentBreakdown.filter(
      (item) => !countedPaymentMethodIds.has(item.payment_method_id)
    ).length
    if (missingCount > 0) {
      toast({
        title: 'Completa el conteo',
        description: `Verifica el monto de ${missingCount} método${missingCount === 1 ? '' : 's'} de pago. Escribe 0 cuando corresponda.`,
        variant: 'destructive',
      })
      return
    }
    const difference = form.getTotalDifference(theoreticalTotal)
    if (Math.abs(difference) >= 0.005 && !form.notes.trim()) {
      setShowDifferenceReason(true)
      toast({
        title: 'Explica la diferencia',
        description: 'Escribe el motivo del faltante o sobrante antes de guardar.',
        variant: 'destructive',
      })
      return
    }
    const differencePct = form.getDifferencePercentage(theoreticalTotal)
    const isLargeDifference = theoreticalTotal > 0 && Math.abs(differencePct) > cashClosureMaxDiffPct
    if (isLargeDifference) {
      setShowConfirmSaveDialog(true)
      return
    }
    await performSaveClosure()
  }

  const cashSession = api.theoreticalData?.cash_session
  const openingFloat = cashSession?.opening_float ?? 0
  const hasCashPayment =
    openingFloat > 0 || form.paymentBreakdown.some((p) => isCashPaymentMethodName(p.payment_method_name))
  const closureDifference = api.theoreticalData
    ? form.getTotalDifference(api.theoreticalData.theoretical.net_total)
    : 0
  const hasDifference = Math.abs(closureDifference) >= 0.005

  const fmtSessionDt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(locale || 'es-GT', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  const handleDenominationUpdate = (index: number, quantity: number) => {
    form.updateDenomination(index, quantity)
    const countedCash = form.denominations.reduce((sum, denomination, denominationIndex) => {
      const nextQuantity = denominationIndex === index ? quantity : denomination.quantity
      return sum + Number(denomination.denomination) * nextQuantity
    }, 0)
    const cashIndex = form.paymentBreakdown.findIndex((item) =>
      isCashPaymentMethodName(item.payment_method_name)
    )
    if (cashIndex >= 0) {
      form.updateActualAmount(cashIndex, 'actual_amount', countedCash)
      setCountedPaymentMethodIds((current) => {
        const next = new Set(current)
        next.add(form.paymentBreakdown[cashIndex].payment_method_id)
        return next
      })
    }
  }

  const handlePaymentAmountUpdate = (
    index: number,
    field: 'actual_amount' | 'actual_count' | 'notes',
    value: string | number
  ) => {
    form.updateActualAmount(index, field, value)
    if (field === 'actual_amount') {
      setCountedPaymentMethodIds((current) => {
        const next = new Set(current)
        const methodId = form.paymentBreakdown[index].payment_method_id
        if (String(value).trim() === '') next.delete(methodId)
        else next.add(methodId)
        return next
      })
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
      <h1 className="sr-only">Registrar cierre de caja</h1>
      <section className="space-y-3" aria-label="Turno y período del cierre">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Turno y período</h2>
            <p className="mt-1 text-sm text-muted-foreground">{form.cashierName} · Revisa el período antes del conteo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            className="w-full gap-2 sm:w-auto"
          >
            <Settings2 className="h-4 w-4" />
            {advancedOpen ? 'Ocultar herramientas' : 'Herramientas avanzadas'}
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </Button>
          <Button
            onClick={() => void handleCalculateTheoretical()}
            disabled={api.isCalculating || (effectiveScope === 'mine' && (mineClosureGate.loading || !mineClosureGate.canCalculate || !mineClosureGate.closableSessionId))}
          >
            <Calculator className="h-4 w-4" aria-hidden="true" />
            {api.isCalculating ? 'Calculando...' : effectiveScope === 'mine' ? 'Calcular mi cierre' : 'Calcular cierre del día'}
          </Button>
          </div>
        </div>
        <div>
          <div className="space-y-3">
            <div className="cash-closure-turn border-y py-3">
              {effectiveScope === 'mine' ? (
                mineClosureGate.loading ? (
                  <LoadingState variant="detail" size="sm" message="Cargando datos de la caja…" />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Caja</p>
                        <p className="text-sm font-medium">
                          {mineClosureGate.register?.name ?? '—'}
                          {mineClosureGate.register?.code ? (
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              · {mineClosureGate.register.code}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Turno en caja</p>
                        <p className="text-sm font-medium">
                          {mineClosureGate.openSession
                            ? `Abierto · desde ${fmtSessionDt(mineClosureGate.openSession.opened_at)}`
                            : mineClosureGate.closableSession
                              ? `Cerrado · ${fmtSessionDt(mineClosureGate.closableSession.opened_at)} → ${fmtSessionDt(mineClosureGate.closableSession.closed_at)}`
                              : 'Sin turno cerrado pendiente de arqueo'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Horario del período (arqueo)</p>
                        <p className="text-sm font-medium tabular-nums">
                          {form.startDate && form.endDate ? (
                            <>
                              {form.startDate.split('T')[1]?.substring(0, 8) || '00:00:00'} —{' '}
                              {form.endDate.split('T')[1]?.substring(0, 8) || '23:59:59'}
                            </>
                          ) : (
                            '—'
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Fondo inicial del turno</p>
                        <p className="text-sm font-medium tabular-nums">
                          {mineClosureGate.openSession
                            ? new Intl.NumberFormat(locale || 'es-GT', {
                                style: 'currency',
                                currency: currencyCode || 'GTQ',
                              }).format(Number(mineClosureGate.openSession.opening_float))
                            : mineClosureGate.closableSession
                              ? new Intl.NumberFormat(locale || 'es-GT', {
                                  style: 'currency',
                                  currency: currencyCode || 'GTQ',
                                }).format(Number(mineClosureGate.closableSession.opening_float))
                              : '—'}
                        </p>
                      </div>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Fecha</p>
                      <p className="text-sm font-medium">
                        {new Date().toLocaleDateString(locale || 'es-GT', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Horario del período</p>
                      <div className="text-sm font-medium tabular-nums">
                        {form.startDate && form.endDate ? (
                          <>
                            {form.startDate.split('T')[1]?.substring(0, 8) || '00:00:00'} —{' '}
                            {form.endDate.split('T')[1]?.substring(0, 8) || '23:59:59'}
                          </>
                        ) : (
                          <LoadingIndicator message="Cargando…" />
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                    Desde el fin del último cierre del día hasta las 23:59:59 de hoy (todas las ventas).
                  </p>
                </>
              )}
            </div>

            {advancedOpen && showClosureTypeSelector && (
              <div className="space-y-2">
                <Label htmlFor="closure-scope">Tipo de cierre</Label>
                <Select value={closureScope} onValueChange={(v: 'day' | 'mine') => setClosureScope(v)}>
                  <SelectTrigger id="closure-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canCreateDay && (
                      <SelectItem value="day">Cierre del día (todos los cajeros)</SelectItem>
                    )}
                    {canCreateOwn && (
                      <SelectItem value="mine">Mi cierre (mis ventas del turno en caja)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {effectiveScope === 'mine' && (mineClosureGate.loading || mineClosureGate.reason !== 'ok') && (
              <p
                className={`text-sm rounded-md border px-3 py-2 ${
                  mineClosureGate.loading || !mineClosureGate.canCalculate
                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100'
                }`}
              >
                {mineClosureGate.loading && 'Comprobando la caja y los turnos…'}
                {!mineClosureGate.loading && mineClosureGate.reason === 'ok' && (
                  <>Turno cerrado listo para arqueo. Puede calcular el cierre de ese turno.</>
                )}
                {!mineClosureGate.loading && mineClosureGate.reason === 'register-open-own' && (
                  <>
                    <span className="font-medium">Calcular bloqueado:</span> tiene la caja abierta. Use «Fin de turno»
                    en «Nueva venta».
                  </>
                )}
                {!mineClosureGate.loading && mineClosureGate.reason === 'register-open-other' && (
                  <>
                    <span className="font-medium">Calcular bloqueado:</span> hay turno abierto de otro cajero en esta
                    caja.
                  </>
                )}
                {!mineClosureGate.loading && mineClosureGate.reason === 'no-pending' && (
                  <>
                    <span className="font-medium">Calcular bloqueado:</span> no hay turno cerrado pendiente de arqueo.
                  </>
                )}
                {!mineClosureGate.loading && mineClosureGate.reason === 'error' && (
                  <>
                    <span className="font-medium">No se pudo comprobar la caja.</span>{' '}
                    {mineClosureGate.errorMessage || 'Intente de nuevo.'}
                  </>
                )}
              </p>
            )}

            {effectiveScope === 'mine' && mineClosureGate.reason === 'error' && <Button variant="outline" onClick={refreshMineClosureGate} disabled={isRefreshing}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {isRefreshing ? 'Verificando turno…' : 'Reintentar'}
            </Button>}

          </div>
        </div>
      </section>

      {api.theoreticalData && (
        <div className={`cash-closure-count-grid ${hasCashPayment ? 'cash-closure-count-grid-with-cash' : ''}`}>
          {hasCashPayment && (
            <Card className="auna-surface cash-closure-panel">
              <CardContent className="p-4">
                <DenominationsCounter
                  denominations={form.denominations}
                  onUpdateQuantity={handleDenominationUpdate}
                  cashTotal={form.getCashTotal()}
                  openingFloat={openingFloat}
                  expectedCashInDrawer={cashSession?.expected_cash_in_drawer}
                />
              </CardContent>
            </Card>
          )}
          <Card className="auna-surface cash-closure-panel">
            <CardContent className="p-4">
                <PaymentMethodsForm
                  paymentBreakdown={form.paymentBreakdown}
                  cashSession={cashSession}
                  showAdvancedDetails={advancedOpen}
                  countedPaymentMethodIds={countedPaymentMethodIds}
                  onUpdateAmount={handlePaymentAmountUpdate}
                />
            </CardContent>
          </Card>
          <aside className="cash-closure-summary-stack space-y-4" aria-label="Resumen y confirmación del cierre">
            <Card className="auna-surface cash-closure-panel">
              <CardContent className="p-4">
                <TheoreticalSummary data={api.theoreticalData} showAdvancedDetails={advancedOpen} />
              </CardContent>
            </Card>
            <Card className="auna-surface cash-closure-panel">
              <CardContent className="p-4">
              <ClosureSummaryCard
                theoreticalTotal={api.theoreticalData.theoretical.net_total}
                actualTotal={form.getActualTotal()}
                difference={form.getTotalDifference(api.theoreticalData.theoretical.net_total)}
                differencePercentage={form.getDifferencePercentage(api.theoreticalData.theoretical.net_total)}
                currencyCode={currencyCode}
                locale={locale}
                paymentBreakdown={form.paymentBreakdown}
              />
              </CardContent>
            </Card>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  {hasDifference ? 'Motivo de la diferencia *' : 'Notas (opcional)'}
                </Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => form.setNotes(e.target.value)}
                  placeholder={hasDifference ? 'Explica el faltante o sobrante...' : 'Observaciones del cierre...'}
                  rows={3}
                  required={hasDifference}
                  aria-invalid={hasDifference && showDifferenceReason && !form.notes.trim()}
                />
                {hasDifference && (
                  <p className="text-xs text-muted-foreground">
                    Todo faltante o sobrante debe quedar documentado.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => navigate('/cierre-caja')} disabled={api.isSaving}>Cancelar</Button>
              <Button
                onClick={() => void handleSaveClosure()}
                disabled={
                  api.isSaving ||
                  (effectiveScope === 'mine' &&
                    (mineClosureGate.loading ||
                      mineClosureGate.reason !== 'ok' ||
                      !mineClosureGate.closableSessionId))
                }
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {api.isSaving ? 'Guardando...' : 'Guardar cierre de caja'}
              </Button>
              </div>
          </aside>
        </div>
      )}

      <AlertDialog open={showConfirmSaveDialog} onOpenChange={setShowConfirmSaveDialog}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>Diferencia significativa</AlertDialogTitle>
            <AlertDialogDescription>
              La diferencia supera el {cashClosureMaxDiffPct}% configurado.
              {api.theoreticalData && (
                <>
                  {' '}
                  Diferencia:{' '}
                  {form.getTotalDifference(api.theoreticalData.theoretical.net_total) >= 0 ? '+' : ''}
                  {new Intl.NumberFormat(locale || 'es-GT', {
                    style: 'currency',
                    currency: currencyCode || 'GTQ',
                  }).format(form.getTotalDifference(api.theoreticalData.theoretical.net_total))}{' '}
                  ({form.getDifferencePercentage(api.theoreticalData.theoretical.net_total).toFixed(1)}%).
                </>
              )}{' '}
              ¿Deseas guardar el cierre de todas formas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmSaveDialog(false)
                void performSaveClosure()
              }}
            >
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CashClosureCreatePage
