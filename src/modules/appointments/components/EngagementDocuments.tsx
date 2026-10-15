import {useState} from 'react'
import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {useAgendaContext} from '../useAgendaContext'
import {useEngagementCommand} from '../engagementDraft'
import {useDraftGuard} from './DraftGuard'
import {FormFeedback} from './FormFeedback'
import {EngagementContextReview} from './EngagementPaymentForm'
import {engagementMoney} from './EngagementLines'
import type {EngagementDetail} from '../commercialTypes'

export function EngagementDocuments({engagement,onSaved,onRefresh}:{engagement:EngagementDetail;onSaved:(e:EngagementDetail)=>void;onRefresh?:()=>Promise<EngagementDetail|undefined>}){
  const ctx=useAgendaContext(),[creating,setCreating]=useState(false)
  const draft=engagement.commercialDocument
  const links=[{id:engagement.quoteId,to:`/cotizaciones/${engagement.quoteId}`,label:'Cotización aceptada',permission:'quotes.view'},
    {id:engagement.orderId,to:`/pedidos/${engagement.orderId}`,label:'Pedido vinculado',permission:'orders.view'},
    {id:draft?.id||engagement.saleId,to:`/ventas/${draft?.id||engagement.saleId}/factura`,label:draft?.state==='DRAFT'?'Borrador de venta':draft?.state==='CANCELLED'?'Venta cancelada':'Venta confirmada',permission:'sales.view'},
    {id:engagement.customer.id,to:`/cartera/${engagement.customer.id}`,label:'Estado de cuenta del cliente',permission:'receivables.view'}]
  return <section className="agenda-panel space-y-4"><h2>Documentos vinculados</h2><ul className="divide-y">{links.filter(l=>l.id&&ctx.hasPermission(l.permission)).map(l=><li key={l.label} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{l.label}</span><Button asChild variant="outline" size="sm"><Link to={l.to}>Abrir documento</Link></Button></li>)}</ul>{engagement.correctionEngagementId&&<p className="text-sm">Este alcance fue sustituido. <Link className="underline" to={`/agenda/contrataciones/${engagement.correctionEngagementId}`}>Abrir contratación corregida</Link></p>}{engagement.supersedesEngagementId&&<p className="text-sm"><Link className="underline" to={`/agenda/contrataciones/${engagement.supersedesEngagementId}`}>Ver alcance anterior y sus fondos</Link>. No se transfirieron pagos automáticamente.</p>}{!engagement.saleId&&engagement.money&&<div className="border-t pt-4">{draft?<><p className="mb-3 text-sm text-muted-foreground">Confirmar este borrador aplica los anticipos existentes. No registra otro cobro, no emite factura fiscal ni finaliza el servicio.</p>{draft.state==='DRAFT'&&ctx.writable&&engagement.capabilities?.issueSale&&<Button asChild><Link to={`/ventas/${draft.id}/confirmar`}>Confirmar venta</Link></Button>}</>:creating?<EngagementSaleForm engagement={engagement} onRefresh={onRefresh} onSaved={e=>{setCreating(false);onSaved(e)}} onCancel={()=>setCreating(false)}/>:<><p className="mb-3 text-sm text-muted-foreground">Confirmar la venta aplica los anticipos existentes, sin registrar otro cobro ni finalizar la programación.</p>{engagement.capabilities?.reason&&<p className="mb-3 text-sm" role="status">{engagement.capabilities.reason}</p>}<Button disabled={!ctx.writable||!engagement.capabilities?.issueSale} onClick={()=>setCreating(true)}>Preparar confirmación</Button></>}</div>}</section>
}
export function EngagementSaleForm({engagement,onSaved,onCancel,onRefresh}:{engagement:EngagementDetail;onSaved:(e:EngagementDetail)=>void;onCancel:()=>void;onRefresh?:()=>Promise<EngagementDetail|undefined>}){
  const ctx=useAgendaContext(),command=useEngagementCommand({scope:ctx.scope,engagementId:engagement.id,version:engagement.version})
  const [condition,setCondition]=useState('CASH'),[dueDate,setDueDate]=useState(''),[dispatch,setDispatch]=useState(false),[override,setOverride]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState<string|null>(null)
  const goods=!engagement.orderId&&engagement.lines.some(l=>l.itemKind!=='SERVICE'),money=engagement.money
  const allowed=ctx.writable&&!!engagement.capabilities?.issueSale&&!!money&&!engagement.saleId
  const guard=useDraftGuard(condition!=='CASH'||!!dueDate||dispatch||override||command.pending)
  const save=async()=>{
    setConfirm(false)
    if(!allowed||command.pending)return
    const result=await command.send<EngagementDetail>('sale',{paymentCondition:condition,...(dueDate?{dueDate}:{}),confirmGoodsDispatch:dispatch,creditOverride:override})
    if(result)guard.proceed(()=>onSaved(result))
  }
  return <form className="space-y-4" onSubmit={e=>{e.preventDefault();if(!allowed||command.pending)return;if(goods&&!dispatch){setError('Confirma el despacho de los bienes antes de confirmar la venta.');return}setError(null);setConfirm(true)}}>{guard.dialog}<h3 className="font-semibold">Confirmar venta</h3><FormFeedback error={error||command.error} fields={command.fields}/>{money&&<p className="text-sm">Total {engagementMoney(money.total,money.currencyCode)} · Anticipos {engagementMoney(money.committed,money.currencyCode)} · Saldo {engagementMoney(money.remaining,money.currencyCode)}</p>}<fieldset disabled={!allowed||command.pending} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label id="engagement-sale-condition">Condición de pago</Label><Select value={condition} onValueChange={setCondition}><SelectTrigger aria-labelledby="engagement-sale-condition"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="CASH">Contado · saldo completamente cubierto</SelectItem><SelectItem value="CREDIT">Crédito · conservar saldo por cobrar</SelectItem></SelectContent></Select></div>{condition==='CREDIT'&&<div><Label htmlFor="engagement-sale-due">Vencimiento (opcional)</Label><Input id="engagement-sale-due" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/><p className="mt-1 text-xs text-muted-foreground">Si se omite, se usarán los términos del cliente o de la cotización.</p></div>}</div>{condition==='CREDIT'&&ctx.hasPermission('sales.credit.override')&&<label className="flex items-start gap-2 text-sm"><Checkbox checked={override} onCheckedChange={v=>setOverride(v===true)}/>Autorizar excepción al límite de crédito</label>}{goods&&<label className="flex items-start gap-2 text-sm"><Checkbox aria-label="Confirmar despacho de bienes" checked={dispatch} onCheckedChange={v=>setDispatch(v===true)}/>Confirmo el despacho de los bienes incluidos. Se descontarán existencias una sola vez al confirmar esta venta.</label>}{engagement.orderId&&<p className="text-sm text-muted-foreground">Los bienes se facturarán desde el pedido y sus entregas confirmadas, sin descontar existencias nuevamente.</p>}</fieldset><EngagementContextReview version={engagement.version} pending={command.pending} onRefresh={onRefresh} onReviewed={command.reviewVersion}/><div className="agenda-actions"><Button type="button" variant="outline" disabled={command.pending} onClick={()=>guard.request(onCancel)}>Cancelar</Button><Button type="submit" disabled={!allowed||command.pending}>{command.pending?'Confirmando…':'Revisar y confirmar venta'}</Button></div><ConfirmDialog open={confirm} onOpenChange={setConfirm} appearance="auna" title="Confirmar venta vinculada" description="Se usará el alcance y los precios acordados, se aplicarán los recibos existentes y se confirmará este mismo documento. Esta acción no cobra dinero adicional ni finaliza servicios." confirmText="Confirmar venta" onConfirm={save}/></form>
}
