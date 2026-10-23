import {useEffect,useMemo,useRef,useState} from 'react'
import {Link,Navigate,useNavigate,useParams,useSearchParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {ArrowLeft,Loader2,Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {Badge} from '@/components/ui/badge'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {ProductPicker} from '@/components/shared/ProductPicker'
import {ScannerField} from '@/components/shared/ScannerField'
import {resolveContextScan} from '@/services/contextScannerService'
import {UnitLineFields} from '@/components/shared/UnitLineFields'
import {SalePresentationDialog} from './components/SalePresentationDialog'
import {SavedCustomerMany2One} from './components/SavedCustomerMany2One'
import {useTenant} from '@/context/useTenant'
import {useAuth} from '@/context/useAuth'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useToast} from '@/hooks/use-toast'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import {adaptApiProduct,fetchPosCatalogItems} from '@/services/productService'
import {selectProductUnit,selectedUnitPayload,formatUnitDecimal,unitCartKey,addUnitQuantities,type UnitSelection} from '@/modules/inventory/units/public'
import {useDraftGuard} from '../appointments/components/DraftGuard'
import {assertManualScope,readManualSale,previewManualSale,saveManualSale,confirmManualSale,cancelManualSale,type ManualSale,type ManualSaveInput} from './manualSalesApi'
import type {Product,Supplier} from '@/types'
import {formatMoney} from '@/utils/formatters'

type Line={key:string;productId:string;name:string;kind:string;qty:string;unitLabel:string;price:string;lineTotal:string;product?:Product;selection?:UnitSelection}
type Form={customerId:string|null;customerName:string;customerNit:string;lines:Line[]}
const emptyForm=():Form=>({customerId:null,customerName:'',customerNit:'',lines:[]})
const fields=(form:Form)=>({customerId:form.customerId,customerName:form.customerName,customerNit:form.customerNit,items:form.lines.map(l=>({product_id:l.productId,qty:l.qty,...selectedUnitPayload(l.selection)}))})

export default function ManualSalePage(){
 const {id}=useParams(),[search]=useSearchParams(),navigate=useNavigate(),tenant=useTenant(),{user}=useAuth(),permissions=useAuthPermissions(),{locale,currencyCode,salesAllowCredit}=useSystemSettings(),{toast}=useToast(),queries=useQueryClient()
 const canCreate=permissions.hasPermission('sales.create'),scope={companyId:tenant.company?.id||'',branchId:tenant.isConsolidated?'all':tenant.branch?.id||'',userId:user?.id||''}
 const session=authSessionIdentity(),identity=JSON.stringify([scope.companyId,scope.branchId,scope.userId,session,canCreate]),live=useRef(identity);live.current=identity
 const owner=useMemo(()=>({key:identity,active:true,controller:new AbortController()}),[identity])
 const current=()=>owner.active&&live.current===owner.key&&authSessionIdentity()===session&&authSessionMatches(scope.userId)
 const ready=!!scope.companyId&&!!scope.branchId&&scope.branchId!=='all'&&!!scope.userId&&permissions.permissionsReady&&canCreate
 const [form,setForm]=useState<Form>(emptyForm),[saved,setSaved]=useState<ManualSale|null>(null),[savedKey,setSavedKey]=useState(''),[loading,setLoading]=useState(!!id),[loadError,setLoadError]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false),[dueDate,setDueDate]=useState(''),[creditOverride,setCreditOverride]=useState(false),[dialog,setDialog]=useState<'confirm'|'cancel'|null>(null)
 const savedRef=useRef<ManualSale|null>(null),busy=useRef(false),attempt=useRef<{signature:string;key:string}|null>(null)
 const [pendingPresentation,setPendingPresentation]=useState<{product:Product;context:string}|null>(null)
 const presentationContext=useRef(''),handledPresentation=useRef<object|null>(null)
 presentationContext.current=JSON.stringify([identity,id??null])
 const formKey=JSON.stringify(fields(form)),dirty=saved?formKey!==savedKey:!!(form.lines.length||form.customerId||form.customerName||form.customerNit)
 const guard=useDraftGuard(dirty,tenant.registerTenantExitGuard,identity)
 usePageTrail([{label:'Ventas',to:'/ventas'},{label:saved?.reference||'Nueva venta'}])
 function applySaved(value:ManualSale,products:Map<string,Product>){
  const next:Form={customerId:value.customerId,customerName:value.customerName,customerNit:value.customerNit,lines:value.items.map(l=>{
   const product=products.get(l.productId),snapshot=l.unitSnapshot
   const selection:UnitSelection|undefined=l.unitMetadataVersion===2&&snapshot?{version:2,presentationId:snapshot.presentation?.id??null,revision:product?.unitConfiguration?.unit_revision??0,priceContext:'WHOLESALE',unitPrice:l.unitPrice,snapshot,acceptRounding:snapshot.roundingDelta!=='0',reviewRequired:!product?.unitConfiguration}:undefined
   return{key:String(l.id),productId:l.productId,name:l.name,kind:l.kind,qty:l.qty,unitLabel:l.unitLabel,price:l.unitPrice,lineTotal:l.lineTotal,product,selection}
  })}
  savedRef.current=value;setSaved(value);setForm(next);setSavedKey(JSON.stringify(fields(next)))
 }
 useEffect(()=>{
  owner.active=true;busy.current=false;setPending(false);savedRef.current=null;setSaved(null);setForm(emptyForm());setSavedKey('');setError('');setLoadError('');setDueDate('');setCreditOverride(false);setDialog(null);setPendingPresentation(null)
  const changed=()=>{if(authSessionIdentity()!==session){owner.controller.abort();owner.active=false;setError('La sesión cambió. Recarga Auna antes de continuar.')}}
  window.addEventListener('storage',changed)
  return()=>{owner.active=false;owner.controller.abort();window.removeEventListener('storage',changed)}
 },[owner])
 useEffect(()=>{setPendingPresentation(null)},[id])
 useEffect(()=>{
  if(!ready){setLoading(false);return}
  if(!id||savedRef.current?.id===id)return
  let active=true;setLoading(true);setLoadError('')
  void (async()=>{
   const value=await readManualSale(scope,id,owner.controller.signal)
   const catalog=await fetchPosCatalogItems(scope,[...new Set(value.items.map(l=>l.productId))],'all',owner.controller.signal)
   if(!active||!current())return
   applySaved(value,new Map(catalog.items.map(p=>{const product=adaptApiProduct(p);return[product.id,product]})))
  })().catch(e=>{if(active&&current())setLoadError((e as Error).message)}).finally(()=>{if(active&&current())setLoading(false)})
  return()=>{active=false}
 },[id,owner,ready])
 const previewInput:ManualSaveInput={...fields(form),expectedVersion:saved?.version??0,idempotencyKey:useMemo(()=>crypto.randomUUID(),[owner])}
 const [review,setReview]=useState({key:'',input:previewInput})
 useEffect(()=>{const timer=window.setTimeout(()=>setReview({key:formKey,input:previewInput}),300);return()=>window.clearTimeout(timer)},[formKey,saved?.version,owner])
 const preview=useQuery({queryKey:['manual-sale-preview',identity,review.key],enabled:ready&&!loading&&dirty&&!!form.lines.length&&review.key===formKey&&!pending,queryFn:({signal})=>previewManualSale(scope,review.input,signal),retry:false})
 const priced=review.key===formKey&&!preview.isFetching&&!preview.isError&&preview.data?.items.length===form.lines.length
 const actionable=ready&&!loading&&!loadError&&(!saved||saved.status==='DRAFT')&&!pending&&owner.active
 const writable=actionable&&!saved?.originQuote
 const invalidUnit=form.lines.some(l=>l.selection?.reviewRequired)
 const hasPresentationChoice=pendingPresentation?.context===presentationContext.current
 const canSave=writable&&dirty&&!!form.lines.length&&priced&&!invalidUnit&&!hasPresentationChoice
 const canConfirm=actionable&&saved?.status==='DRAFT'&&!dirty&&!!saved.customerId&&salesAllowCredit!==false&&!hasPresentationChoice
 async function execute(kind:'save'|'confirm'|'cancel'){
  if(busy.current||!current())return
  if(kind==='save'&&!canSave||kind==='confirm'&&!canConfirm||kind==='cancel'&&!saved)return
  const body=kind==='save'?{...fields(form),expectedVersion:saved?.version??0,items:fields(form).items.map((l,i)=>({...l,expected_unit_price:preview.data!.items[i].unitPrice}))}:{expectedVersion:saved!.version,...(kind==='confirm'?{dueDate:dueDate||undefined,creditOverride}:{})}
  const signature=JSON.stringify([kind,saved?.id??null,body]);if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()}
  const input={...body,idempotencyKey:attempt.current!.key};busy.current=true;setPending(true);setError('')
  try{
   assertManualScope(scope,owner.controller.signal)
   const result=kind==='save'?await saveManualSale(scope,saved?.id??null,input as ManualSaveInput,owner.controller.signal):kind==='confirm'?await confirmManualSale(scope,saved!.id,input,owner.controller.signal):await cancelManualSale(scope,saved!.id,input,owner.controller.signal)
   if(!current())return
   applySaved(result,new Map(form.lines.filter(l=>l.product).map(l=>[l.productId,l.product!])))
   setDialog(null);void queries.invalidateQueries({queryKey:['sales']})
   toast({title:kind==='save'?'Borrador guardado':kind==='confirm'?'Venta confirmada':'Borrador cancelado',description:kind==='confirm'?'El pago y la factura se registran por separado.':undefined})
   guard.proceed(()=>navigate(kind==='save'?`/ventas/${result.id}/editar`:permissions.hasPermission('sales.view_detail','sales.view_invoice')?`/ventas/${result.id}/factura`:'/ventas',{replace:kind==='save'}))
  }catch(e){if(current())setError((e as Error).message)}finally{if(current()){busy.current=false;setPending(false)}}
 }
 function addProduct(product:Product,presentationId?:string|null){
  if(!writable||!current()||form.lines.length>=100)return
  if(presentationId===undefined&&product.unitConfiguration?.presentations.some(p=>p.active&&p.sale_enabled)){
   setPendingPresentation({product,context:presentationContext.current});return
  }
  try{const selection=selectProductUnit(product,presentationId,'WHOLESALE');setForm(f=>({...f,lines:[...f.lines,{key:crypto.randomUUID(),productId:product.id,name:product.name,kind:product.kind||'STANDARD',qty:'1',unitLabel:product.serviceUnitLabel||'unidad',price:'0',lineTotal:'0',product,selection}]}))}catch(e){setError((e as Error).message)}
 }
 async function scanProduct(code:string,signal:AbortSignal){
  if(!writable||!current()||pendingPresentation?.context===presentationContext.current)return
  const result=await resolveContextScan(code,'SALE',signal);if(signal.aborted||!current()||!writable)return
  const product=adaptApiProduct(result.product),selection=selectProductUnit(product,result.presentationId,'WHOLESALE'),key=unitCartKey(product.id,selection)
  setForm(f=>{
   const index=f.lines.findIndex(l=>unitCartKey(l.productId,l.selection)===key)
   if(index>=0)return{...f,lines:f.lines.map((l,i)=>i===index?{...l,qty:addUnitQuantities(l.qty,'1')}:l)}
   if(f.lines.length>=100){setError('La venta admite hasta 100 partidas');return f}
   return{...f,lines:[...f.lines,{key:crypto.randomUUID(),productId:product.id,name:product.name,kind:product.kind||'STANDARD',qty:'1',unitLabel:product.serviceUnitLabel||'unidad',price:'0',lineTotal:'0',product,selection}]}
  })
 }
 function changeLine(key:string,change:Partial<Line>){setForm(f=>({...f,lines:f.lines.map(l=>l.key===key?{...l,...change}:l)}))}
 const money=(value:string)=>formatMoney(Number(value),locale,currencyCode)
 if(!id&&(search.has('pedido')||search.has('recuperar')))return <Navigate to={`/ventas/pos?${search}`} replace/>
 if(!ready)return <main className="auna-page-fluid p-4 sm:p-8"><p role="status">{canCreate?'Selecciona una sucursal para preparar la venta.':'No tienes permiso para crear ventas.'}</p><Button asChild variant="outline" className="mt-4"><Link to="/ventas">Volver a ventas</Link></Button></main>
 return <main className="auna-page-fluid mx-auto space-y-6 p-4 sm:p-8">
  {guard.dialog}
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
   <div className="flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Volver a ventas" onClick={()=>navigate('/ventas')}><ArrowLeft aria-hidden className="h-5 w-5"/></Button><h1 className="text-xl font-semibold">{saved?.reference?`Venta ${saved.reference}`:'Nueva venta'}</h1><Badge variant="secondary">{saved?.status==='CONFIRMED'?'Confirmada':saved?.status==='CANCELLED'?'Cancelada':'Borrador'}</Badge></div>
   {!saved?.originQuote&&<Button aria-label="Guardar borrador" disabled={!canSave} onClick={()=>execute('save')}>{pending?<Loader2 aria-hidden className="h-4 w-4 animate-spin"/>:null}Guardar borrador</Button>}
  </header>
  {loading?<p role="status">Cargando borrador…</p>:loadError?<div role="alert"><p className="text-destructive">{loadError}</p><p>Vuelve al listado y abre nuevamente la venta.</p></div>:<>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {saved?.originQuote&&<p className="text-sm text-muted-foreground">Creada desde la cotización <Link className="font-medium text-primary underline underline-offset-4" to={`/cotizaciones/${saved.originQuote.id}`}>{saved.originQuote.reference||'aceptada'}</Link>. Se conservan el cliente, las partidas y los descuentos acordados. Puedes confirmar o cancelar este borrador.</p>}
  <section aria-label="Cliente de la venta" className="grid gap-4 border-b border-border pb-6 lg:grid-cols-3">
   <div className="max-w-lg">{writable?<SavedCustomerMany2One valueId={form.customerId||'__none__'} linkedDisplayName={form.customerName} canCreateContact={permissions.hasPermission('contacts.clients.create')} onPick={(c:Supplier)=>{if(writable)setForm(f=>({...f,customerId:c.id,customerName:c.name,customerNit:c.taxId||''}))}} onClear={()=>{if(writable)setForm(f=>({...f,customerId:null,customerName:'',customerNit:''}))}}/>:<><Label>Cliente registrado</Label><p className="mt-2 py-2">{form.customerId?form.customerName:'Por seleccionar'}</p></>}<p className="mt-2 text-xs text-muted-foreground">Puedes preparar el borrador sin cliente. Para confirmar un saldo pendiente, selecciona uno registrado.</p></div>
   <div className="max-w-lg"><Label htmlFor="manual-customer">Nombre en el documento</Label><Input id="manual-customer" maxLength={150} className="mt-2" value={form.customerName} disabled={!writable} onChange={e=>setForm(f=>({...f,customerName:e.target.value}))} placeholder="Consumidor final o razón social"/></div>
   <div className="max-w-xs"><Label htmlFor="manual-nit">NIT / identificación fiscal</Label><Input id="manual-nit" maxLength={50} className="mt-2" value={form.customerNit} disabled={!writable} onChange={e=>setForm(f=>({...f,customerNit:e.target.value}))} placeholder="CF"/></div>
  </section>
  <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
   <section aria-label="Partidas de la venta" className="min-w-0 space-y-4">
    {writable&&<ScannerField scopeKey={`${identity}:${id||'new'}`} enabled={pendingPresentation?.context!==presentationContext.current} onScan={scanProduct} label="Agregar por código"/>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Productos y servicios <span className="text-muted-foreground">· {form.lines.length}</span></h2>{writable&&form.lines.length<100&&<div className="w-full sm:w-80"><ProductPicker companyId={scope.companyId} branchId={scope.branchId} onPick={addProduct} money={n=>money(String(n))}/></div>}</div>
    {!form.lines.length?<CollectionEmptyState title="Dale forma a tu próxima venta" description="Agrega productos o servicios. Podrás revisarla antes de confirmarla." compact/>:<div className="auna-data-table-shell overflow-x-auto"><table className="auna-data-table min-w-[760px]"><thead><tr><th>Producto / servicio</th><th>Cantidad</th><th>Presentación</th><th className="text-right">Precio unitario</th><th className="text-right">Importe</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{form.lines.map((l,index)=><tr key={l.key}>
     <td><p className="font-medium">{l.name}</p>{l.kind==='SERVICE'&&<p className="text-xs text-muted-foreground">Servicio</p>}</td>
     <td className="align-top"><Input className="min-h-11 w-24" aria-label={`Cantidad de ${l.name}`} inputMode="decimal" value={l.qty} disabled={!writable} onChange={e=>changeLine(l.key,{qty:e.target.value})}/></td>
     <td className="min-w-[220px] max-w-xs align-top">{l.product&&l.selection?<UnitLineFields product={l.product} selection={l.selection} quantity={l.qty} disabled={!writable} onSelect={presentationId=>{try{changeLine(l.key,{selection:selectProductUnit(l.product!,presentationId,'WHOLESALE')})}catch(e){setError((e as Error).message)}}} onAcceptRounding={accepted=>changeLine(l.key,{selection:{...l.selection!,acceptRounding:accepted}})}/>:<span className="text-sm text-muted-foreground">{l.unitLabel}</span>}</td>
     <td className="text-right tabular-nums">{dirty?priced?`${currencyCode} ${formatUnitDecimal(preview.data!.items[index].unitPrice,locale)}`:'—':`${currencyCode} ${formatUnitDecimal(l.price,locale)}`}</td><td className="text-right font-semibold tabular-nums">{dirty?priced?money(preview.data!.items[index].lineTotal):'—':money(l.lineTotal)}</td>
     <td><Button variant="ghost" size="icon" aria-label={`Quitar ${l.name}`} disabled={!writable} onClick={()=>setForm(f=>({...f,lines:f.lines.filter(row=>row.key!==l.key)}))}><Trash2 aria-hidden className="h-4 w-4"/></Button></td>
    </tr>)}</tbody></table></div>}
    {dirty&&form.lines.length>0&&<p role={preview.isError?'alert':'status'} className={`text-sm ${preview.isError?'text-destructive':'text-muted-foreground'}`}>{preview.isError?(preview.error as Error).message:priced?'Precios y conversiones revisados. Se comprobarán otra vez al guardar.':'Revisando precios y unidades…'}</p>}
   </section>
   <aside aria-label="Resumen y confirmación" className="space-y-5 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
    <div className="flex justify-between gap-4"><span className="font-medium">{dirty?'Total revisado':'Total de la venta'}</span><output className="text-xl font-semibold tabular-nums">{dirty?priced?money(preview.data!.total):'—':money(saved?.total||'0')}</output></div>
    <p className="text-sm text-muted-foreground">Guardar el borrador no descuenta existencias ni registra cobros.</p>
    {saved?.status==='DRAFT'&&<div className="space-y-4 border-t border-border pt-5"><h2 className="font-semibold">Confirmar sin cobrar</h2><p className="text-sm text-muted-foreground">Se despachan los bienes y el importe queda pendiente en Cartera. No se emite factura fiscal.</p>
     <div><Label htmlFor="manual-due">Vencimiento del saldo</Label><Input id="manual-due" type="date" className="mt-2" value={dueDate} disabled={!actionable} onChange={e=>setDueDate(e.target.value)}/><p className="mt-1 text-xs text-muted-foreground">Si lo dejas vacío, se usa el plazo acordado o el del cliente.</p></div>
     {permissions.hasPermission('sales.credit.override')&&<label className="flex items-start gap-2 text-sm"><Checkbox checked={creditOverride} disabled={!actionable} onCheckedChange={value=>setCreditOverride(value===true)}/>Autorizar excepción de crédito</label>}
     {dirty?<p className="text-xs text-muted-foreground">Guarda los cambios antes de confirmar.</p>:!saved.customerId?<p className="text-xs text-muted-foreground">Selecciona y guarda un cliente registrado.</p>:salesAllowCredit===false?<p className="text-xs text-destructive">Las ventas con saldo pendiente están desactivadas.</p>:null}
     <Button className="w-full" aria-label="Confirmar venta" disabled={!canConfirm} onClick={()=>setDialog('confirm')}>Confirmar venta</Button>
     {permissions.hasPermission('sales.cancel')&&<Button variant="ghost" className="w-full text-destructive" disabled={!actionable||dirty} onClick={()=>setDialog('cancel')}>Cancelar borrador</Button>}
    </div>}
   </aside>
  </div></>}
  <SalePresentationDialog product={writable&&pendingPresentation?.context===presentationContext.current?pendingPresentation.product:null} priceContext="WHOLESALE" locale={locale} currencyCode={currencyCode} onCancel={()=>{handledPresentation.current=pendingPresentation;setPendingPresentation(null)}} onSelect={presentationId=>{
   const request=pendingPresentation
   if(!request||handledPresentation.current===request||request.context!==presentationContext.current||!writable||!current())return
   handledPresentation.current=request;setPendingPresentation(null);addProduct(request.product,presentationId)
  }}/>
  <ConfirmDialog open={dialog!==null} onOpenChange={open=>{if(!pending&&!open)setDialog(null)}} appearance="auna" title={dialog==='cancel'?'¿Cancelar este borrador?':'¿Confirmar esta venta?'} description={dialog==='cancel'?'El borrador quedará cancelado. No hay existencias ni cobros que revertir.':'Se registrará la venta y se despacharán los bienes incluidos. El importe quedará pendiente de cobro; no se emitirá una factura fiscal.'} confirmText={dialog==='cancel'?'Cancelar borrador':'Confirmar venta'} cancelText="Seguir revisando" loading={pending} onConfirm={()=>execute(dialog==='cancel'?'cancel':'confirm')}/>
 </main>
}
