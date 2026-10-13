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
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { openCashSession } from '@/services/cashSessionsService'
import './pos.css'

export interface OpenCashRegisterPromptProps {
  registerName?: string | null
  registerId?: string | null
  onOpened: () => void | Promise<void>
  onBack: () => void
}

export function OpenCashRegisterPrompt({
  registerName,
  registerId,
  onOpened,
  onBack,
}: OpenCashRegisterPromptProps) {
  const { currencyCode } = useSystemSettings()
  const [openingFloat, setOpeningFloat] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleOpen = async () => {
    const n = parseFloat(String(openingFloat).replace(',', '.'))
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
          <p className="text-sm text-muted-foreground">El fondo inicial es el efectivo disponible al comenzar el turno, no una venta.</p>
        </div>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); return handleOpen() }}>
          <div className="space-y-2">
            <Label htmlFor="open-cash-float">Fondo inicial ({currencyCode})</Label>
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
            <p id="open-cash-help" className="text-xs text-muted-foreground">Puedes iniciar con 0 si no hay efectivo en caja.</p>
          </div>
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
