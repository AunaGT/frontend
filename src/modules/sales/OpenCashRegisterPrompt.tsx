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
 * Pantalla de apertura de caja (estilo POS): fondo inicial y confirmación
 * antes de permitir registrar ventas.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Landmark, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { openCashSession } from '@/services/cashSessionsService'
import { fetchRegisterFloat } from '@/services/cashCustodyService'
import './pos.css'

export interface OpenCashRegisterPromptProps {
  registerName?: string | null
  registerId?: string | null
  /** 4A: una caja virtual abre su período sin fondo ni efectivo. */
  registerKind?: 'PHYSICAL' | 'VIRTUAL'
  onOpened: () => void | Promise<void>
  onBack: () => void
}

export function OpenCashRegisterPrompt({
  registerName,
  registerId,
  registerKind,
  onOpened,
  onBack,
}: OpenCashRegisterPromptProps) {
  const virtual = registerKind === 'VIRTUAL'
  const { currencyCode, locale } = useSystemSettings()
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  // 3B.2: fondo retenido por el turno anterior. Quien abre cuenta el cajón; la diferencia queda registrada.
  const float = useQuery({
    queryKey: ['cash-register-float', company?.id, branch?.id, registerId],
    queryFn: ({ signal }) => fetchRegisterFloat(registerId!, { companyId: company!.id, branchId: branch!.id, actorId: user?.id || '' }, signal),
    enabled: !virtual && !!registerId && !!company?.id && !!branch?.id, retry: false,
  })
  const inherited = float.data?.available && Number(float.data.amount) > 0 ? float.data : null
  const money = (value: string | number) => new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' }).format(Number(value))
  const [openingFloat, setOpeningFloat] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleOpen = async () => {
    const n = virtual ? 0 : parseFloat(String(openingFloat).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      setSubmitError('Indique un fondo inicial válido (mayor o igual a 0).')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      await openCashSession({
        opening_float: n,
        cash_register_id: registerId ?? undefined,
      })
      await Promise.resolve(onOpened())
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'No se pudo abrir la caja')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pos-page pos-cash-entry">
      <section className="auna-surface rounded-xl border pos-opening" aria-label="Apertura de caja">
        <div className="space-y-3">
          <Landmark className="h-6 w-6 text-brand-orange" aria-hidden />
          <h1 className="text-xl font-semibold">Abrir caja</h1>
          <p className="font-medium">{registerName ?? 'Caja seleccionada'}</p>
          <p className="text-sm text-muted-foreground">{virtual ? 'Caja virtual: solo cobros digitales (tarjeta y transferencia). No tiene fondo ni efectivo.' : 'El fondo inicial es el efectivo disponible al comenzar el turno, no una venta.'}</p>
          {inherited && <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status"><strong className="font-medium">Fondo heredado: {money(inherited.amount)}</strong>{inherited.lastActorName ? ` · lo dejó ${inherited.lastActorName}` : ''}. Cuenta el efectivo del cajón e ingresa lo contado; si no coincide, la diferencia queda registrada.</p>}
        </div>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); return handleOpen() }}>
          {!virtual && <div className="space-y-2">
            <Label htmlFor="open-cash-float">{inherited ? 'Efectivo contado al abrir' : 'Fondo inicial'} ({currencyCode})</Label>
            <Input
              id="open-cash-float"
              type="number"
              min={0}
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              disabled={submitting}
              autoComplete="off"
              aria-invalid={Boolean(submitError)}
              aria-describedby={`open-cash-help${submitError ? ' open-cash-error' : ''}`}
            />
            <p id="open-cash-help" className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{inherited
              ? (() => { const counted = Number(String(openingFloat).replace(',', '.')), gap = Math.round((counted - Number(inherited.amount)) * 100) / 100
                return !Number.isFinite(counted) ? 'Ingresa lo que contaste.' : gap === 0 ? 'Coincide con el fondo heredado.' : gap < 0 ? `Faltan ${money(-gap)} respecto al fondo heredado.` : `Sobran ${money(gap)} respecto al fondo heredado.` })()
              : 'Puedes iniciar con 0 si no hay efectivo en caja.'}</p>
          </div>}
          {submitError ? (
            <p id="open-cash-error" className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
              Cambiar de caja
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abriendo…
                </>
              ) : (
                'Abrir caja'
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
