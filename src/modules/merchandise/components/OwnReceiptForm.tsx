import {useEffect,useMemo,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {ProductPicker} from '@/components/shared/ProductPicker'
import {useTenant} from '@/context/useTenant'
import {useAuth} from '@/context/useAuth'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useToast} from '@/hooks/use-toast'
import {apiFetch} from '@/services/api'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {exactProductValues,normalizeUnitDecimal,unitLineTotal,formatUnitMoney} from '@/modules/inventory/units/public'
import type {Product} from '@/types/product'

export type EntrySource='PURCHASE'|'PRODUCTION'|'INITIAL'
export function EntrySourceSelector({source,onChange}:{source:EntrySource;onChange:(source:EntrySource)=>void}){
  return <section className="space-y-2" aria-label="Origen de la mercancía"><h2 className="font-semibold">¿De dónde viene esta mercancía?</h2><div className="flex flex-wrap gap-2">{([['PURCHASE','Compra a proveedor'],['PRODUCTION','Fabricación propia'],['INITIAL','Existencias iniciales']] as const).map(([key,label])=><Button key={key} type="button" variant={source===key?'default':'outline'} aria-pressed={source===key} onClick={()=>onChange(key)}>{label}</Button>)}</div></section>
}
type Row={product:Product;quantity:string;cost:string;lot:string;expiry:string}
const newRow=(product:Product):Row=>({product,quantity:'1',cost:exactProductValues(product).cost,lot:'',expiry:''})
const baseLabel=(product:Product)=>product.unitConfiguration?.base_unit?.label||'unidades'
const qty=(row:Row)=>normalizeUnitDecimal(row.quantity,{decimals:row.product.unitConfiguration?.quantity_decimals??row.product.quantityDecimals??0,allowZero:false})
const addMoney=(values:string[])=>{const cents=values.reduce((sum,value)=>sum+BigInt(value.replace('.','')),0n);return `${cents/100n}.${(cents%100n).toString().padStart(2,'0')}`}

