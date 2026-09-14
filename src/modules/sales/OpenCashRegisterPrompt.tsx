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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Landmark, Loader2 } from 'lucide-react'
import { openCashSession } from '@/services/cashSessionsService'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-xl border-2 border-border">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Landmark className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">Abrir caja</CardTitle>
          <CardDescription className="text-base">
            Debe abrir un turno de caja para registrar ventas. Declare el efectivo inicial en caja (puede ser 0).
          </CardDescription>
          {registerName ? (
            <p className="text-sm font-medium text-foreground pt-1">Caja: {registerName}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="open-cash-float">Fondo inicial (Q)</Label>
            <Input
              id="open-cash-float"
              type="number"
              min={0}
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          </div>
          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
              Volver a ventas
            </Button>
            <Button type="button" className="bg-primary" onClick={() => void handleOpen()} disabled={submitting}>
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
        </CardContent>
      </Card>
    </div>
  )
}
