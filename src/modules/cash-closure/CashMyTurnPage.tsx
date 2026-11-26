import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/shared/LoadingState'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { fetchMyTurns, joinCashTurn, finishCashTurn, type MyTurn } from '@/services/cashMyTurnService'
import { CashPageHeader, Notice } from './components/CashPageParts'
import { formatZonedDateTime } from './types'

const STATES = { OPERATING: 'En curso', PENDING_COUNT: 'Falta contar', RECOUNT: 'Volver a contar', REJECTED: 'Arqueo rechazado', PENDING_REVIEW: 'En revisión', FINALIZED: 'Arqueo finalizado' }
export function MyTurnList({ turns, busy, onJoin, onClose }: { turns: MyTurn[]; busy: boolean; onJoin: (turn: MyTurn) => void; onClose: (turn: MyTurn) => void }) {
  return <ul className="space-y-3">{turns.map(turn => <li key={turn.id} className="auna-surface min-w-0 rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{turn.registerName}</h3><Badge variant="secondary">{STATES[turn.state]}</Badge></div>
      <p className="text-sm text-muted-foreground">{turn.operationMode === 'SHARED' ? 'Compartida' : 'Individual'} · {turn.role === 'RESPONSIBLE' ? 'Responsable' : turn.role === 'PARTICIPANT' ? 'Participante' : turn.can.close ? 'Encargado' : 'Puedes unirte'} · Responsable: {turn.responsibleName}</p>
      <p className="text-xs text-muted-foreground">Inicio: {formatZonedDateTime(turn.openedAt, turn.timeZone, 'es-GT')} · {turn.operationCount} operaciones tuyas</p>
    </div><div className="flex flex-wrap gap-2">
      {turn.can.join && <Button disabled={busy} onClick={() => onJoin(turn)}>Unirme al turno</Button>}
      {turn.can.close && <Button disabled={busy} onClick={() => onClose(turn)}>Terminar turno</Button>}
      {turn.can.count && <Button asChild><Link to={`/cierre-caja/nuevo?turno=${encodeURIComponent(turn.id)}`}>{turn.state === 'RECOUNT' ? 'Volver a contar' : turn.registerType === 'VIRTUAL' ? 'Revisar cobros' : 'Contar efectivo'}</Link></Button>}
      {turn.can.handover && <Button asChild variant={turn.can.count ? 'outline' : 'default'}><Link to={`/cierre-caja/turnos/${encodeURIComponent(turn.id)}/entregar`}>Entregar efectivo</Link></Button>}
      {turn.can.movement && <Button asChild variant="outline"><Link to={`/cierre-caja/movimientos/nuevo?turno=${encodeURIComponent(turn.id)}`}>Ingresar o retirar</Link></Button>}
      {turn.state === 'OPERATING' && turn.role !== 'INVITED' && !turn.can.join && <Button asChild variant="outline"><Link to={`/ventas/nueva?caja=${encodeURIComponent(turn.registerId)}`}>Ir al punto de venta</Link></Button>}
    </div></div>
    {turn.operationMode === 'SHARED' && <details className="mt-3 border-t pt-2 text-sm"><summary className="cursor-pointer py-1">Personas del turno · {turn.participants.length}</summary><p className="pt-2 text-muted-foreground">{turn.participants.map(p => p.name).join(', ') || 'Todavía no te has unido.'}</p><p className="mt-1 text-xs text-muted-foreground">Cada persona usa su usuario. Las diferencias se revisan para el turno completo.</p></details>}
  </li>)}</ul>
}
export default function CashMyTurnPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  const [params] = useSearchParams(), sessionId = params.get('turno')
  return <MyTurnsView key={JSON.stringify([company?.id, branch?.id, user?.id,sessionId])} sessionId={sessionId} />
}
function MyTurnsView({ sessionId }: { sessionId?: string | null }) {
  const { company, branch } = useTenant(), { user, hasPermission } = useAuthPermissions(), navigate = useNavigate(), cache = useQueryClient()
  const scope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const query = useQuery({ queryKey: ['cash-my-turns', scope.companyId, scope.branchId, scope.actorId,sessionId], queryFn: ({ signal }) => fetchMyTurns(scope, signal, sessionId), enabled: ready })
  const [closing, setClosing] = useState<MyTurn | null>(null), [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const running = useRef(false), live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  usePageTrail([{ label: 'Mi turno' }])
  async function act(turn: MyTurn, action: 'join' | 'close') {
    if (running.current || !ready) return
    running.current = true; setBusy(true); setError('')
    try {
      if (action === 'join') await joinCashTurn(turn.id, scope)
      else await finishCashTurn(turn, reason, scope)
      await cache.invalidateQueries({ queryKey: ['cash-my-turns', scope.companyId, scope.branchId, scope.actorId] })
      await cache.invalidateQueries({ queryKey: ['cash-session', 'current'] })
      if (!live.current) return
      setClosing(null); setReason('')
      if (action === 'close' && hasPermission('cashclosure.create', 'cashclosure.create_own')) navigate(`/cierre-caja/nuevo?turno=${encodeURIComponent(turn.id)}`)
    } catch (e) { if (live.current) setError((e as Error).message) }
    finally { running.current = false; if (live.current) setBusy(false) }
  }
  return <main className="mx-auto w-full max-w-[1100px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Mi turno" subtitle={branch?.name || 'Selecciona una sucursal'} backLabel="Volver al punto de venta" onBack={() => navigate('/ventas/nueva')} actions={<Button variant="outline" disabled={query.isFetching || busy} onClick={() => void query.refetch()}>Actualizar</Button>} />
    {error && <Notice role="alert">{error}</Notice>}
    {closing && <section className="auna-surface space-y-3 rounded-xl border p-4" aria-labelledby="finish-title"><h2 id="finish-title" className="font-semibold">Terminar turno de {closing.registerName}</h2><p className="text-sm text-muted-foreground">Dejará de aceptar operaciones. Después podrás {closing.registerType === 'VIRTUAL' ? 'revisar sus cobros' : 'contar y entregar el efectivo'}.</p><div className="max-w-xl space-y-1"><Label htmlFor="finish-reason">Motivo {closing.needsCloseReason ? '· obligatorio al terminar un turno ajeno' : '· opcional'}</Label><Textarea id="finish-reason" autoFocus value={reason} maxLength={1000} rows={2} disabled={busy} onChange={e => setReason(e.target.value)} /></div><div className="flex flex-wrap gap-2"><Button disabled={busy || closing.needsCloseReason && !reason.trim()} onClick={() => void act(closing, 'close')}>{busy ? 'Terminando…' : 'Confirmar fin de turno'}</Button><Button variant="outline" disabled={busy} onClick={() => setClosing(null)}>Seguir trabajando</Button></div></section>}
    {!ready ? <Notice>Selecciona una empresa y sucursal para consultar tus turnos.</Notice> : query.isLoading ? <LoadingState variant="cards" message="Cargando tus turnos…" /> : query.error ? <Notice role="alert">{(query.error as Error).message} <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></Notice> : !query.data?.available ? <Notice>La consulta de turnos todavía no está disponible en esta sucursal.</Notice> : <>
      <section aria-labelledby="current-turns" className="space-y-3"><h2 id="current-turns" className="font-semibold">Turnos en curso <span className="text-muted-foreground">({query.data.current.length})</span></h2>{query.data.current.length ? <MyTurnList turns={query.data.current} busy={busy} onJoin={t => void act(t, 'join')} onClose={t => { setClosing(t); setReason(''); setError('') }} /> : <CollectionEmptyState compact title="No tienes un turno en curso" description="Abre una caja o elige una compartida desde el punto de venta." />}</section>
      <section aria-labelledby="pending-turns" className="space-y-3"><h2 id="pending-turns" className="font-semibold">Pendientes anteriores <span className="text-muted-foreground">({query.data.pending.length})</span></h2>{query.data.pending.length ? <MyTurnList turns={query.data.pending} busy={busy} onJoin={() => {}} onClose={() => {}} /> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Estás al día: no tienes turnos pendientes de conteo o entrega.</p>}</section>
    </>}
  </main>
}
