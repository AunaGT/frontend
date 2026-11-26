import {Link} from 'react-router-dom'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {disputeEventLabel,type DisputeAccounting} from '@/services/cashDisputeService'
import {Notice} from './CashPageParts'
import {civilDate} from '../types'

// onPost solo llega cuando la persona tiene permiso contable y los comandos están liberados.
export function CashDisputeAccounting({accounting,locale,canViewSettlement=false,onPost,posting=false}:{accounting?:DisputeAccounting;locale?:string;canViewSettlement?:boolean;onPost?:()=>void;posting?:boolean}){
  const deferred=!!accounting?.enabled&&!!accounting.sources.some(source=>source.status==='DEFERRED')
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-base font-semibold">Contabilidad del expediente</h2><p className="mt-1 text-sm text-muted-foreground">{accounting?.enabled?'Cada movimiento conserva su origen, asiento y fecha contable.':'La contabilidad está desactivada. El expediente conserva sus movimientos pendientes de contabilizar.'}</p></div>{onPost&&deferred&&<Button size="sm" disabled={posting} onClick={onPost}>{posting?'Contabilizando…':'Contabilizar pendientes'}</Button>}</div>
    {!!accounting?.issues.length&&<Notice role="alert"><ul className="min-w-0 space-y-1">{accounting.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></Notice>}
    {!accounting?.sources.length?<p className="text-sm text-muted-foreground">Aún no hay fuentes monetarias que contabilizar.</p>:<ul className="divide-y">{accounting.sources.map(source=><li key={source.id} className="space-y-2 py-3 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm"><div className="min-w-0"><h3 className="font-medium">{disputeEventLabel[source.kind]||'Resolución'}</h3><p className="mt-0.5 text-xs text-muted-foreground">{source.economicOn&&<>Fecha efectiva: {civilDate(source.economicOn,locale)} · </>}{source.accountingOn?`Contable: ${civilDate(source.accountingOn,locale)}`:source.suggestedAccountingOn?`Sugerida: ${civilDate(source.suggestedAccountingOn,locale)} · sin contabilizar`:'Fecha contable pendiente'}</p></div><div className="shrink-0 text-right"><Badge variant="outline">{{POSTED:'Contabilizado',INTEGRATED:'En liquidación',DEFERRED:'Sin contabilizar',ZERO:'Sin efecto contable'}[source.status]||source.status}</Badge>{source.entryNumber&&<p className="mt-1 text-xs">{source.entryNumber}</p>}</div></div>
      {source.accountingRoute==='SETTLEMENT'&&<p className="text-xs text-muted-foreground">{source.status==='INTEGRATED'?'Incluido en la liquidación: usa el mismo asiento del depósito.':'Se contabiliza con la liquidación original.'}</p>}
      {source.accountingRoute==='RECLASSIFICATION'&&<p className="text-xs text-muted-foreground">Reclasificación contable del gasto a fondos en disputa. El depósito conserva su importe y asiento originales.</p>}
      {source.settlementId&&<div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-xs text-muted-foreground">Liquidación {source.settlementReference||'vinculada'}</p>{canViewSettlement&&<Button variant="outline" size="sm" asChild><Link to={`/cierre-caja/liquidaciones/${encodeURIComponent(source.settlementId)}`}>Ver liquidación</Link></Button>}</div>}
      {(source.dateChangeReason||source.suggestedDateChangeReason)&&<details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1">Motivo de la fecha contable</summary><p className="mt-1 whitespace-pre-wrap break-words">{source.dateChangeReason||source.suggestedDateChangeReason}</p></details>}
    </li>)}</ul>}
  </div>
}
