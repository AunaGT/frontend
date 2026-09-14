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
 * Paso previo a "Nueva venta": elegir con qué caja se va a trabajar.
 * Muestra las cajas activas, cuál tiene asignada el usuario, cuáles están
 * abiertas (y por quién) y ofrece continuar el turno o abrirlo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Landmark, Star, User as UserIcon, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils/formatters'
import { listCashRegisters, type CashRegisterDto } from '@/services/cashSessionsService'

export interface CashRegisterPickerProps {
  onSelect: (registerId: string) => void
  onBack: () => void
}

export function CashRegisterPicker({ onSelect, onBack }: CashRegisterPickerProps) {
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode } = useSystemSettings()
  // Solo admin/supervisores (pueden cerrar turnos ajenos) ven todas las cajas;
  // un vendedor normal solo ve la suya asignada, o la predeterminada si no tiene.
  const canSeeAllRegisters = hasPermission('cashclosure.create', 'cashclosure.create_day')
  const [registers, setRegisters] = useState<CashRegisterDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRegisters(await listCashRegisters())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las cajas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    return [...registers].sort((a, b) => {
      const aMine = a.id === user?.cash_register_id ? 0 : 1
      const bMine = b.id === user?.cash_register_id ? 0 : 1
      if (aMine !== bMine) return aMine - bMine
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [registers, user?.cash_register_id])

  const visible = useMemo(() => {
    if (canSeeAllRegisters) return sorted
    const mine = sorted.filter((r) => r.id === user?.cash_register_id)
    if (mine.length > 0) return mine
    return sorted.filter((r) => r.is_default)
  }, [sorted, canSeeAllRegisters, user?.cash_register_id])

  return (
    <div className="px-4 sm:px-8 lg:px-14 py-8 w-full max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Selecciona una caja</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Elige con qué caja vas a trabajar. Si ya tiene un turno abierto, continuarás sobre esa
          sesión; si está cerrada, se te pedirá el fondo inicial.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-3" />
          Cargando cajas…
        </div>
      ) : error ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void load()}>Reintentar</Button>
            <Button variant="outline" onClick={onBack}>Volver a ventas</Button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="space-y-4 py-8 text-center text-muted-foreground">
          <p>
            {sorted.length === 0
              ? 'No hay cajas activas configuradas.'
              : 'No tienes una caja asignada y no hay una caja predeterminada activa. Contacta a un administrador.'}
          </p>
          <Button variant="outline" onClick={onBack}>Volver a ventas</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((reg) => {
              const isMine = reg.id === user?.cash_register_id
              const isOpen = Boolean(reg.open_session)
              return (
                <Card
                  key={reg.id}
                  className={
                    isMine
                      ? 'border-primary/50 ring-1 ring-primary/20 shadow-sm'
                      : 'border-border/70'
                  }
                >
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{reg.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{reg.code}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isMine && (
                          <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                            <UserIcon className="w-3 h-3" />
                            Tu caja
                          </Badge>
                        )}
                        {reg.is_default && (
                          <Badge variant="outline" className="gap-1 whitespace-nowrap">
                            <Star className="w-3 h-3" />
                            Predeterminada
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        }`}
                        aria-hidden
                      />
                      {isOpen && reg.open_session ? (
                        <span className="text-muted-foreground">
                          Abierta por{' '}
                          <span className="font-medium text-foreground">
                            {reg.open_session.opened_by_name ?? 'un usuario'}
                          </span>
                          {' · '}
                          {formatDistanceToNow(new Date(reg.open_session.opened_at), {
                            locale: es,
                            addSuffix: true,
                          })}
                          {' · fondo '}
                          {formatMoney(reg.open_session.opening_float, locale, currencyCode)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Cerrada</span>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      variant={isOpen ? 'default' : 'outline'}
                      onClick={() => onSelect(reg.id)}
                    >
                      {isOpen ? 'Continuar venta' : 'Abrir caja'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div>
            <Button variant="ghost" onClick={onBack}>
              Volver a ventas
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
