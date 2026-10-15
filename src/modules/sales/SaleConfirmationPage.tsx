import {Link, useNavigate, useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {fetchSaleById} from '@/services/saleService'
import {normalizeRawSale} from './hooks/useSalesData'
import {useAgendaContext} from '../appointments/useAgendaContext'
import {assertCurrentScope} from '../appointments/api'
import {getCommercialEngagement} from '../appointments/commercialApi'
import {EngagementSaleForm} from '../appointments/components/EngagementDocuments'
import '../appointments/appointments.css'
import './components/saleDetail.css'

export default function SaleConfirmationPage(){
  const {id=''}=useParams(),navigate=useNavigate(),ctx=useAgendaContext()
  usePageTrail([{label:'Ventas',to:'/ventas'},{label:'Confirmar venta'}])
  const saleQuery=useQuery({queryKey:['sales',ctx.scope.companyId,ctx.scope.branchId,id,'confirmation'],enabled:ctx.ready&&!!id,queryFn:async({signal})=>{
    assertCurrentScope(ctx.scope,signal)
    const raw=await fetchSaleById(id)
    assertCurrentScope(ctx.scope,signal)
    return normalizeRawSale(raw)
  }})
  const sale=saleQuery.data,origin=sale?.commercial?.originEngagementId
  const engagementQuery=useQuery({queryKey:['sales',ctx.scope.companyId,ctx.scope.branchId,id,'confirmation-origin',origin],enabled:ctx.ready&&!!origin&&!!sale?.capabilities?.confirm,queryFn:({signal})=>getCommercialEngagement(ctx.scope,origin!,signal)})
  const back=`/ventas/${encodeURIComponent(id)}/factura`
  return <div className="sale-document-page space-y-5"><header className="sale-document-toolbar"><h1 className="text-xl font-semibold">Confirmar venta {sale?.reference}</h1><Button asChild variant="outline"><Link to={back}>Volver al detalle</Link></Button></header>
    {!ctx.ready?<p role="status">Selecciona una empresa y sucursal con acceso a Agenda.</p>:saleQuery.error||engagementQuery.error?<p role="alert" className="text-destructive">{(saleQuery.error||engagementQuery.error)?.message}</p>:!sale?<p role="status">Cargando venta…</p>:sale.commercial?.state==='CONFIRMED'?<p>Esta venta ya está confirmada. <Link className="underline" to={back}>Ver resultado</Link></p>:!ctx.writable||!sale.capabilities?.confirm||!origin?<p role="status">{sale.capabilities?.reason||'No puedes confirmar esta venta desde este contexto.'}</p>:!engagementQuery.data?<p role="status">Cargando alcance y anticipos…</p>:<section className="agenda-panel space-y-4"><p className="text-sm text-muted-foreground">Se confirmará este mismo borrador. Los anticipos existentes se aplicarán una sola vez. Confirmar no emite una factura fiscal ni finaliza el servicio.</p><EngagementSaleForm engagement={engagementQuery.data} onRefresh={async()=> (await engagementQuery.refetch()).data} onCancel={()=>navigate(back)} onSaved={()=>navigate(back)}/></section>}
  </div>
}
