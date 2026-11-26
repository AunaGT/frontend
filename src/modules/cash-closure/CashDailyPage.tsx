import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/shared/LoadingState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { CASH_DAY_READ_PERMISSIONS,CASH_CLOSURE_WORKSPACE_PERMISSIONS } from '@/config/cashClosurePermissions'
import { useMineClosureGate,canRegisterMineClosure } from './hooks'
import { cashTurnAction,isCashWorkspaceDate } from './cashWorkspace'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { fetchDay, finalizeDay, type DayScope, type TurnState } from '@/services/cashDailyService'
import { Notice } from './components/CashPageParts'
import { todayIn } from './components/settlementParts'
import { civilDate, formatCurrency, formatZonedDateTime } from './types'

const STATE: Record<TurnState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  OPERATING: { label: 'Operando', variant: 'destructive' }, PENDING_COUNT: { label: 'Pendiente de conteo', variant: 'destructive' }, PENDING_REVIEW: { label: 'Pendiente de revisión', variant: 'destructive' },
  RECOUNT: { label: 'Reconteo solicitado', variant: 'destructive' }, FINALIZED: { label: 'Finalizado', variant: 'outline' }, REJECTED: { label: 'Rechazado (flujo anterior)', variant: 'secondary' },
}

export default function CashDailyPage() {
  const { company, branch,isConsolidated } = useTenant(), { user,hasPermission } = useAuthPermissions()
  const permissions=CASH_CLOSURE_WORKSPACE_PERMISSIONS.filter(code=>hasPermission(code)).join(',')
  return <DailyView key={JSON.stringify([company?.id, branch?.id,isConsolidated, user?.id,permissions])} permissions={permissions} />
}

