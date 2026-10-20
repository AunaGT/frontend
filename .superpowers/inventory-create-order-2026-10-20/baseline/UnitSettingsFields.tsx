import {useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {Plus,Archive,Package,ChevronDown} from 'lucide-react'
import {convertUnitQuantity,deriveUnitPrice,deriveMeasureFactor,formatUnitDecimal} from '@/lib/unitQuantity'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {presentationInput} from './model'
import type {ProductKind} from '@/types/product'
import type {MeasureUnit,PresentationDraft,ProductUnitsDraft} from './types'

type Props={enabled:boolean;kind:ProductKind;units:MeasureUnit[];value:ProductUnitsDraft;onChange:(value:ProductUnitsDraft)=>void;readOnly?:boolean;disabled?:boolean;baseLocked?:boolean;basePrice?:string;locale?:string;allowPresentationDrafts?:boolean;onSavePresentation?:(row:PresentationDraft)=>Promise<void>;onArchivePresentation?:(row:PresentationDraft)=>Promise<void>}
export function UnitSettingsFields({enabled,kind,units,value,onChange,readOnly=false,disabled=false,baseLocked=false,basePrice='',locale='es-GT',allowPresentationDrafts=true,onSavePresentation,onArchivePresentation}:Props){
  const counter=useRef(0),[error,setError]=useState(''),[working,setWorking]=useState(false),[example,setExample]=useState('2'),[archiveCandidate,setArchiveCandidate]=useState<PresentationDraft|null>(null)
  const base=units.find(unit=>unit.id===value.baseUnitId)
  if(readOnly){
    if(kind==='SERVICE'&&(!enabled||!value.baseUnitId))return null
    const baseLabel=base?`${base.name} (${base.label})`:kind==='SERVICE'?'Etiqueta de cobro libre':'Unidad · cantidades enteras'
    const habitual=(key:string|null)=>value.presentations.find(p=>p.key===key)?.name||base?.name||'Unidad base'
    const rows=kind==='SERVICE'?[['Unidad de cobro',baseLabel],['Decimales de cobro',value.quantityDecimals]]:[
      ['Unidad de existencias',baseLabel],['Decimales',enabled?value.quantityDecimals:'0'],
      ...(enabled&&base?[['Compra habitual',habitual(value.defaultPurchaseKey)],['Venta habitual',habitual(value.defaultSaleKey)]]:[]),
    ]
    return <section className="space-y-3" aria-label={kind==='SERVICE'?'Unidad de cobro':'Unidades y presentaciones'}>
      <h3 className="text-sm font-semibold">{kind==='SERVICE'?'Unidad de cobro':'Cómo controlás tus existencias'}</h3>
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">{rows.map(([label,content])=><div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{content}</dd></div>)}</dl>
      {kind!=='SERVICE'&&enabled&&base&&value.presentations.length>0&&<ul className="divide-y border-t">{value.presentations.map(row=><li key={row.key} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-2 text-sm">
        <span className="font-medium">{row.name}</span><span>1 {row.label||row.name} = {formatUnitDecimal(row.factor,locale)} {base.label}</span>
        <span className="text-xs text-muted-foreground">{[row.purchaseEnabled&&'Compra',row.saleEnabled&&'Venta'].filter(Boolean).join(' · ')||'No disponible para nuevas operaciones'}</span>
        {row.barcode&&<span className="text-xs text-muted-foreground">Código: {row.barcode}</span>}
        <details className="w-full text-xs"><summary className="cursor-pointer text-muted-foreground">Precios y detalles</summary><dl className="grid gap-x-5 gap-y-2 py-2 sm:grid-cols-2 xl:grid-cols-4">{[
          ['Precio de venta',row.price?formatUnitDecimal(row.price,locale):basePrice?`${formatUnitDecimal(deriveUnitPrice(basePrice,row.factor),locale)} · según precio base`:'Según el precio base'],
          ['Precio mayoreo',row.wholesale?formatUnitDecimal(row.wholesale,locale):'Según el precio base'],
          ['Precio promoción',row.promotion?formatUnitDecimal(row.promotion,locale):'Según el precio base'],
          ['Promoción hasta',row.promotionUntil?new Date(row.promotionUntil).toLocaleString(locale):'Sin fecha'],
          ['Decimales de presentación',row.quantityDecimals],
          ['Contenido por medida',row.measureUnitId?units.find(u=>u.id===row.measureUnitId)?.name||'Medida archivada':'Caja o paquete · contenido propio'],
          ['Versión',String(row.version??1)],
        ].map(([label,content])=><div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium">{content}</dd></div>)}</dl></details>
      </li>)}</ul>}
    </section>
  }
  if(kind==='SERVICE')return enabled?<section className="space-y-3 border-t pt-4" aria-label="Unidad de cobro">
    <h3 className="text-sm font-medium">Unidad de cobro</h3>
    <Label htmlFor="product-base-unit">Unidad del servicio</Label>
    <Select value={value.baseUnitId||'__legacy__'} disabled={disabled||baseLocked} onValueChange={id=>{if(!disabled&&!baseLocked){const unit=units.find(u=>u.id===id);onChange({...value,baseUnitId:unit?.id??'',quantityDecimals:String(Math.min(4,unit?.quantity_decimals??0)),defaultPurchaseKey:null})}}}>
      <SelectTrigger id="product-base-unit"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__legacy__">Etiqueta de cobro libre</SelectItem>{units.filter(u=>u.active||u.id===value.baseUnitId).map(u=><SelectItem key={u.id} value={u.id}>{u.name} ({u.label})</SelectItem>)}</SelectContent>
    </Select>
    {value.baseUnitId&&<><Label htmlFor="product-base-decimals">Decimales de cobro</Label><Select value={value.quantityDecimals} disabled={disabled||baseLocked} onValueChange={decimals=>{if(!disabled&&!baseLocked)onChange({...value,quantityDecimals:decimals})}}><SelectTrigger id="product-base-decimals"><SelectValue /></SelectTrigger><SelectContent>{Array.from({length:Math.min(4,units.find(u=>u.id===value.baseUnitId)?.quantity_decimals??4)+1},(_,i)=><SelectItem key={i} value={String(i)}>{i}</SelectItem>)}</SelectContent></Select></>}
    <p className="text-xs text-muted-foreground">Unidad para facturar el servicio, sin existencias ni compras. {baseLocked?'El historial conserva la unidad y sus decimales.':'La etiqueta libre sigue disponible para servicios sin configuración.'}</p>
  </section>:null
  if(!enabled)return <section className="space-y-1 border-t pt-4"><h3 className="text-sm font-medium">Cómo controlás tus existencias</h3><p className="text-sm text-muted-foreground">Por unidad · cantidades enteras.</p></section>
  const blocked=disabled||working
  const change=(next:ProductUnitsDraft)=>{if(!blocked)onChange(next)}
  const patchRow=(key:string,patch:Partial<PresentationDraft>)=>change({...value,presentations:value.presentations.map(row=>row.key===key?{...row,...patch}:row)})
  const action=async(row:PresentationDraft,archive=false)=>{
    if(blocked)return
    setError('')
    try{if(!archive)presentationInput(row,kind);setWorking(true);await (archive?onArchivePresentation?.(row):onSavePresentation?.(row))}catch(e){setError((e as Error).message)}finally{setWorking(false)}
  }
  const equivalence=(key:string|null)=>{
    const selected=value.presentations.find(p=>p.key===key)
    try{
      const preview=convertUnitQuantity(example,selected?.factor??'1',Number(value.quantityDecimals))
      return `${example} ${selected?.name??base?.label??'unidades'} = ${formatUnitDecimal(preview.baseQty,locale)} ${base?.label??'unidades'}${preview.roundingRequired?' · requiere aceptar el redondeo al operar':''}`
    }catch{return 'Completa las cantidades para ver la equivalencia.'}
  }
  return <section className="space-y-3 border-t pt-3" aria-label="Unidades y presentaciones">
    <div className="space-y-3"><h3 className="flex items-center gap-2 font-medium"><Package className="h-4 w-4 text-brand-orange" aria-hidden="true" />Cómo controlás tus existencias</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_minmax(0,1fr)]"><div className="min-w-0 space-y-1.5"><Label htmlFor="product-base-unit">Unidad de tus existencias</Label>
        <Select value={value.baseUnitId||'__legacy__'} disabled={blocked||baseLocked} onValueChange={id=>{if(!baseLocked&&!blocked){const unit=units.find(u=>u.id===id);change({...value,baseUnitId:unit?.id??'',quantityDecimals:String(kind==='KIT'?0:unit?.quantity_decimals??0)})}}}>
          <SelectTrigger id="product-base-unit" disabled={blocked||baseLocked}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__legacy__">Unidad · cantidades enteras</SelectItem>{units.filter(u=>u.active||u.id===value.baseUnitId).map(u=><SelectItem key={u.id} value={u.id}>{u.name} ({u.label}){!u.active?' · archivada':''}</SelectItem>)}</SelectContent>
        </Select></div>
        {base&&<div className="min-w-0 space-y-1.5"><Label htmlFor="product-base-decimals">Decimales</Label><Select value={value.quantityDecimals} disabled={blocked||baseLocked||kind==='KIT'} onValueChange={decimals=>{if(!baseLocked&&kind!=='KIT')change({...value,quantityDecimals:decimals})}}><SelectTrigger id="product-base-decimals"><SelectValue /></SelectTrigger><SelectContent>{Array.from({length:(kind==='KIT'?0:base.quantity_decimals)+1},(_,i)=><SelectItem key={i} value={String(i)}>{i===0?'0 · enteras':String(i)}</SelectItem>)}</SelectContent></Select></div>}
        {base&&([{title:'Cómo lo comprás',key:'defaultPurchaseKey',enabled:'purchaseEnabled',id:'product-purchase-unit'},{title:'Cómo lo vendés',key:'defaultSaleKey',enabled:'saleEnabled',id:'product-sale-unit'}] as const).map(operation=><div key={operation.key} className="min-w-0 space-y-1.5"><Label htmlFor={operation.id}>{operation.title}</Label><Select value={value[operation.key]??'__base__'} disabled={blocked} onValueChange={key=>change({...value,[operation.key]:key==='__base__'?null:key})}><SelectTrigger id={operation.id}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__base__">{base.name} · unidad base</SelectItem>{value.presentations.filter(p=>p[operation.enabled]).map(p=><SelectItem key={p.key} value={p.key}>{p.name||'Nueva presentación'}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground" aria-live="polite">{equivalence(value[operation.key])}</p></div>)}
      </div><p className="max-w-xl text-xs text-muted-foreground">{baseLocked?'La unidad base y sus decimales se conservan porque hay historial o presentaciones.':'Las existencias y el mínimo se cuentan siempre en esta unidad. Un producto con historial conserva su unidad base.'}</p>
    </div>
    {base&&<>
      <details><summary className="cursor-pointer text-xs text-muted-foreground">Probar otra cantidad</summary><div className="mt-2 w-36 space-y-1.5"><Label htmlFor="unit-example-quantity">Cantidad del ejemplo</Label><Input id="unit-example-quantity" inputMode="decimal" value={example} onChange={e=>setExample(e.target.value)} /></div></details>
      <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Presentaciones{value.presentations.length?` (${value.presentations.length})`:''}</h3></div>{value.presentations.map((row,index)=><fieldset key={row.key} disabled={blocked} className="space-y-3 border-t pt-3"><legend className="sr-only">Presentación {index+1}</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-1.5"><Label htmlFor={`presentation-name-${row.key}`}>Nombre de presentación {index+1}</Label><Input id={`presentation-name-${row.key}`} value={row.name} placeholder="Caja de 24" onChange={e=>patchRow(row.key,{name:e.target.value,label:!row.label||row.label===row.name?e.target.value:row.label})} /></div>
          <div className="w-44 space-y-1.5"><Label htmlFor={`presentation-factor-${row.key}`}>Contiene ({base.label})</Label><Input id={`presentation-factor-${row.key}`} inputMode="decimal" value={row.factor} disabled={blocked||!!row.measureUnitId} onChange={e=>patchRow(row.key,{factor:e.target.value})} /></div>
          <Button type="button" variant="ghost" disabled={blocked} onClick={()=>{if(blocked)return;if(row.id)setArchiveCandidate(row);else change({...value,presentations:value.presentations.filter(p=>p.key!==row.key),defaultPurchaseKey:value.defaultPurchaseKey===row.key?null:value.defaultPurchaseKey,defaultSaleKey:value.defaultSaleKey===row.key?null:value.defaultSaleKey})}}><Archive className="mr-2 h-4 w-4" aria-hidden="true" />{row.id?'Archivar':'Quitar'}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{row.id?`Versión ${row.version}. Cambiar el contenido crea una nueva versión; los registros anteriores conservan la original.`:'Por ejemplo: 2 cajas de 24 contienen 48 unidades.'}</p>
        <details><summary className="inline-flex cursor-pointer items-center gap-1 py-2 text-sm text-muted-foreground">Más opciones<ChevronDown className="h-4 w-4" aria-hidden="true" /></summary><div className="flex flex-wrap items-start gap-4 pt-2">
          <div className="w-full max-w-[240px] space-y-1.5"><Label htmlFor={`presentation-measure-${row.key}`}>Contenido por medida</Label><Select value={row.measureUnitId??'__pack__'} disabled={blocked} onValueChange={id=>{if(blocked)return;try{const measure=units.find(u=>u.id===id);patchRow(row.key,{measureUnitId:measure?.id??null,...(measure?{factor:deriveMeasureFactor(measure.factor,base.factor)}:{})});setError('')}catch(e){setError((e as Error).message)}}}><SelectTrigger id={`presentation-measure-${row.key}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__pack__">Caja o paquete · contenido propio</SelectItem>{units.filter(u=>(u.active||u.id===row.measureUnitId)&&u.family===base.family).map(u=><SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
          {([{field:'label',label:'Etiqueta corta',decimal:false},{field:'quantityDecimals',label:'Decimales de presentación',decimal:true},{field:'price',label:'Precio propio (opcional)',decimal:true},{field:'wholesale',label:'Precio mayoreo (opcional)',decimal:true},{field:'promotion',label:'Precio promoción (opcional)',decimal:true},{field:'barcode',label:'Código de barras',decimal:false}] as const).map(field=><div key={field.field} className="w-full max-w-[240px] space-y-1.5"><Label htmlFor={`presentation-${field.field}-${row.key}`}>{field.label}</Label><Input id={`presentation-${field.field}-${row.key}`} value={row[field.field]} inputMode={field.decimal?'decimal':'text'} onChange={e=>patchRow(row.key,{[field.field]:e.target.value})} /></div>)}
          <div className="w-full max-w-[240px] space-y-1.5"><Label htmlFor={`presentation-until-${row.key}`}>Promoción hasta</Label><Input id={`presentation-until-${row.key}`} type="datetime-local" value={row.promotionUntil} onChange={e=>patchRow(row.key,{promotionUntil:e.target.value})} /></div>
          {([{field:'purchaseEnabled',label:'Disponible para compra'},{field:'saleEnabled',label:'Disponible para venta'}] as const).map(field=><div key={field.field} className="flex w-60 items-center justify-between gap-3 py-2"><Label htmlFor={`presentation-${field.field}-${row.key}`}>{field.label}</Label><Switch id={`presentation-${field.field}-${row.key}`} checked={row[field.field]} disabled={blocked} onCheckedChange={checked=>patchRow(row.key,{[field.field]:checked})} /></div>)}
        </div></details>
        {basePrice&&<p className="text-xs text-muted-foreground">{(()=>{try{return `Precio de ${row.name||'la presentación'}: ${formatUnitDecimal(row.price.trim()||deriveUnitPrice(basePrice,row.factor),locale)}${row.price.trim()?' · precio propio':' · según el precio base'}`}catch{return 'Completa el contenido y el precio para calcular el precio de esta presentación.'}})()}</p>}
        {onSavePresentation&&<Button type="button" variant="outline" disabled={blocked} onClick={()=>action(row)}>{row.id?'Guardar nueva versión':'Guardar presentación'}</Button>}
      </fieldset>)}
      <Button type="button" variant="outline" disabled={blocked||!allowPresentationDrafts} onClick={()=>{if(blocked||!allowPresentationDrafts)return;counter.current++;change({...value,presentations:[...value.presentations,{key:`draft-${counter.current}`,name:'',label:'',factor:'',quantityDecimals:'0',purchaseEnabled:true,saleEnabled:true,price:'',wholesale:'',promotion:'',promotionUntil:'',barcode:'',measureUnitId:null}]})}}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Agregar presentación</Button>
      {!allowPresentationDrafts&&<p className="text-xs text-muted-foreground">Guarda primero la unidad base para agregar presentaciones a este producto.</p>}
      {value.presentations.length>0&&<p className="text-xs text-muted-foreground">Archivar conserva los registros anteriores y retira esta presentación de nuevas operaciones.</p>}</div>
    </>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <ConfirmDialog open={!!archiveCandidate} onOpenChange={open=>{if(!open&&!working)setArchiveCandidate(null)}} title="¿Archivar esta presentación?" description="Se retirará de nuevas compras y ventas. Los registros anteriores conservarán su contenido y precio." appearance="auna" confirmText="Archivar presentación" loading={working} onConfirm={async()=>{if(archiveCandidate&&!blocked){await action(archiveCandidate,true);setArchiveCandidate(null)}}} />
  </section>
}
