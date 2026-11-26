import {Link} from 'react-router-dom'
import {Pagination} from '@/components/shared/Pagination'
import {correctionStatus,correctionAccountingStatus,type CorrectionList} from '@/services/cashCorrectionService'
import {formatDateTime} from '../types'
export function CorrectionHistory({closureId,list,page,onPage}:{closureId:string;list:CorrectionList;page:number;onPage:(page:number)=>void}){
  if(!list.totalItems)return null
  return <section className="auna-surface space-y-3 rounded-lg border p-4"><div><h2 className="font-semibold">Correcciones de la declaración</h2><p className="text-xs text-muted-foreground">Las cifras de este arqueo son las originales. Los cambios se consultan en sus propios documentos.</p></div><ul className="divide-y">{list.items.map(c=><li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div className="min-w-0"><Link to={`/cierre-caja/${closureId}/correcciones/${c.id}`} className="font-medium underline">{c.sequence?`Corrección ${c.sequence}`:'Propuesta'} · {correctionStatus[c.status]}</Link><p className="text-xs text-muted-foreground">{formatDateTime(c.proposedAt)} · {correctionAccountingStatus[c.accountingStatus]}</p><p className="max-w-[70ch] truncate">{c.reason}</p></div></li>)}</ul>{list.totalItems>list.pageSize&&<Pagination currentPage={page} totalPages={Math.ceil(list.totalItems/list.pageSize)} onPageChange={onPage} itemLabel="correcciones" />}</section>
}