// El día operativo de la sucursal: bloqueos, turnos, efectivo y digital pendiente, armado con lo ya registrado. Finalizado no se reabre.
function DailyView({permissions}:{permissions:string}) {
  const { company, branch,isConsolidated } = useTenant(), { user,hasPermission } = useAuthPermissions(), { locale, currencyCode, timezone } = useSystemSettings(), cache = useQueryClient()
  const [params,setParams]=useSearchParams(),urlDate=params.get('fecha')||''
  const scope: DayScope = { companyId: company?.id || '', branchId: isConsolidated?'all':branch?.id || '', actorId: user?.id || '' }
  const ready=!!(scope.companyId&&scope.branchId&&scope.actorId)&&!isConsolidated&&hasPermission(...CASH_DAY_READ_PERMISSIONS)
  const [date,setDate]=useState(()=>isCashWorkspaceDate(urlDate)?urlDate:todayIn(timezone)),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[denied,setDenied]=useState(false)
  const [confirmation,setConfirmation]=useState<{date:string;key:string}|null>(null),saving=useRef(false),controller=useRef<AbortController|null>(null)
  useEffect(()=>()=>controller.current?.abort(),[])
  useEffect(()=>{setDate(isCashWorkspaceDate(urlDate)?urlDate:todayIn(timezone));setError(null);setConfirmation(null)},[urlDate,timezone])
  const query = useQuery({ queryKey: ['cash-day', scope.companyId, scope.branchId, scope.actorId,permissions,date], queryFn: ({ signal }) => fetchDay(date, scope, signal), enabled: ready&&!denied&&isCashWorkspaceDate(date),retry:false,gcTime:0 })
  const document = ready&&!denied&&!query.isError&&!query.error&&isCashWorkspaceDate(date)?query.data:undefined, v = document?.snapshot, current=document?.current
  useEffect(()=>{if(query.isError||query.error)setConfirmation(null)},[query.isError,query.error])
  const canCountOwn=hasPermission('cashclosure.create','cashclosure.create_own'),canReadTeam=hasPermission('cashclosure.view_team','cashclosure.approve','cashclosure.validate','cashclosure.correct'),canReadOwn=hasPermission('cashclosure.view')
  const {gate}=useMineClosureGate({enabled:ready&&canCountOwn&&!denied,userId:scope.actorId,timezone})
  const access={actorId:scope.actorId,canReadOwn,canReadTeam,canCountOwn:canCountOwn&&canRegisterMineClosure(gate),closableSessionId:gate.closableSessionId,finalized:document?.status==='FINALIZED',canOperatePos:hasPermission('sales.create')}
  const canFinalize=!!document?.canFinalize&&hasPermission('cash.day.close')
  const canReadClosure=(id:string)=>canReadTeam||(canReadOwn&&!!v?.turns.some(t=>t.closure_id===id&&t.responsible_id===scope.actorId))
  const money = (value: string) => { const n = Number(value); return `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(n), currencyCode, locale)}` }
  function changeDate(value:string){
    setDate(value);setError(null);setConfirmation(null)
    if(isCashWorkspaceDate(value)){const next=new URLSearchParams(params);next.set('fecha',value);next.set('vista','dia');setParams(next,{replace:true})}
  }
  async function finalize() {
    if (!confirmation||!v||!document||!canFinalize||v.blockers.length||saving.current) return
    const reviewed=confirmation,signal=(controller.current=new AbortController()).signal
    saving.current=true;setBusy(true);setError(null)
    try {
      await finalizeDay(reviewed.date,reviewed.key,scope,signal)
      if(!signal.aborted){setConfirmation(null);await cache.invalidateQueries({queryKey:['cash-day',scope.companyId,scope.branchId,scope.actorId]})}
    } catch (e) {
      if(!signal.aborted){
        setConfirmation(null)
        if([401,403,404].includes((e as {status?:number}).status||0))setDenied(true)
        if((e as {status?:number}).status===409){setConfirmation(null);await cache.invalidateQueries({queryKey:['cash-day',scope.companyId,scope.branchId,scope.actorId]})}
        setError(e instanceof TypeError?'No se recibió la confirmación del servidor. Revisa el estado del día antes de reintentar.':e instanceof Error?e.message:'No se pudo finalizar')
      }
    } finally {saving.current=false;if(!signal.aborted)setBusy(false)}
  }
  if(!ready)return <Notice>Selecciona una sucursal autorizada para revisar el día operativo.</Notice>
  if(denied)return <Notice role="alert">Ya no tienes acceso al día de esta sucursal. Actualiza tu sesión para continuar.</Notice>
  const row = (label: string, value: string) => <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{value}</dd></div>
  return <div className="min-w-0 space-y-4">
    <h2 className="sr-only">Cierre del día</h2>
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label htmlFor="day-date">Fecha operativa</Label><Input id="day-date" type="date" value={date} disabled={busy} onChange={e => changeDate(e.target.value)} className="w-[11rem]" /></div>
      {document && <div className="pb-2">{document.status === 'FINALIZED' ? <Badge variant="default">Finalizado por {document.finalizedBy}{document.finalizedAt ? ` · ${formatZonedDateTime(document.finalizedAt, timezone, locale)}` : ''}</Badge> : <Badge variant="secondary">Provisional</Badge>}</div>}
      {v && document?.status === 'PROVISIONAL' && canFinalize && <Button className="ml-auto" disabled={busy || v.blockers.length > 0} onClick={() => setConfirmation({date,key:document!.contentKey})}>{busy ? 'Finalizando…' : 'Finalizar día'}</Button>}
    </div>
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={()=>query.refetch()}>Revisar estado actual</Button></div>}
    {!isCashWorkspaceDate(date)&&<Notice role="alert">Selecciona una fecha válida para revisar el día.</Notice>}
    {query.isLoading ? <LoadingState variant="cards" message="Armando el día…" />
      : query.error ? <Notice role="alert"><div className="space-y-2"><p>{query.error instanceof TypeError?'No se pudo conectar con el servidor. Reintenta en unos segundos.':query.error instanceof Error ? query.error.message : 'No se pudo cargar el día'}</p><Button variant="outline" size="sm" onClick={()=>query.refetch()}>Reintentar</Button></div></Notice>
      : !v ? null
      : <>
        <MetricStrip label="Estado de los turnos" items={[{label:'Turnos',value:v.turns.length},{label:'Por contar',value:v.turns.filter(t=>['PENDING_COUNT','RECOUNT'].includes(t.state)).length},{label:'Por revisar',value:v.turns.filter(t=>t.state==='PENDING_REVIEW').length},{label:'Operando',value:v.turns.filter(t=>t.state==='OPERATING').length}]}/>
        {v.version!==2&&<Notice>Formato anterior · resumen original conservado. Sus importes no se recalculan ni se reinterpretan con el puente nuevo.</Notice>}
        {v.blockers.length > 0 && <section role="alert" className="auna-surface space-y-2 rounded-xl border border-destructive/40 p-4 text-sm">
          <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />Falta para finalizar</h2>
          <details><summary className="cursor-pointer">Ver pendientes ({v.blockers.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5">{v.blockers.map(b => <li key={b.sessionId}>{b.message}</li>)}</ul></details>
        </section>}
        {v.legacyNotice && <Notice>{v.legacyNotice}</Notice>}
        <section aria-labelledby="day-turns" className="auna-surface space-y-2 rounded-xl border p-4">
          <h2 id="day-turns" className="text-sm font-semibold">Turnos ({v.turns.length})</h2>
          {!v.turns.length ? <CollectionEmptyState compact title="Sin turnos ese día" description="No hubo turnos con libro de movimientos en esta sucursal para la fecha elegida." />
            : <ul className="divide-y text-sm">{v.turns.map(t => <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><span className="font-medium">{t.register_name}</span> · {t.responsible_name}{t.register_type === 'VIRTUAL' ? ' · virtual' : ''}{t.operation_mode === 'SHARED' && <span className="block text-xs text-muted-foreground">Compartida · {t.participants?.map(p => p.name).join(', ')}</span>}
                <span className="block text-xs text-muted-foreground">{formatZonedDateTime(t.opened_at, timezone, locale)}{t.closed_at ? ` – ${formatZonedDateTime(t.closed_at, timezone, locale)}` : ''}</span></span>
              {t.difference != null && <span className="tabular-nums">{Number(t.difference) === 0 ? 'Sin diferencia' : `${Number(t.difference) < 0 ? 'Faltante' : 'Sobrante'} ${money(t.difference)}`}</span>}
              <Badge variant={STATE[t.state].variant}>{STATE[t.state].label}</Badge>
              {cashTurnAction(t,access)&&<Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-9"><Link to={cashTurnAction(t,access)!.to}>{cashTurnAction(t,access)!.label}</Link></Button>}
            </li>)}</ul>}
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="day-cash" className="auna-surface rounded-xl border p-4 text-sm">
            <h2 id="day-cash" className="mb-2 font-semibold">Efectivo del día</h2>
            {v.cash.bridge?<>
              <dl className="space-y-2">{row('Saldo inicial',money(v.cash.bridge.initial))}{row('Saldo final',money(v.cash.bridge.final))}{Number(v.cash.bridge.acceptedDifference)!==0&&row(Number(v.cash.bridge.acceptedDifference)<0?'Faltante aceptado':'Sobrante aceptado',money(v.cash.bridge.acceptedDifference))}</dl>
              <p className={`mt-2 text-xs ${v.cash.bridge.balanced?'text-muted-foreground':'text-destructive'}`}>{v.cash.bridge.balanced?'El saldo cuadra.':'El saldo no cuadra. Revisa los documentos del desglose.'}</p>
              <details className="mt-3 border-t pt-3"><summary className="cursor-pointer font-medium">Ver desglose del efectivo</summary>
              <dl className="space-y-2">
                {row('Saldo inicial',money(v.cash.bridge.initial))}
                {row('Entradas externas',money(v.cash.bridge.externalIn))}{row('Salidas externas',money('-'+v.cash.bridge.externalOut))}
                {row('Neto de movimientos internos',money(v.cash.bridge.internal.net))}
                {row('Diferencia al abrir',money(v.cash.bridge.openingDifference))}
                {row(Number(v.cash.bridge.acceptedDifference)<0?'Faltante aceptado':'Diferencias aceptadas',money(v.cash.bridge.acceptedDifference))}
                <div className="border-t pt-2 font-semibold">{row('Saldo final',money(v.cash.bridge.final))}</div>
              </dl>
              <p className={`mt-2 text-xs ${v.cash.bridge.balanced?'text-muted-foreground':'text-destructive'}`}>{v.cash.bridge.balanced?'Cuadra: saldo inicial + entradas − salidas + neto interno + diferencias = saldo final.':`No cuadra: diferencia ${money(v.cash.bridge.difference)}. Revisa los documentos.`}</p>
              <details className="mt-3 border-t pt-3"><summary className="cursor-pointer font-medium">Movimientos internos y origen de fondos</summary>
                <dl className="mt-2 space-y-1">
                  {row('Fondo inicial declarado',money(v.cash.bridge.declaredInitial))}{row('Heredado de otros días',money(v.cash.bridge.inheritedInitial))}
                  {row('Herencia entre turnos del mismo día (no se suma)',money(v.cash.bridge.internal.inheritedWithinDay))}
                  {row('Recibido de custodia u otra caja al abrir',money(v.cash.bridge.internal.openingTransfersIn))}
                  {v.cash.bridge.internal.floatTransfersOut&&row('Traslados desde fondos retenidos',money(v.cash.bridge.internal.floatTransfersOut))}
                  {v.cash.bridge.internal.floatTransfersReceived&&row('Recibido en fondos retenidos del día',money(v.cash.bridge.internal.floatTransfersReceived))}
                  {row('Traslados recibidos durante turnos',money(v.cash.bridge.internal.sessionsIn))}{row('Traslados enviados durante turnos',money(v.cash.bridge.internal.sessionsOut))}
                  {row('Entregado a custodia',money(v.cash.bridge.internal.delivered))}{row('Fondo retenido al final',money(v.cash.bridge.retainedFinal))}{row('Contado sin entregar',money(v.cash.bridge.undeliveredFinal))}
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Son movimientos internos, no ventas ni nuevos ingresos de la sucursal. El saldo final abarca estos turnos y sus fondos retenidos; no es el saldo total de las custodias.</p>
              </details>
              </details>
            </>:<dl className="space-y-1">
              {row('Fondo inicial', money(v.cash.opening))}{row('Cobros en efectivo', money(v.cash.received))}
              {Number(v.cash.fundIn) > 0 && row('Ingresos de fondo', money(v.cash.fundIn))}{Number(v.cash.custodyIn) > 0 && row('Recibido de custodia', money(v.cash.custodyIn))}
              {row('Retiros y pagos', `−${formatCurrency(v.cash.paidOut, currencyCode, locale)}`)}{Number(v.cash.sentToCustody) > 0 && row('Enviado a custodia durante el turno', `−${formatCurrency(v.cash.sentToCustody, currencyCode, locale)}`)}
              {row('Entregado a custodia', money(v.cash.delivered))}{row('Fondo retenido para el siguiente turno', money(v.cash.retained))}
              {row(Number(v.cash.acceptedDifference) < 0 ? 'Faltante aceptado' : Number(v.cash.acceptedDifference) > 0 ? 'Sobrante aceptado' : 'Diferencias aceptadas', money(v.cash.acceptedDifference))}
              {v.cash.inTransit.count > 0 && row(`En tránsito (${v.cash.inTransit.count})`, money(v.cash.inTransit.amount))}
            </dl>}
            {v.cash.bridge&&v.cash.inTransit.count>0&&<p className="mt-2 text-xs text-muted-foreground">En tránsito ({v.cash.inTransit.count}): {money(v.cash.inTransit.amount)}. Recepción no confirmada.</p>}
          </section>
          <section aria-labelledby="day-digital" className="auna-surface rounded-xl border p-4 text-sm">
            <h2 id="day-digital" className="mb-2 font-semibold">Digital del día operativo</h2>
            <dl className="space-y-1">
              {v.digital.byMethod.map(m => <div key={m.name}>{row(m.name, money(m.amount))}</div>)}
              {row(document?.status==='FINALIZED'?'Por liquidar al finalizar':'Por liquidar al revisar', money(v.digital.toSettle))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Lo digital pendiente no impide finalizar: se concilia en su propio documento.</p>
            {v.version!==2&&<p className="mt-2 text-xs text-muted-foreground">Los avisos o depósitos incluidos en el formato anterior no se presentan como cobros confirmados del día.</p>}
          </section>
        </div>
        {v.entries.length > 0 && <p className="text-xs text-muted-foreground">Asientos de los arqueos del día: {v.entries.join(', ')}. Finalizar el día no crea asientos.</p>}
        {current&&<details aria-labelledby="day-current" className="space-y-3 rounded-xl border border-dashed p-4 text-sm"><summary id="day-current" className="cursor-pointer font-medium">Estado actual · pendientes y conciliación</summary>
          {!!current.corrections?.length&&<section className="space-y-2 border-b pb-3"><h2 className="font-semibold">{document?.status==='FINALIZED'?'Correcciones posteriores':'Correcciones de los arqueos'}</h2><p className="text-xs text-muted-foreground">Fuera de la instantánea histórica. No cambian el saldo de custodias ni registran dinero recibido.</p><ul className="divide-y">{current.corrections.map(c=><li key={c.id} className="flex flex-wrap justify-between gap-2 py-2"><div>{canReadClosure(c.closure_id)?<Link className="font-medium underline" to={`/cierre-caja/${c.closure_id}/correcciones/${c.id}`}>Arqueo #{c.closure_number} · Corrección {c.sequence}</Link>:<span className="font-medium">Arqueo #{c.closure_number} · Corrección {c.sequence}</span>}<p className="text-xs text-muted-foreground">Fecha contable {civilDate(c.accounting_date,locale)} · {c.entry_number||'Sin asiento'}</p></div><span>Cambio en efectivo: {formatCurrency(c.cash_delta,c.currency_code,locale)}</span></li>)}</ul></section>}
          <div><p className="text-xs text-muted-foreground">Consultado el {formatZonedDateTime(current.asOf,timezone,locale)} · fuera de la instantánea histórica.</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><h3 className="font-medium">Avisos por confirmar ({current.pendingNotices.count})</h3><p>{money(current.pendingNotices.amount)} · no es dinero confirmado.</p><p className="text-xs text-muted-foreground">Son pendientes actuales de toda la sucursal; no se suman al día elegido.</p></div>
            <div><h3 className="font-medium">Cobros de este día: por liquidar ahora</h3><p>{money(current.toSettle)}</p>{current.settlementReferences.length>0&&<ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{current.settlementReferences.map(s=><li key={s.id}>{hasPermission('cash.settlements.manage','cash.bank_methods.manage')?<Link className="underline" to={`/cierre-caja/liquidaciones/${s.id}`}>{s.reference}</Link>:<span>{s.reference}</span>} · {civilDate(s.deposited_on,locale)}</li>)}</ul>}</div>
          </div>
          {current.disputes&&(current.disputes.items.length>0||current.disputes.chargesIssued.count>0)&&<section aria-label="Disputas de cobros digitales" className="space-y-2 border-t pt-3"><h3 className="font-medium">Disputas con fecha de este día</h3>
            <p>Retirado por el proveedor {money(current.disputes.withdrawn)} · Recuperado {money(current.disputes.recovered)}{Number(current.disputes.fees)>0&&<> · Comisiones {money(current.disputes.fees)}</>}{current.disputes.chargesIssued.count>0&&<> · Cargos emitidos {current.disputes.chargesIssued.count} por {money(current.disputes.chargesIssued.amount)}</>}</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">{current.disputes.items.map(d=><li key={d.id}>{hasPermission('cash.disputes.view','cash.disputes.manage','cash.disputes.movements','cash.disputes.resolve')?<Link className="underline" to={`/cierre-caja/disputas/${d.disputeId}`}>{d.providerReference}</Link>:<span>{d.providerReference}</span>}{d.inSettlement&&<span className="text-xs text-muted-foreground"> · en liquidación</span>}</li>)}</ul>
            <p className="text-xs text-muted-foreground">No cambian el efectivo del día ni el arqueo original; los cargos son deuda del cliente, no dinero recibido.</p></section>}
          <p className="border-t pt-2 text-xs text-muted-foreground">Depósitos del proveedor con fecha real {civilDate(current.depositsByRealDate.date,locale)}: {current.depositsByRealDate.count} · {money(current.depositsByRealDate.net)}. No forman parte del día operativo ni cambian su huella. La fecha contable corresponde al asiento de cada documento.</p>
        </details>}
      </>}
    <ConfirmDialog open={!!confirmation&&document?.status==='PROVISIONAL'&&canFinalize} onOpenChange={open=>{if(!open&&!busy)setConfirmation(null)}} title={`Finalizar el día ${confirmation?civilDate(confirmation.date,locale):''}`} description="Se guardará el resumen revisado y quedarán bloqueadas las nuevas aperturas con esta fecha operativa. Los pendientes de conciliación mantienen su propio seguimiento." confirmText="Finalizar día" cancelText="Seguir revisando" appearance="auna" loading={busy} onConfirm={finalize}/>
  </div>
}
