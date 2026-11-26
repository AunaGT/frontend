import {useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Plus,Search} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {DataTable} from '@/components/shared/DataTable'
import {Pagination} from '@/components/shared/Pagination'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {LoadingState} from '@/components/shared/LoadingState'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {fetchDisputeCapabilities,fetchDisputes,disputeStatus,type DisputeListItem} from '@/services/cashDisputeService'
import {useDisputeIdentity} from './hooks/useDisputeIdentity'
import {CashClosureTabs} from './components/CashClosureTabs'
import {Notice} from './components/CashPageParts'
import {civilDate,formatCurrency,formatZonedDateTime} from './types'
export default function CashDisputesPage(){const identity=useDisputeIdentity(true);return <DisputesList key={identity.key}/>}
function DisputesList(){
  const identity=useDisputeIdentity(true),navigate=useNavigate(),{locale,timezone}=useSystemSettings()
  const [search,setSearch]=useState(''),[q,setQ]=useState(''),[status,setStatus]=useState('ALL'),[page,setPage]=useState(1)
  usePageTrail([{label:'Caja',to:'/cierre-caja'},{label:'Disputas bancarias'}])
  const caps=useQuery({queryKey:['cash-dispute-capabilities',identity.key],queryFn:({signal})=>fetchDisputeCapabilities(identity.scope,signal),enabled:identity.ready,retry:false,gcTime:0})
  const list=useQuery({queryKey:['cash-disputes',identity.key,q,status,page],queryFn:({signal})=>fetchDisputes(identity.scope,{q,status:status==='ALL'?undefined:status,page},signal),enabled:identity.ready&&!!caps.data?.available&&!!caps.data.can.read,retry:false,gcTime:0})
  const available=!caps.isError&&caps.data?.available
  return <div className="auna-page-fluid mx-auto min-w-0 space-y-4 p-4 sm:p-6">
    <h1 className="sr-only">Disputas bancarias</h1><CashClosureTabs value="disputes"/>
    {!identity.ready?<Notice>Selecciona una empresa y una sucursal autorizadas para consultar los reclamos.</Notice>:caps.isPending?<LoadingState variant="detail" message="Cargando disputas…"/>:caps.isError?<Notice role="alert">{caps.error.message}</Notice>:!available?<Notice>Las disputas bancarias todavía no están habilitadas en esta empresa. Los cobros y saldos actuales siguen disponibles.</Notice>:<>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Disputas bancarias</h2><p className="text-sm text-muted-foreground">Da seguimiento a los reclamos del banco o proveedor y a sus resoluciones.</p></div>{caps.data.commandsAvailable&&caps.data.can.manage&&<Button onClick={()=>navigate('/cierre-caja/disputas/nueva')}><Plus className="h-4 w-4" aria-hidden/>Nuevo reclamo</Button>}</div>
      {!caps.data.commandsAvailable&&<p className="text-xs text-muted-foreground">{caps.data.reason}</p>}
      <form className="flex flex-wrap items-center gap-2" onSubmit={e=>{e.preventDefault();setPage(1);setQ(search.trim())}}>
        <div className="relative w-full sm:w-80"><Search aria-hidden className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" aria-label="Buscar por referencia o motivo" placeholder="Referencia o motivo…" maxLength={120} value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="w-48"><Select value={status} onValueChange={v=>{setStatus(v);setPage(1)}}><SelectTrigger aria-label="Estado del reclamo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los estados</SelectItem>{Object.entries(disputeStatus).map(([v,label])=><SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" type="submit">Buscar</Button>
      </form>
      {list.isError?<Notice role="alert">{list.error.message}</Notice>:list.isPending?<LoadingState variant="table" message="Cargando reclamos…"/>:!list.data?.items.length?<CollectionEmptyState title="Sin disputas bancarias" description="Aquí aparecerán los reclamos registrados para los cobros de la sucursal."/>:<>
        <div className="auna-data-table-shell auna-surface min-w-0 overflow-x-auto rounded-lg border"><DataTable<DisputeListItem> data={list.data.items} keyExtractor={d=>d.id} columns={[
          {key:'provider_reference',header:'Referencia',render:d=><div><Link className="font-medium underline-offset-2 hover:underline" to={`/cierre-caja/disputas/${d.id}`}>{d.provider_reference}</Link><p className="text-xs text-muted-foreground">{formatZonedDateTime(d.created_at,timezone,locale)}</p></div>},
          {key:'status',header:'Estado',render:d=><Badge variant="outline">{disputeStatus[d.status]}</Badge>},
          {key:'claimed',header:'Reclamado',className:'text-right tabular-nums',render:d=>formatCurrency(d.claimed,d.currency_code,locale)},
          {key:'deadline',header:'Responder antes de',className:'hidden sm:table-cell',render:d=>d.deadline?civilDate(d.deadline,locale):'Sin plazo registrado'},
        ]}/></div>
        <div className="auna-pagination-outside"><Pagination currentPage={list.data.page} totalPages={list.data.totalPages} pageSize={list.data.pageSize} totalItems={list.data.totalItems} count={list.data.items.length} itemLabel="disputas" onPageChange={setPage} loading={list.isFetching}/></div>
      </>}
    </>}
  </div>
}
