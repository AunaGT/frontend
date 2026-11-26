import {useEffect,useId,useState} from 'react'
import type {Ref} from 'react'
import {Plus,Trash2,ChevronsUpDown,Check} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select'
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover'
import {Command,CommandInput,CommandList,CommandItem} from '@/components/ui/command'
import {packageRequest,packageError} from './api'
import type {PackageScope,PackageRef,PackageVariant,PackageChoice} from './types'

type ProductOption={id:string;name:string;kind:string;unit_revision?:number;service_unit_label?:string;presentations?:{id:string;name:string;label:string;active:boolean;sale_enabled:boolean}[]}
export const newRef=():PackageRef=>({productId:null,presentationId:null,unitRevision:null})
export const newVariant=():PackageVariant=>({id:crypto.randomUUID(),name:'',price:null,components:[],choices:[]})

export function PackageProductPicker({scope,value,onChange,disabled,label='Producto o servicio'}:{scope:PackageScope;value:PackageRef;onChange:(value:PackageRef)=>void;disabled?:boolean;label?:string}){
 const uid=useId(),[open,setOpen]=useState(false),[search,setSearch]=useState(''),[options,setOptions]=useState<ProductOption[]>([]),[selected,setSelected]=useState<ProductOption|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{
  if(!open)return
  const abort=new AbortController();setLoading(true);setError('');setOptions([])
  const timer=setTimeout(()=>{void packageRequest<{items:ProductOption[]}>(scope,'/api/products?forSale=true&pageSize=25&search='+encodeURIComponent(search),{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setOptions(r.items)}).catch(e=>{if(!abort.signal.aborted)setError(packageError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)})},200)
  return()=>{clearTimeout(timer);abort.abort()}
 },[scope,search,open,retry])
 useEffect(()=>{
  const abort=new AbortController();setSelected(null);setError('')
  if(value.productId)void packageRequest<ProductOption>(scope,'/api/products/'+encodeURIComponent(value.productId),{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setSelected(r)}).catch(e=>{if(!abort.signal.aborted)setError(packageError(e))})
  return()=>abort.abort()
 },[scope,value.productId,retry])
 const choose=(p:ProductOption)=>{setSelected(p);onChange({productId:p.id,presentationId:null,unitRevision:p.unit_revision??1});setOpen(false)}
 return <div className="min-w-0 space-y-1.5">
  <Label htmlFor={uid}>{label}</Label>
  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
   <Popover open={open&&!disabled} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={uid} variant="outline" type="button" role="combobox" aria-expanded={open&&!disabled} aria-controls={uid+'-results'} disabled={disabled} className="w-full min-w-0 justify-between font-normal"><span className="truncate">{selected?.name||(value.productId?'Cargando artículo…':'Buscar producto o servicio…')}</span><ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true"/></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[min(20rem,calc(100vw-2rem))] p-0"><Command shouldFilter={false}><CommandInput value={search} onValueChange={setSearch} aria-label={'Buscar '+label.toLowerCase()} placeholder="Nombre o código…"/><CommandList id={uid+'-results'}>
     {loading?<p role="status" className="p-3 text-sm text-muted-foreground">Buscando…</p>:error?<div className="p-3 text-sm"><p role="alert">{error}</p><Button variant="outline" size="sm" type="button" onClick={()=>setRetry(n=>n+1)}>Reintentar</Button></div>:!options.length?<p className="p-3 text-sm text-muted-foreground">Sin coincidencias. Prueba otro nombre o código.</p>:options.map(p=><CommandItem key={p.id} value={p.id} onSelect={()=>choose(p)}><span className="min-w-0 flex-1 whitespace-normal">{p.name}{p.kind==='SERVICE'?' · Servicio':''}</span>{value.productId===p.id&&<Check size={16} aria-hidden="true"/>}</CommandItem>)}
    </CommandList></Command></PopoverContent>
   </Popover>
   {selected&&<Select value={value.presentationId??'base'} disabled={disabled} onValueChange={id=>onChange({...value,presentationId:id==='base'?null:id,unitRevision:selected.unit_revision??1})}><SelectTrigger aria-label={'Presentación de '+selected.name}><SelectValue placeholder="Unidad base"/></SelectTrigger><SelectContent><SelectItem value="base">Unidad base{selected.service_unit_label?' · '+selected.service_unit_label:''}</SelectItem>{selected.presentations?.filter(p=>p.active&&p.sale_enabled).map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.label&&p.label!==p.name?' · '+p.label:''}</SelectItem>)}</SelectContent></Select>}
  </div>
  {!open&&error&&<div className="text-sm text-destructive"><p role="alert">{error}</p><Button size="sm" variant="outline" type="button" disabled={disabled} onClick={()=>setRetry(n=>n+1)}>Reintentar</Button></div>}
 </div>
}

