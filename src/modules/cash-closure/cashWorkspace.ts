import type {DayTurn} from '@/services/cashDailyService'
import {CASH_DISPUTE_PERMISSIONS} from '@/config/cashClosurePermissions'
export function isCashWorkspaceDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const date=new Date(value+'T12:00:00Z')
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value
}
export function cashDayWorkspaceLink(search:string){
  const params=new URLSearchParams(search);params.set('vista','dia')
  return `/cierre-caja?${params}`
}
export function cashWorkspaceView({day,history,consolidated,requested}:{day:boolean;history:boolean;consolidated:boolean;requested:string|null}){
  if(requested==='dia'&&day)return 'dia'
  if(requested==='historial'&&history)return 'historial'
  return day&&!consolidated?'dia':history?'historial':day?'dia':null
}
export function cashWorkspaceFallback(hasPermission:(...codes:string[])=>boolean){
  if(hasPermission('cash.movements.view_own','cash.movements.view_team'))return '/cierre-caja/movimientos'
  if(hasPermission('cash.custody.view','cash.custody.manage','cash.transfers.operate_own','cash.transfers.operate_team','cash.transfers.receive'))return '/cierre-caja/traslados'
  if(hasPermission('cash.notices.create','cash.digital.confirm'))return '/cierre-caja/cobros-digitales'
  if(hasPermission('cash.settlements.manage'))return '/cierre-caja/liquidaciones'
  if(hasPermission('cash.bank_methods.manage'))return '/cierre-caja/medios-bancarios'
  if(hasPermission(...CASH_DISPUTE_PERMISSIONS))return '/cierre-caja/disputas'
  return null
}
type TurnAccess={actorId:string;canReadOwn:boolean;canReadTeam:boolean;canCountOwn:boolean;closableSessionId:string|null;finalized:boolean;canOperatePos?:boolean}
export function cashTurnAction(turn:Pick<DayTurn,'id'|'state'> & Partial<DayTurn>,access:TurnAccess){
  if(turn.state==='OPERATING'&&access.canOperatePos&&(turn.responsible_id===access.actorId||turn.participants?.some(p=>p.user_id===access.actorId)))return {label:'Ir al POS',to:'/pos'}
  if(!access.finalized&&access.canCountOwn&&turn.id===access.closableSessionId&&['PENDING_COUNT','RECOUNT'].includes(turn.state)){
    return {label:turn.state==='RECOUNT'?'Recontar':'Contar',to:`/cierre-caja/nuevo?turno=${encodeURIComponent(turn.id)}`}
  }
  if(turn.closure_id&&(access.canReadTeam||(access.canReadOwn&&!!turn.responsible_id&&turn.responsible_id===access.actorId))){
    return {label:turn.state==='PENDING_REVIEW'?'Revisar':turn.state==='RECOUNT'?'Ver reconteo':'Ver arqueo',to:`/cierre-caja/${encodeURIComponent(turn.closure_id)}`}
  }
  return null
}
