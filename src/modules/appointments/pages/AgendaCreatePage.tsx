import {useLocation,useNavigate,useSearchParams} from 'react-router-dom'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useAgendaContext} from '../useAgendaContext'
import {AgendaCreateForm} from '../components/AgendaCreateForm'
import {creationDestination,type CreationHandoff} from '../creationDraft'
import {newActivity} from '../activityDraft'
import '../appointments.css'
export default function AgendaCreatePage({kind}:{kind?:'SERVICE'|'ACTIVITY'}){
  const ctx=useAgendaContext(),location=useLocation(),navigate=useNavigate(),[params]=useSearchParams()
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:'Agendar'}])
  const handoff=location.state?.creationDraft as CreationHandoff|undefined
  const initial=handoff?.scope.companyId===ctx.scope.companyId&&handoff.scope.branchId===ctx.scope.branchId?handoff.value:
    {kind:kind||(ctx.canUseCatalog?'SERVICE':'ACTIVITY'),activity:newActivity(ctx.user?.id||'',ctx.timezone,{startsAt:params.get('inicio')||'',endsAt:params.get('fin')||''})}
  return <main className="agenda-page"><h1 className="sr-only">Agendar</h1><AgendaCreateForm key={`${ctx.scope.companyId}:${ctx.scope.branchId}`} initial={initial} onClose={()=>navigate('/agenda')} onSaved={(row,type)=>navigate(creationDestination(type,row.id),{replace:true,state:null})}/></main>
}
