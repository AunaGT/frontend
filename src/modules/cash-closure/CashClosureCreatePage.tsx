/**
 * Registro de un nuevo cierre de caja (wizard completo).
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, Calculator, Save, User } from 'lucide-react'
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

export const CASH_CLOSURE_CREATE_PATH = '/cierre-caja/nuevo'

export function CashClosureCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
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

  const { gate: mineClosureGate, refresh: refreshMineClosureGate } = useMineClosureGate({
    enabled: effectiveScope === 'mine',
    userId: user?.id,
    timezone,
    onSessionDates,
  })

  const [showConfirmSaveDialog, setShowConfirmSaveDialog] = useState(false)

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

  const fmtSessionDt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(locale || 'es-GT', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full min-w-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/cierre-caja" aria-label="Volver al listado">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Registrar cierre de caja</h2>
          <p className="text-sm text-muted-foreground">
            Pasos: 1. Período → 2. Calcular → 3. Contado → 4. Guardar
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Nuevo cierre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Paso 1 — Período</h4>
            <div className="bg-muted/50 border rounded-lg p-4">
              {effectiveScope === 'mine' ? (
                mineClosureGate.loading ? (
                  <p className="text-sm text-muted-foreground">Cargando datos de la caja…</p>
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
                      <p className="text-sm font-medium tabular-nums">
                        {form.startDate && form.endDate ? (
                          <>
                            {form.startDate.split('T')[1]?.substring(0, 8) || '00:00:00'} —{' '}
                            {form.endDate.split('T')[1]?.substring(0, 8) || '23:59:59'}
                          </>
                        ) : (
                          'Cargando...'
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                    Desde el fin del último cierre del día hasta las 23:59:59 de hoy (todas las ventas).
                  </p>
                </>
              )}
            </div>

            {showClosureTypeSelector && (
              <div className="space-y-2">
                <Label>Tipo de cierre</Label>
                <Select value={closureScope} onValueChange={(v: 'day' | 'mine') => setClosureScope(v)}>
                  <SelectTrigger>
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

            {effectiveScope === 'mine' && (
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

            <Button
              onClick={() => void handleCalculateTheoretical()}
              disabled={
                api.isCalculating ||
                (effectiveScope === 'mine' &&
                  (mineClosureGate.loading ||
                    !mineClosureGate.canCalculate ||
                    !mineClosureGate.closableSessionId))
              }
              className="w-full bg-liquor-amber hover:bg-liquor-amber/90 text-white"
            >
              <Calculator className="h-4 w-4 mr-2" />
              {api.isCalculating
                ? 'Calculando...'
                : effectiveScope === 'mine'
                  ? 'Calcular mi cierre'
                  : 'Calcular cierre del día'}
            </Button>
          </div>

          {api.theoreticalData && (
            <>
              <TheoreticalSummary data={api.theoreticalData} />

              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-medium text-foreground">Paso 3 — Montos contados</h4>
                <PaymentMethodsForm
                  paymentBreakdown={form.paymentBreakdown}
                  cashSession={cashSession}
                  onUpdateAmount={form.updateActualAmount}
                />
                {hasCashPayment && (
                  <DenominationsCounter
                    denominations={form.denominations}
                    onUpdateQuantity={form.updateDenomination}
                    cashTotal={form.getCashTotal()}
                    openingFloat={openingFloat}
                    expectedCashInDrawer={cashSession?.expected_cash_in_drawer}
                  />
                )}
              </div>

              <ClosureSummaryCard
                theoreticalTotal={api.theoreticalData.theoretical.net_total}
                actualTotal={form.getActualTotal()}
                difference={form.getTotalDifference(api.theoreticalData.theoretical.net_total)}
                differencePercentage={form.getDifferencePercentage(api.theoreticalData.theoretical.net_total)}
                currencyCode={currencyCode}
                locale={locale}
              />

              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cajero</p>
                    <p className="font-medium">{form.cashierName}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => form.setNotes(e.target.value)}
                  placeholder="Observaciones del cierre..."
                  rows={3}
                />
              </div>

              <Button
                onClick={() => void handleSaveClosure()}
                disabled={
                  api.isSaving ||
                  (effectiveScope === 'mine' &&
                    (mineClosureGate.loading ||
                      mineClosureGate.reason !== 'ok' ||
                      !mineClosureGate.closableSessionId))
                }
                className="w-full bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {api.isSaving ? 'Guardando...' : 'Guardar cierre de caja'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmSaveDialog} onOpenChange={setShowConfirmSaveDialog}>
        <AlertDialogContent>
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
