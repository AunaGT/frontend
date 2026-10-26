import {useEffect,useRef,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {ArrowLeft,Plus,Save,Archive,Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {useToast} from '@/hooks/use-toast'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {formatUnitMoney,normalizeUnitDecimal,unitTicks} from '@/lib/unitQuantity'
import {usePackageScope} from './usePackageScope'
import {fetchPackage,savePackage,activatePackage,archivePackage,packageError,packageQueryKey} from './api'
import {PackageVariantFields,newVariant} from './PackageVariantFields'
import type {CommercialPackage,PackageDefinition,PackageVariant} from './types'
type Context=ReturnType<typeof usePackageScope>
function distribution(variant:PackageVariant){
 try{
  const amount=unitTicks(normalizeUnitDecimal(variant.price??'',{decimals:2,max:'9999999999.99'}))/10000n
  const entries=[...variant.components,...variant.choices].map((c,i)=>({id:c.id,name:'name'in c?c.name||'Elección '+(i+1):'Artículo fijo '+(i+1),weight:unitTicks(normalizeUnitDecimal(c.weight??'',{decimals:4,max:'1000000'}))})).sort((a,b)=>a.id.localeCompare(b.id))
  const total=entries.reduce((sum,c)=>sum+c.weight,0n);if(!total)return 'Completa los pesos para ver la distribución.'
  let prior=0n,cumulative=0n
  return entries.map((c,i)=>{cumulative+=c.weight;const end=i===entries.length-1?amount:(amount*cumulative*2n+total)/(total*2n),value=end-prior;prior=end;return c.name+': '+(value/100n)+'.'+String(value%100n).padStart(2,'0')}).join(' · ')
 }catch{return 'Completa el precio y los pesos para ver la distribución.'}
}
export function PackageEditor({context,id}:{context:Context;id?:string}){
 const navigate=useNavigate(),queryClient=useQueryClient(),{toast}=useToast(),{currencyCode}=useSystemSettings()
 const [row,setRow]=useState<CommercialPackage|null>(null),[definition,setDefinition]=useState<PackageDefinition>({schemaVersion:1,name:'',description:'',imageUrl:null,currency:currencyCode||'GTQ',variants:[newVariant()]}),[branchIds,setBranchIds]=useState([context.scope!.branchId]),[saved,setSaved]=useState(''),[loading,setLoading]=useState(!!id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fields,setFields]=useState<Record<string,string>>({}),[uncertain,setUncertain]=useState(false),[reload,setReload]=useState(0),[action,setAction]=useState<'activate'|'archive'|null>(null)
 const working=useRef(false),active=useRef<AbortController|null>(null),alive=useRef(true),identity=JSON.stringify({definition,branchIds}),dirty=saved?identity!==saved:!!definition.name||!!definition.description||definition.variants.some(v=>v.name||v.price||v.components.length||v.choices.length)
 const guard=useDraftGuard(dirty,context.registerTenantExitGuard,context.key),disabled=!context.canEdit||!!row?.archivedAt||busy||loading||uncertain
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 useEffect(()=>{if(!id)return;const abort=new AbortController();setLoading(true);setError('');void fetchPackage(context.scope!,id,abort.signal).then(r=>{if(!abort.signal.aborted){setRow(r);setDefinition(r.definition);setBranchIds(r.branchIds);setSaved(JSON.stringify({definition:r.definition,branchIds:r.branchIds}));setUncertain(false)}}).catch(e=>{if(!abort.signal.aborted)setError(packageError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[context.scope,id,reload])
 const execute=async(mode:'save'|'activate'|'archive')=>{
  if(working.current||disabled||mode!=='save'&&(!row||dirty))return
  working.current=true;setBusy(true);setError('');setFields({});const abort=new AbortController();active.current=abort
  try{
   const result=mode==='save'?await savePackage(context.scope!,id||null,{expectedVersion:row?.version??0,definition,branchIds,idempotencyKey:crypto.randomUUID()},abort.signal):await (mode==='activate'?activatePackage:archivePackage)(context.scope!,row!.id,row!.version,crypto.randomUUID(),abort.signal)
   if(!alive.current||abort.signal.aborted)return
   await queryClient.invalidateQueries({queryKey:packageQueryKey(context.scope!)})
   toast({title:mode==='save'?'Borrador guardado':mode==='activate'?'Versión activada':'Paquete archivado'})
   if(mode==='save')setSaved(identity)
   if(!id)guard.proceed(()=>navigate('/inventario/paquetes/'+result.id+'/editar',{replace:true}));else setReload(n=>n+1)
  }catch(e){if(alive.current&&(e as Error).name!=='AbortError'){
   const err=e as {status?:number;data?:{fields?:Record<string,string>}};setError(packageError(e));setFields(err.data?.fields??{})
   if(!err.status||err.status>=500||err.status===409)setUncertain(true)
  }}finally{working.current=false;if(alive.current){setBusy(false);setAction(null)}}
 }
 return <main className="mx-auto w-full p-4 sm:p-6 space-y-4 max-w-6xl">{guard.dialog}
 <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Volver a paquetes" onClick={()=>guard.request(()=>navigate('/inventario/paquetes'))}><ArrowLeft size={18}/></Button><div><h1 className="text-xl font-semibold">{id?'Editar paquete':'Nuevo paquete'}</h1><p className="text-sm text-muted-foreground">{row?.archivedAt?'Archivado · acuerdos anteriores intactos':row?.activeVersion?'Activo v'+row.activeVersion+' · editas el siguiente borrador':'Borrador · aún no disponible al cotizar'}</p></div></div><div className="flex flex-wrap gap-2">{id&&context.canEdit&&<Button variant="outline" disabled={disabled||dirty} onClick={()=>setAction('archive')}><Archive size={16} aria-hidden="true"/>Archivar</Button>}<Button variant="outline" disabled={disabled||!row||dirty} onClick={()=>setAction('activate')}>Activar versión</Button><Button disabled={disabled} onClick={()=>void execute('save')}><Save size={16} aria-hidden="true"/>{busy?'Guardando…':'Guardar borrador'}</Button></div></header>
 {error&&<div id="package-errors" role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2"><p>{error}</p>{Object.entries(fields).map(([key,message])=><p key={key}>{key}: {message}</p>)}{uncertain&&<><p>No se repetirá la operación automáticamente. Recarga y compara la versión guardada antes de continuar.</p><Button variant="outline" onClick={()=>{if(id)guard.request(()=>setReload(n=>n+1));else guard.request(()=>navigate('/inventario/paquetes'))}}>Revisar datos guardados</Button></>}</div>}
 {loading?<p role="status">Cargando paquete…</p>:<form className="space-y-4" onSubmit={e=>{e.preventDefault();void execute('save')}} aria-describedby={error?'package-errors':undefined}>
 <fieldset disabled={disabled} className="rounded-xl border bg-card p-4 grid gap-4 md:grid-cols-2"><legend className="sr-only">Datos generales</legend><div><Label htmlFor="package-name">Nombre del paquete</Label><Input id="package-name" maxLength={150} value={definition.name} aria-invalid={!!fields.name} onChange={e=>setDefinition(d=>({...d,name:e.target.value}))}/></div><div><Label htmlFor="package-image">Imagen HTTPS (opcional)</Label><Input id="package-image" type="url" value={definition.imageUrl??''} onChange={e=>setDefinition(d=>({...d,imageUrl:e.target.value||null}))}/></div><div><Label htmlFor="package-description">Descripción</Label><Textarea id="package-description" rows={2} maxLength={2000} value={definition.description} onChange={e=>setDefinition(d=>({...d,description:e.target.value}))}/></div><fieldset><legend className="text-sm font-medium mb-2">Sucursales donde se ofrece</legend><div className="flex flex-wrap gap-3">{context.branches.map(branch=><label key={branch.id} className="flex items-center gap-2 text-sm"><Checkbox checked={branchIds.includes(branch.id)} onCheckedChange={checked=>setBranchIds(ids=>checked?[...ids,branch.id]:ids.filter(id=>id!==branch.id))}/>{branch.name}</label>)}</div><p className="text-sm text-muted-foreground mt-2">Moneda: {definition.currency}. Activar no modifica cotizaciones anteriores.</p></fieldset></fieldset>
 <div className="flex justify-between items-center"><h2 className="font-semibold">Variantes y composición</h2><Button type="button" size="sm" variant="outline" disabled={disabled||definition.variants.length>=20} onClick={()=>setDefinition(d=>({...d,variants:[...d.variants,newVariant()]}))}><Plus size={16} aria-hidden="true"/>Agregar variante</Button></div>
 {definition.variants.map((variant,index)=><details key={variant.id} open={index===0} className="rounded-xl border bg-card"><summary className="cursor-pointer p-4 font-medium">{variant.name||'Variante '+(index+1)}{variant.price&&<span className="ml-3 text-sm text-muted-foreground">{(()=>{try{return formatUnitMoney(variant.price,'es-GT',definition.currency)}catch{return variant.price}})()}</span>}</summary><div className="border-t p-4 space-y-4"><PackageVariantFields variant={variant} index={index} scope={context.scope!} disabled={disabled} onChange={value=>setDefinition(d=>({...d,variants:d.variants.map(v=>v.id===value.id?value:v)}))}/><p className="rounded-md bg-muted p-3 text-sm" aria-live="polite">Distribución estimada · {distribution(variant)}</p><Button variant="ghost" type="button" disabled={disabled} onClick={()=>setDefinition(d=>({...d,variants:d.variants.filter(v=>v.id!==variant.id)}))}><Trash2 size={16} aria-hidden="true"/>Quitar variante</Button></div></details>)}
 <p className="text-sm text-muted-foreground">Guarda primero. Activar valida productos, unidades y distribución; solo la versión activa se ofrece en cotizaciones.</p></form>}
 <ConfirmDialog appearance="auna" open={!!action} onOpenChange={open=>{if(!open)setAction(null)}} variant="warning" loading={busy} title={action==='archive'?'¿Archivar este paquete?':'¿Activar esta versión?'} description={action==='archive'?'Ya no se ofrecerá en cotizaciones nuevas. Los acuerdos existentes conservan su composición y precio.':'La composición se valida y queda congelada como una nueva versión. Las cotizaciones anteriores no se recalculan.'} confirmText={action==='archive'?'Archivar':'Activar versión'} onConfirm={()=>execute(action!)}/>
 </main>
}
export default function PackageEditorPage(){const context=usePackageScope(),{id}=useParams();if(!context.scope||!context.canRead)return <p className="p-6" role="status">Selecciona una empresa y sucursal con acceso a Inventario.</p>;return <PackageEditor key={context.key+id} context={context} id={id}/>}