export function OwnReceiptForm({source,onSourceChange,locations}:{source:'INITIAL'|'PRODUCTION';onSourceChange:(source:EntrySource)=>void;locations:{id:string;name:string;warehouse:string}[]}){
  const {company,branch,registerTenantExitGuard}=useTenant(),{user}=useAuth(),{hasPermission}=useAuthPermissions(),{toast}=useToast(),{locale,currencyCode}=useSystemSettings(),navigate=useNavigate(),queries=useQueryClient()
  const scopeKey=JSON.stringify([company?.id,branch?.id,user?.id,source]),live=useRef(scopeKey);live.current=scopeKey
  const owner=useMemo(()=>({controller:new AbortController(),active:true}),[scopeKey]),busy=useRef(false),retry=useRef<{signature:string;key:string}|null>(null)
  const [rows,setRows]=useState<Row[]>([]),[components,setComponents]=useState<Row[]>([]),[costs,setCosts]=useState({materials:'0',labor:'0',other:'0'}),[notes,setNotes]=useState(''),[location,setLocation]=useState(''),[pending,setPending]=useState(false),[review,setReview]=useState(false)
  const production=source==='PRODUCTION',dirty=rows.length>0||components.length>0||!!notes||Object.values(costs).some(value=>value!=='0')
  const guard=useDraftGuard(dirty,registerTenantExitGuard,scopeKey)
  useEffect(()=>{owner.active=true;setRows([]);setComponents([]);setCosts({materials:'0',labor:'0',other:'0'});setNotes('');setLocation('');setPending(false);setReview(false);retry.current=null;busy.current=false;return()=>{owner.active=false;owner.controller.abort()}},[owner])
  const current=()=>owner.active&&live.current===scopeKey&&!owner.controller.signal.aborted
  const money=(value:string)=>formatUnitMoney(value,locale,currencyCode)
  const physical=(product:Product)=>{if(product.kind==='SERVICE'||product.kind==='KIT'){toast({title:'Selecciona un producto físico',description:'Los kits se registran desde su armado y los servicios no tienen existencias.',variant:'destructive'});return false}return true}
  const pick=(product:Product)=>{if(!physical(product)||rows.some(row=>row.product.id===product.id))return;if(production&&rows.length)return;setRows(old=>[...old,newRow(product)])}
  const material=(product:Product)=>{if(!physical(product)||[...rows,...components].some(row=>row.product.id===product.id))return;setComponents(old=>[...old,newRow(product)])}
  const change=(id:string,key:keyof Omit<Row,'product'>,value:string)=>setRows(old=>old.map(row=>row.product.id===id?{...row,[key]:value}:row))
  function payload(){
    if(!rows.length)throw Error(production?'Selecciona el producto que fabricaste.':'Agrega al menos un producto.')
    const items=rows.map(row=>{
      if(row.product.tracksExpiry&&!row.expiry)throw Error(`Ingresa la caducidad de ${row.product.name}.`)
      return {product_id:row.product.id,quantity:qty(row),...(production?{}:{unit_cost:normalizeUnitDecimal(row.cost,{decimals:12,max:'9999999999.99'})}),...(row.product.unitConfiguration?{unit_revision:row.product.unitConfiguration.unit_revision}:{}),...(row.lot.trim()?{lot_code:row.lot.trim()}:{}),...(row.expiry?{expiry_date:row.expiry}:{})}
    })
    return {source,items,...(production?{components:components.map(row=>({product_id:row.product.id,quantity:qty(row),...(row.product.unitConfiguration?{unit_revision:row.product.unitConfiguration.unit_revision}:{})})),costs:Object.fromEntries(Object.entries(costs).map(([key,value])=>[key,normalizeUnitDecimal(value,{decimals:2,max:'9999999999.99'})]))}:{}),...(notes.trim()?{notes:notes.trim()}:{}),...(location?{location_id:location}:{})}
  }
  let estimate:string|null=null
  try{estimate=production?addMoney([...components.map(row=>unitLineTotal(qty(row),exactProductValues(row.product).cost)),...Object.values(costs).map(value=>unitLineTotal('1',value))]):addMoney(rows.map(row=>unitLineTotal(qty(row),row.cost)))}catch{/* Invalid fields are explained before confirmation. */}
  const check=()=>{try{payload();setReview(true)}catch(error){toast({title:'Revisa la entrada',description:(error as Error).message,variant:'destructive'})}}
  async function save(){
    if(busy.current||!branch?.id||!company?.id||!hasPermission('products.register_incoming'))return
    busy.current=true;setPending(true);setReview(false)
    try{
      const input=payload(),signature=JSON.stringify(input)
      if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()}
      const result=await apiFetch<{incomingMerchandise:{id:string}}>('/api/products/register-incoming',{method:'POST',signal:owner.controller.signal,headers:{'X-Company-Id':company.id,'X-Branch-Id':branch.id},body:JSON.stringify({...input,request_key:retry.current.key})})
      if(!current())return
      retry.current=null
      void queries.invalidateQueries({queryKey:['incoming-merchandise']});void queries.invalidateQueries({queryKey:['products']})
      toast({title:production?'Fabricación registrada':'Existencias iniciales registradas',description:'Las existencias y sus costos fueron actualizados. No se creó una deuda con proveedores.'})
      guard.proceed(()=>navigate(`/mercancia/${result.incomingMerchandise.id}`))
    }catch(error){if(current()&&(error as Error).name!=='AbortError')toast({title:'No se pudo registrar la entrada',description:(error as Error).message,variant:'destructive'})}
    finally{if(current()){busy.current=false;setPending(false)}}
  }
  return <div className="merchandise-page mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">{guard.dialog}
    <fieldset disabled={pending} className="min-w-0 space-y-5"><EntrySourceSelector source={source} onChange={next=>{if(next!==source)guard.request(()=>onSourceChange(next))}}/>
      <div><h1 className="text-xl font-semibold">{production?'Registrar fabricación propia':'Registrar existencias iniciales'}</h1><p className="mt-1 text-sm text-muted-foreground">{production?'Registra lo que ya fabricaste y cuánto costó. No necesitas un proveedor.':'Registra lo que ya tenías al empezar a usar Auna. Esto no es una compra.'}</p></div>
      <section className="auna-surface space-y-4 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{production?'¿Qué producto fabricaste?':'Productos y cantidades de apertura'}</h2>{(!production||!rows.length)&&<div className="w-full sm:max-w-md"><ProductPicker purchase companyId={company?.id} branchId={branch?.id} excludedIds={[...rows,...components].map(row=>row.product.id)} onPick={pick}/></div>}</div>
        {!rows.length&&<p className="text-sm text-muted-foreground">Selecciona un producto de tu catálogo para comenzar.</p>}
        {rows.map(row=><div key={row.product.id} className="grid items-end gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5"><div className="space-y-1"><strong className="text-sm">{row.product.name}</strong><small className="block text-muted-foreground">Cantidades en {baseLabel(row.product)}</small><Button variant="ghost" size="sm" onClick={()=>setRows(old=>old.filter(item=>item!==row))}>Quitar producto</Button></div><label className="space-y-1 text-sm">Cantidad {production?'producida':'inicial'}<Input aria-label={`Cantidad de ${row.product.name}`} inputMode="decimal" value={row.quantity} onChange={e=>change(row.product.id,'quantity',e.target.value)}/></label>{!production&&<label className="space-y-1 text-sm">Costo por {baseLabel(row.product)}<Input aria-label={`Costo de ${row.product.name}`} inputMode="decimal" value={row.cost} onChange={e=>change(row.product.id,'cost',e.target.value)}/></label>}<label className="space-y-1 text-sm">Lote (opcional)<Input value={row.lot} maxLength={60} onChange={e=>change(row.product.id,'lot',e.target.value)}/></label><label className="space-y-1 text-sm">Caducidad{row.product.tracksExpiry?' *':' (opcional)'}<Input type="date" value={row.expiry} onChange={e=>change(row.product.id,'expiry',e.target.value)}/></label></div>)}
      </section>
      {production&&<section className="auna-surface space-y-4 p-4 sm:p-5"><div><h2 className="font-semibold">¿Cuánto costó fabricar este lote?</h2><p className="mt-1 text-sm text-muted-foreground">Ingresa los importes del lote completo, no por unidad. Registrar un costo aquí no registra un pago.</p></div><div className="grid gap-4 md:grid-cols-3">{([['materials','Materiales no inventariados'],['labor','Mano de obra'],['other','Otros costos']] as const).map(([key,label])=><label key={key} className="space-y-1 text-sm">{label}<Input aria-label={label} inputMode="decimal" value={costs[key]} onChange={e=>setCosts(old=>({...old,[key]:e.target.value}))}/></label>)}</div>
        <details className="border-t pt-3" open={components.length>0||undefined}><summary className="cursor-pointer text-sm font-medium">Usé materiales que ya están en mi inventario</summary><div className="mt-3 space-y-3"><p className="text-sm text-muted-foreground">Estos materiales se descontarán al confirmar. Su costo lo calcula Auna; no vuelvas a incluirlos en el importe de arriba.</p><div className="max-w-md"><ProductPicker inventory companyId={company?.id} branchId={branch?.id} excludedIds={[...rows,...components].map(row=>row.product.id)} onPick={material}/></div>{components.map(row=><div key={row.product.id} className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 space-y-1 text-sm">{row.product.name} · {baseLabel(row.product)}<Input aria-label={`Material utilizado: ${row.product.name}`} inputMode="decimal" value={row.quantity} onChange={e=>setComponents(old=>old.map(item=>item===row?{...item,quantity:e.target.value}:item))}/></label><Button variant="outline" onClick={()=>setComponents(old=>old.filter(item=>item!==row))}>Quitar material</Button></div>)}</div></details>
      </section>}
      <section className="auna-surface grid gap-4 p-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="own-receipt-location">¿Dónde se guarda?</Label><select id="own-receipt-location" className="auna-control auna-control-select" value={location} onChange={e=>setLocation(e.target.value)}><option value="">Ubicación de recepción predeterminada</option>{locations.map(item=><option key={item.id} value={item.id}>{item.warehouse} · {item.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="own-receipt-notes">Observaciones (opcional)</Label><Textarea id="own-receipt-notes" maxLength={4000} rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></div></section>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-4"><div><p className="font-semibold">Costo total estimado: {estimate===null?'Revisa los importes':money(estimate)}</p><p className="text-xs text-muted-foreground">{production?'El costo de los materiales se verifica al confirmar.':'El costo se guarda con las existencias iniciales.'} Sin cuentas por pagar.</p></div><Button disabled={pending||!rows.length||!branch?.id||!hasPermission('products.register_incoming')} onClick={check}>{pending?'Registrando…':production?'Revisar fabricación':'Revisar entrada'}</Button></footer>
    </fieldset><ConfirmDialog appearance="auna" variant="info" open={review} onOpenChange={setReview} loading={pending} title={production?'¿Registrar esta fabricación?':'¿Registrar estas existencias iniciales?'} description={production?'Se agregarán los productos terminados y se descontarán los materiales seleccionados. No se registrará ningún pago ni deuda.':'Se agregarán estas cantidades al inventario con el costo indicado. No se registrará una compra ni una deuda.'} confirmText={production?'Registrar fabricación':'Registrar existencias'} onConfirm={save}/>
  </div>
}