export function PackageVariantFields({variant,index,scope,onChange,disabled=false,nameInputRef}:{variant:PackageVariant;index:number;scope:PackageScope;onChange:(value:PackageVariant)=>void;disabled?:boolean;nameInputRef?:Ref<HTMLInputElement>}){
 const prefix='variant-'+variant.id,update=(patch:Partial<PackageVariant>)=>onChange({...variant,...patch})
 const choice=(id:string,patch:Partial<PackageChoice>)=>update({choices:variant.choices.map(c=>c.id===id?{...c,...patch}:c)})
 return <fieldset disabled={disabled} className="grid min-w-0 items-start gap-4 2xl:grid-cols-2"><legend className="sr-only">Opción del paquete {index+1}</legend>
  <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,32rem)_10rem] 2xl:col-span-2"><div className="min-w-0 max-w-lg"><Label htmlFor={prefix+'-name'}>Nombre de esta opción</Label><Input ref={nameInputRef} id={prefix+'-name'} maxLength={150} value={variant.name} placeholder="Ej. 80 unidades, tamaño grande o plan completo" onChange={e=>update({name:e.target.value})}/></div><div className="min-w-0 max-w-40"><Label htmlFor={prefix+'-price'}>Precio de esta opción</Label><Input id={prefix+'-price'} inputMode="decimal" placeholder="0.00" value={variant.price??''} onChange={e=>update({price:e.target.value||null})}/></div></div>
  <section className="min-w-0 max-w-3xl space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Siempre incluye</h3><Button size="sm" variant="outline" type="button" disabled={disabled||variant.components.length>=50} onClick={()=>update({components:[...variant.components,{id:crypto.randomUUID(),...newRef(),quantity:'1',weight:'1'}]})}><Plus size={16} aria-hidden="true"/>Agregar artículo</Button></div>
   {variant.components.map((c,i)=><div key={c.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-2 rounded-lg border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_5rem_2.5rem]">
    <div className="col-span-2 min-w-0 sm:col-span-1"><PackageProductPicker scope={scope} value={c} onChange={ref=>update({components:variant.components.map(r=>r.id===c.id?{...r,...ref}:r)})} disabled={disabled} label={'Artículo fijo '+(i+1)}/></div>
    <div className="w-28 space-y-1.5 sm:w-full"><Label htmlFor={c.id+'-qty'}>Cantidad</Label><Input id={c.id+'-qty'} inputMode="decimal" value={c.quantity??''} onChange={e=>update({components:variant.components.map(r=>r.id===c.id?{...r,quantity:e.target.value||null}:r)})}/></div>
    <Button type="button" variant="ghost" size="icon" className="mt-6" disabled={disabled} aria-label={'Quitar artículo fijo '+(i+1)} onClick={()=>update({components:variant.components.filter(r=>r.id!==c.id)})}><Trash2 size={16} aria-hidden="true"/></Button>
   </div>)}
   {!variant.components.length&&<p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Agrega lo que siempre incluye, como artículos, atención o montaje.</p>}
  </section>
  <section className="min-w-0 max-w-3xl space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">El cliente puede elegir</h3><Button size="sm" variant="outline" type="button" disabled={disabled||variant.choices.length>=10} onClick={()=>update({choices:[...variant.choices,{id:crypto.randomUUID(),name:'',totalQuantity:null,maxDistinct:1,weight:'1',options:[]}]})}><Plus size={16} aria-hidden="true"/>Agregar elección</Button></div>
   {variant.choices.map(c=><details open key={c.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{c.name||'Nueva elección'}</summary><div className="space-y-3 pt-3">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]"><div><Label htmlFor={c.id+'-name'}>Nombre (ej. sabores)</Label><Input id={c.id+'-name'} value={c.name} maxLength={150} onChange={e=>choice(c.id,{name:e.target.value})}/></div><div><Label htmlFor={c.id+'-total'}>Total a elegir</Label><Input id={c.id+'-total'} value={c.totalQuantity??''} inputMode="decimal" onChange={e=>choice(c.id,{totalQuantity:e.target.value||null})}/></div><div><Label htmlFor={c.id+'-max'}>Opciones distintas</Label><Input id={c.id+'-max'} type="number" min={1} max={50} value={c.maxDistinct??''} onChange={e=>choice(c.id,{maxDistinct:e.target.value?Number(e.target.value):null})}/></div></div>
    <p className="text-xs text-muted-foreground">Usa la misma unidad y presentación en las opciones. Las cantidades se acuerdan al cotizar.</p>
    {c.options.map((o,i)=><div key={o.id} className="flex items-start gap-2"><div className="min-w-0 flex-1"><PackageProductPicker scope={scope} value={o} disabled={disabled} label={'Opción '+(i+1)} onChange={ref=>choice(c.id,{options:c.options.map(r=>r.id===o.id?{...r,...ref}:r)})}/></div><Button type="button" variant="ghost" size="icon" className="mt-6" disabled={disabled} aria-label={'Quitar opción '+(i+1)} onClick={()=>choice(c.id,{options:c.options.filter(r=>r.id!==o.id)})}><Trash2 size={16} aria-hidden="true"/></Button></div>)}
    <div className="flex flex-wrap justify-between gap-2"><Button type="button" size="sm" variant="outline" disabled={disabled||c.options.length>=50} onClick={()=>choice(c.id,{options:[...c.options,{id:crypto.randomUUID(),...newRef()}]})}>Agregar opción</Button><Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={()=>update({choices:variant.choices.filter(r=>r.id!==c.id)})}>Quitar elección</Button></div>
   </div></details>)}
   {!variant.choices.length&&<p className="text-sm text-muted-foreground">Opcional: permite elegir sabores, productos o servicios al cotizar.</p>}
  </section>
  {!!(variant.components.length||variant.choices.length)&&<details className="min-w-0 max-w-3xl rounded-lg border p-3 2xl:col-span-2" aria-label="Distribución del precio"><summary className="cursor-pointer text-sm font-medium">Distribución del precio · avanzado</summary><div className="space-y-3 pt-3"><p className="text-sm text-muted-foreground">Los pesos reparten el precio entre los componentes, no son costos ni cambian el total. Con pesos iguales se reparte por igual; 0 significa incluido sin cargo.</p>
   {variant.components.map((c,i)=><div key={c.id} className="flex items-center justify-between gap-3"><Label htmlFor={c.id+'-weight'}>Artículo fijo {i+1}</Label><Input className="!w-28" id={c.id+'-weight'} inputMode="decimal" value={c.weight??''} onChange={e=>update({components:variant.components.map(r=>r.id===c.id?{...r,weight:e.target.value||null}:r)})}/></div>)}
   {variant.choices.map(c=><div key={c.id} className="flex items-center justify-between gap-3"><Label htmlFor={c.id+'-weight'}>{c.name||'Elección del cliente'}</Label><Input className="!w-28" id={c.id+'-weight'} value={c.weight??''} inputMode="decimal" onChange={e=>choice(c.id,{weight:e.target.value||null})}/></div>)}
  </div></details>}
 </fieldset>
}
