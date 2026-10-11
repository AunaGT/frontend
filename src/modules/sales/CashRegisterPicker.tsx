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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Landmark, Star, User as UserIcon, AlertCircle, RefreshCw } from 'lucide-react'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils/formatters'
import { listCashRegisters, type CashRegisterDto } from '@/services/cashSessionsService'
import './pos.css'

export interface CashRegisterPickerProps {
  onSelect: (registerId: string) => void
  onBack: () => void
}

export function CashRegisterPicker({ onSelect, onBack }: CashRegisterPickerProps) {
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode } = useSystemSettings()
  const isAdmin = String(user?.role?.name ?? '').toLowerCase() === 'admin'
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
    <div className="pos-page pos-cash-entry">
      <div className="pos-toolbar">
        <Button variant="outline" size="icon" aria-label="Volver a ventas" onClick={onBack}>
          <ArrowLeft aria-hidden />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Selecciona una caja</h1>
          <p className="text-sm text-muted-foreground">Continúa tu turno o abre una caja con su fondo inicial.</p>
        </div>
        <Button variant="outline" className="sm:ml-auto" aria-label="Actualizar cajas" disabled={loading} onClick={load}>
          <RefreshCw aria-hidden />
          Actualizar cajas
        </Button>
      </div>

      {loading && registers.length > 0 && <LoadingIndicator message="Actualizando cajas…" />}
      {loading && registers.length === 0 ? (
        <LoadingState variant="cards" message="Cargando cajas…" />
      ) : error ? (
        <div className="space-y-4">
          <div role="alert" className="flex items-center gap-2 text-destructive text-sm">
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
          <div className="pos-register-list">
            {visible.map((reg) => {
              const isMine = reg.id === user?.cash_register_id
              const isOpen = Boolean(reg.open_session)
              const blocked = isOpen && !isAdmin && String(reg.open_session?.opened_by_id) !== String(user?.id)
              return (
                <article
                  key={reg.id}
                  className="auna-surface rounded-xl border pos-register"
                  data-assigned={isMine}
                  aria-label={reg.name}
                >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-brand-orange shrink-0">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-semibold truncate">{reg.name}</h2>
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

                    <div className="flex items-start gap-2 text-sm">
                      <span
                        className={`inline-block mt-1.5 shrink-0 h-2 w-2 rounded-full ${
                          isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        }`}
                        aria-hidden
                      />
                      {isOpen && reg.open_session ? (
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium">{blocked ? 'Turno de otro usuario' : 'Turno abierto'}</p>
                          <p className="text-muted-foreground">
                            {reg.open_session.opened_by_name ?? 'un usuario'} · {formatDistanceToNow(new Date(reg.open_session.opened_at), {
                            locale: es,
                            addSuffix: true,
                          })}
                          </p>
                          <p className="text-muted-foreground">Fondo inicial: {formatMoney(reg.open_session.opening_float, locale, currencyCode)}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium">Cerrada</p>
                          <p className="text-muted-foreground">Declara el fondo inicial para comenzar.</p>
                        </div>
                      )}
                    </div>
                    {blocked && <p className="text-xs text-muted-foreground">Este turno debe cerrarse antes de abrir uno propio.</p>}
                    <Button
                      className="w-full mt-auto"
                      disabled={blocked}
                      aria-label={blocked ? `Caja ${reg.name} en uso` : isOpen ? `Continuar venta en ${reg.name}` : `Abrir caja ${reg.name}`}
                      onClick={() => onSelect(reg.id)}
                    >
                      {blocked ? 'Caja en uso' : isOpen ? 'Continuar venta' : 'Abrir caja'}
                    </Button>
                </article>
              )
            })}
          </div>

        </>
      )}
    </div>
  )
}
