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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Landmark, Star, User as UserIcon, AlertCircle, RefreshCw } from 'lucide-react'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { formatMoney } from '@/utils/formatters'
import { listCashRegisters, closeCashSession, type CashRegisterDto } from '@/services/cashSessionsService'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import './pos.css'

export interface CashRegisterPickerProps {
  onSelect: (registerId: string) => void
  onBack: () => void
}

export function CashRegisterPicker({ onSelect, onBack }: CashRegisterPickerProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission, isAdmin } = useAuthPermissions()
  const { company, branch } = useTenant()
  const { locale, currencyCode } = useSystemSettings()
  const identity = JSON.stringify([company?.id, branch?.id, user?.id]), live = useRef(identity), loadedScope = useRef(identity)
  live.current = identity
  // Solo admin/supervisores (pueden cerrar turnos ajenos) ven todas las cajas;
  // un vendedor normal solo ve la suya asignada, o la predeterminada si no tiene.
  const canSeeAllRegisters = hasPermission('cashclosure.create', 'cashclosure.create_day')
  const [registers, setRegisters] = useState<CashRegisterDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<CashRegisterDto | null>(null)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeNotice, setCloseNotice] = useState<string | null>(null)
  const closeFlight = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (loadedScope.current !== identity) setRegisters([])
    try {
      const rows = await listCashRegisters(false, { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' })
      if (live.current === identity) { loadedScope.current = identity; setRegisters(rows) }
    } catch (e) {
      if (live.current === identity) { loadedScope.current = identity; setError(e instanceof Error ? e.message : 'No se pudieron cargar las cajas') }
    } finally {
      if (live.current === identity) setLoading(false)
    }
  }, [identity, company?.id, branch?.id, user?.id])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => () => { live.current = '' }, [])

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
    if (loadedScope.current !== identity) return []
    const explicit = sorted.filter(r => r.access_control_version === 1 && (r.can_open || r.open_session?.opened_by_id === user?.id || canSeeAllRegisters))
    const legacy = sorted.filter(r => r.access_control_version !== 1)
    if (canSeeAllRegisters) return [...legacy, ...explicit]
    const mine = legacy.filter((r) => r.id === user?.cash_register_id)
    return [...(mine.length ? mine : legacy.filter(r => r.is_default)), ...explicit]
  }, [sorted, canSeeAllRegisters, user?.cash_register_id, user?.id, identity])
  async function terminateTurn() {
    if (!canSeeAllRegisters || !closeTarget?.open_session || closeFlight.current || live.current !== identity) return
    closeFlight.current = true; setClosing(true); setCloseError(null)
    try {
      await closeCashSession({ cash_register_id: closeTarget.id, cash_register_session_id: closeTarget.open_session.id }, { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' })
      if (live.current !== identity) return
      setCloseTarget(null); setCloseNotice('Turno terminado. El arqueo sigue pendiente en Cierres de caja; no se registró dinero ni se aprobó una diferencia.')
      await load()
    } catch (e) { if (live.current === identity) setCloseError(e instanceof Error ? e.message : 'No se pudo terminar el turno') }
    finally { closeFlight.current = false; if (live.current === identity) setClosing(false) }
  }

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

      {closeNotice && <p role="status" className="text-sm">{closeNotice}</p>}
      {closeError && <p role="alert" className="text-sm text-destructive">{closeError}</p>}
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
        <CollectionEmptyState title="Tu punto de venta espera una caja" description={sorted.length === 0 ? 'No hay cajas activas configuradas. Consulta con un administrador para preparar una caja.' : 'No tienes una caja asignada y no hay una caja predeterminada activa. Contacta a un administrador.'} action={<Button variant="outline" onClick={onBack}>Volver a ventas</Button>} />
      ) : (
        <>
          <div className="pos-register-list">
            {visible.map((reg) => {
              const isMine = reg.id === user?.cash_register_id
              const isOpen = Boolean(reg.open_session)
              const noAccess = reg.access_control_version === 1 && reg.can_open !== true
              const shared = reg.money_event_version === 1 && reg.operation_mode === 'SHARED' && reg.can_open === true
              const blocked = noAccess || (isOpen && !shared && !isAdmin && String(reg.open_session?.opened_by_id) !== String(user?.id))
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
                    {blocked && <p className="text-xs text-muted-foreground">{noAccess ? 'Acceso de supervisión: esta caja no está autorizada para que abras un turno propio.' : 'Este turno debe cerrarse antes de abrir uno propio.'}</p>}
                    <Button
                      className="w-full mt-auto"
                      disabled={blocked}
                      aria-label={blocked ? isOpen ? `Caja ${reg.name} en uso` : `Sin acceso para abrir ${reg.name}` : isOpen ? `Continuar venta en ${reg.name}` : `Abrir caja ${reg.name}`}
                      onClick={() => onSelect(reg.id)}
                    >
                      {blocked ? isOpen ? 'Caja en uso' : 'Sin acceso para abrir' : isOpen ? shared ? 'Entrar al turno compartido' : 'Continuar venta' : 'Abrir caja'}
                    </Button>
                    {isOpen && canSeeAllRegisters && <Button type="button" variant="outline" disabled={closing} aria-label={`Terminar turno de ${reg.name}`} onClick={() => { if (reg.operation_mode === 'SHARED') navigate(`/cierre-caja/mi-turno?turno=${encodeURIComponent(reg.open_session!.id)}`); else { setCloseError(null); setCloseTarget(reg) } }}>Terminar turno</Button>}
                </article>
              )
            })}
          </div>

        </>
      )}
      <ConfirmDialog appearance="auna" open={!!closeTarget} onOpenChange={open => { if (!open && !closing) setCloseTarget(null) }} title="¿Terminar este turno?" description={closeError ? `${closeError} Puedes cancelar y actualizar las cajas antes de intentar otra vez.` : `Terminarás el turno de ${closeTarget?.open_session?.opened_by_name || 'su responsable'} en ${closeTarget?.name || 'esta caja'}. No se registrará dinero ni se aprobará el arqueo; quedará pendiente de revisión.`} confirmText="Terminar turno" cancelText="Seguir revisando" loading={closing} onConfirm={terminateTurn} />
    </div>
  )
}
