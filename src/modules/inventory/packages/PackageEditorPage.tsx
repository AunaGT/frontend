import {useEffect,useRef,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {ArrowLeft,Plus,Save,Archive,Trash2,Package,Check} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {ImageUploadDropzone} from '@/components/ui/image-upload-dropzone'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {useToast} from '@/hooks/use-toast'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {formatUnitMoney,normalizeUnitDecimal,unitTicks} from '@/lib/unitQuantity'
import {usePackageScope} from './usePackageScope'
import {fetchPackage,savePackage,activatePackage,archivePackage,packageError,packageQueryKey,uploadPackageImage} from './api'
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
 const [selectedVariant,setSelectedVariant]=useState(''),[imageBusy,setImageBusy]=useState(false),[imageError,setImageError]=useState('')
 const [optionNotice,setOptionNotice]=useState(''),nameInput=useRef<HTMLInputElement>(null),focusNewOption=useRef<string|null>(null)
 const working=useRef(false),active=useRef<AbortController|null>(null),imageActive=useRef<AbortController|null>(null),alive=useRef(true),identity=JSON.stringify({definition,branchIds})
 const initial=useRef(identity),dirty=identity!==(saved||initial.current),variant=definition.variants.find(v=>v.id===selectedVariant)??definition.variants[0]
 const guard=useDraftGuard(dirty||imageBusy,context.registerTenantExitGuard,context.key),actionDisabled=!!row?.archivedAt||busy||loading||uncertain,disabled=!context.canEdit||actionDisabled
 useEffect(()=>{if(variant?.id===focusNewOption.current&&nameInput.current){nameInput.current.focus();focusNewOption.current=null}},[variant?.id])
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();imageActive.current?.abort()}},[])
 const selectImage=async(file:File)=>{
  if(disabled)return
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setImageError('Selecciona una imagen JPG, PNG o WebP');return}
  if(file.size>5*1024*1024){setImageError('La imagen admite hasta 5 MB');return}
  imageActive.current?.abort();const abort=new AbortController();imageActive.current=abort;setImageBusy(true);setImageError('')
  try{
   const result=await uploadPackageImage(context.scope!,file,abort.signal)
   if(alive.current&&!abort.signal.aborted&&imageActive.current===abort)setDefinition(d=>({...d,imageUrl:result.imageUrl}))
  }catch(e){if(alive.current&&!abort.signal.aborted&&imageActive.current===abort)setImageError(packageError(e))}
  finally{if(alive.current&&imageActive.current===abort){imageActive.current=null;setImageBusy(false)}}
 }
 const money=(value:string|null)=>{try{return formatUnitMoney(value||'0','es-GT',definition.currency)}catch{return value||'—'}}
 useEffect(()=>{if(!id)return;const abort=new AbortController();setLoading(true);setError('');void fetchPackage(context.scope!,id,abort.signal).then(r=>{if(!abort.signal.aborted){setRow(r);setDefinition(r.definition);setBranchIds(r.branchIds);setSaved(JSON.stringify({definition:r.definition,branchIds:r.branchIds}));setUncertain(false)}}).catch(e=>{if(!abort.signal.aborted)setError(packageError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[context.scope,id,reload])
 const execute=async(mode:'save'|'activate'|'archive')=>{
  if(working.current||imageActive.current||actionDisabled||!(mode==='save'?context.canEdit:mode==='activate'?context.canPublish:context.canArchive)||mode!=='save'&&(!row||dirty))return
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
 return <main className="mx-auto w-full max-w-[1440px] min-w-0 p-4 sm:p-6 space-y-4">{guard.dialog}
 <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Button size="icon" variant="outline" aria-label="Volver a paquetes" onClick={()=>guard.request(()=>navigate('/inventario/paquetes'))}><ArrowLeft size={18}/></Button><div><h1 className="text-xl font-semibold">{id?'Editar paquete':'Nuevo paquete'}</h1><p className="text-xs text-muted-foreground">{row?.archivedAt?'Archivado · acuerdos anteriores intactos':row?.activeVersion?'Activo v'+row.activeVersion+' · editas el siguiente borrador':'Borrador · aún no disponible al cotizar'}</p></div></div><div className="flex flex-wrap gap-2">{id&&context.canArchive&&<Button variant="outline" disabled={actionDisabled||imageBusy||dirty} onClick={()=>setAction('archive')}><Archive size={16} aria-hidden="true"/>Archivar</Button>}<Button variant="outline" disabled={!context.canPublish||actionDisabled||imageBusy||!row||dirty} aria-describedby={!context.canPublish?'package-publish-permission':undefined} onClick={()=>setAction('activate')}>Activar versión</Button><Button disabled={disabled||imageBusy} onClick={()=>void execute('save')}><Save size={16} aria-hidden="true"/>{busy?'Guardando…':'Guardar borrador'}</Button></div></header>
 {!context.canPublish&&<p id="package-publish-permission" className="text-sm text-muted-foreground">Puedes consultar o preparar el borrador según tus permisos. Activar una versión requiere autorización para publicar paquetes.</p>}
 {error&&<div id="package-errors" role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2"><p>{error}</p>{Object.entries(fields).map(([key,message])=><p key={key}>{key}: {message}</p>)}{uncertain&&<><p>No se repetirá la operación automáticamente. Recarga y compara la versión guardada antes de continuar.</p><Button variant="outline" onClick={()=>{if(id)guard.request(()=>setReload(n=>n+1));else guard.request(()=>navigate('/inventario/paquetes'))}}>Revisar datos guardados</Button></>}</div>}
 {loading?<p role="status">Cargando paquete…</p>:<form className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]" onSubmit={e=>{e.preventDefault();void execute('save')}} aria-describedby={error?'package-errors':undefined}>
 <div className="min-w-0 space-y-4">
  <fieldset disabled={disabled} className="min-w-0 rounded-xl border bg-card p-4"><legend className="sr-only">Datos generales</legend>
   <div className="grid min-w-0 gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
    <div className="min-w-0 space-y-2">
     <p className="text-sm font-medium">Foto · opcional</p>
     {definition.imageUrl&&<img src={definition.imageUrl} alt={definition.name?'Foto de '+definition.name:'Foto del paquete'} width={96} height={80} className="mx-auto h-20 w-24 rounded-lg border object-contain"/>}
     <ImageUploadDropzone onFileSelect={file=>void selectImage(file)} onReject={setImageError} disabled={disabled} isUploading={imageBusy} accept="image/png,image/jpeg,image/webp" validateFile={file=>['image/png','image/jpeg','image/webp'].includes(file.type)?null:'Selecciona una imagen JPG, PNG o WebP'} className="[&_.auna-file-dropzone]:px-2 [&_.auna-file-dropzone]:py-3"/>
     {imageBusy&&<Button variant="ghost" size="sm" type="button" onClick={()=>{imageActive.current?.abort();imageActive.current=null;setImageBusy(false)}}>Cancelar carga</Button>}
     {definition.imageUrl&&!imageBusy&&<Button variant="ghost" size="sm" type="button" disabled={disabled} onClick={()=>setDefinition(d=>({...d,imageUrl:null}))}>Quitar foto</Button>}
     {imageError&&<p role="alert" className="text-sm text-destructive">{imageError}</p>}
    </div>
    <div className="min-w-0 space-y-3">
     <div className="grid min-w-0 max-w-4xl items-start gap-3 lg:grid-cols-[minmax(0,36rem)_minmax(0,20rem)]">
      <div className="min-w-0 max-w-xl"><Label htmlFor="package-name">Nombre del paquete</Label><Input id="package-name" maxLength={150} value={definition.name} aria-invalid={!!fields.name} placeholder="Ej. Experiencia de celebración" onChange={e=>setDefinition(d=>({...d,name:e.target.value}))}/></div>
      <details className="min-w-0 rounded-lg border p-3 lg:mt-6"><summary className="cursor-pointer text-sm font-medium">Disponibilidad · {branchIds.length} {branchIds.length===1?'sucursal':'sucursales'}</summary><fieldset className="mt-3"><legend className="sr-only">Sucursales donde se ofrece</legend><div className="flex flex-wrap gap-3">{context.branches.map(branch=><label key={branch.id} className="flex items-center gap-2 text-sm"><Checkbox checked={branchIds.includes(branch.id)} onCheckedChange={checked=>setBranchIds(ids=>checked?[...new Set([...ids,branch.id])]:ids.filter(id=>id!==branch.id))}/>{branch.name}</label>)}</div></fieldset></details>
     </div>
     <div className="min-w-0 max-w-4xl"><Label htmlFor="package-description">Descripción</Label><Textarea id="package-description" rows={2} maxLength={2000} value={definition.description} placeholder="Qué incluye y por qué elegirlo" onChange={e=>setDefinition(d=>({...d,description:e.target.value}))}/></div>
    </div>
   </div>
  </fieldset>
  <section className="min-w-0 rounded-xl border bg-card p-4 space-y-4" aria-labelledby="package-composition-heading">
   <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="package-composition-heading" className="font-semibold">Opciones del paquete</h2><p className="text-sm text-muted-foreground">Cada tamaño o combinación tiene su precio y contenido. Si solo ofreces uno, basta con una opción.</p></div><Button type="button" size="sm" variant="outline" disabled={disabled||definition.variants.length>=20} onClick={()=>{const next=newVariant();focusNewOption.current=next.id;setDefinition(d=>({...d,variants:[...d.variants,next]}));setSelectedVariant(next.id);setOptionNotice('Opción '+(definition.variants.length+1)+' creada. Dale un nombre y completa lo que incluye.')}}><Plus size={16} aria-hidden="true"/>Agregar otra opción</Button></div>
   <div role="group" aria-label="Opciones del paquete" className="grid min-w-0 max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{definition.variants.map((v,i)=><Button key={v.id} type="button" variant="outline" aria-label={'Editar opción '+(v.name||'Opción '+(i+1))} aria-pressed={v.id===variant?.id} aria-controls="package-option-editor" title={v.name||'Opción '+(i+1)} className={'h-auto min-h-11 min-w-0 justify-start gap-2 px-3 py-2 text-left '+(v.id===variant?.id?'border-primary bg-primary/10':'')} onClick={()=>{setSelectedVariant(v.id);setOptionNotice('')}}>{v.id===variant?.id&&<Check size={16} className="shrink-0" aria-hidden="true"/>}<span className="min-w-0"><span className="block truncate">{v.name||'Opción '+(i+1)}</span><span className="block text-xs font-normal text-muted-foreground">{v.price===null?'Sin precio':money(v.price)}</span></span></Button>)}</div>
   <p role="status" aria-live="polite" className={optionNotice?'text-sm text-muted-foreground':'sr-only'}>{optionNotice}</p>
   {definition.variants.length>=20&&<p className="text-sm text-muted-foreground">Este paquete ya tiene el máximo de 20 opciones.</p>}
   {variant&&<div id="package-option-editor" className="min-w-0 space-y-3 border-t pt-3"><div className="flex min-w-0 items-center justify-between gap-2"><p className="min-w-0 break-words text-sm font-medium">Editando: {variant.name||'Opción '+(definition.variants.indexOf(variant)+1)}</p><Button variant="ghost" type="button" size="icon" aria-label="Quitar opción seleccionada" disabled={disabled} onClick={()=>{setDefinition(d=>({...d,variants:d.variants.filter(v=>v.id!==variant.id)}));setOptionNotice('')}}><Trash2 size={16} aria-hidden="true"/></Button></div>
    <PackageVariantFields key={variant.id} nameInputRef={nameInput} variant={variant} index={definition.variants.indexOf(variant)} scope={context.scope!} disabled={disabled} onChange={value=>setDefinition(d=>({...d,variants:d.variants.map(v=>v.id===value.id?value:v)}))}/>
   </div>}
  </section>
 </div>
 <aside className="min-w-0 rounded-xl border bg-card p-4 space-y-4 xl:sticky xl:top-4" aria-label="Resumen del paquete">
  <div className="flex items-center gap-2 text-sm font-semibold"><Package size={18} aria-hidden="true"/>Resumen</div>
  <div className="space-y-1"><p className="break-words font-medium">{definition.name||'Tu nuevo paquete'}</p><p className="text-sm text-muted-foreground">{variant?.name||'Opción sin nombre'}</p><p className="text-2xl font-semibold tabular-nums">{variant?money(variant.price):'—'}</p><p className="text-xs text-muted-foreground">Precio total de esta opción · {definition.currency}</p></div>
  <dl className="space-y-2 border-y py-3 text-sm"><div className="flex justify-between gap-2"><dt>Artículos incluidos</dt><dd>{variant?.components.length??0}</dd></div><div className="flex justify-between gap-2"><dt>Elecciones del cliente</dt><dd>{variant?.choices.length??0}</dd></div><div className="flex justify-between gap-2"><dt>Opciones del paquete</dt><dd>{definition.variants.length}</dd></div></dl>
  {variant&&<><ul className="space-y-1 text-sm text-muted-foreground">{variant.components.map((c,i)=><li key={c.id}>{c.quantity||'—'} × Artículo fijo {i+1}</li>)}{variant.choices.map(c=><li key={c.id}>{c.totalQuantity||'—'} a elegir · {c.name||'Elección del cliente'}</li>)}</ul><details><summary className="cursor-pointer text-sm text-muted-foreground">Ver distribución estimada</summary><p className="mt-2 break-words text-sm">{distribution(variant)}</p></details></>}
  <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground"><li>Guarda el borrador.</li><li>Activa la versión para ofrecerla al cotizar.</li></ol><p className="text-xs text-muted-foreground">No duplica existencias. Los acuerdos anteriores conservan su composición y precio.</p>
 </aside>
 </form>}
 <ConfirmDialog appearance="auna" open={!!action} onOpenChange={open=>{if(!open)setAction(null)}} variant="warning" loading={busy} title={action==='archive'?'¿Archivar este paquete?':'¿Activar esta versión?'} description={action==='archive'?'Ya no se ofrecerá en cotizaciones nuevas. Los acuerdos existentes conservan su composición y precio.':'La composición se valida y queda congelada como una nueva versión. Las cotizaciones anteriores no se recalculan.'} confirmText={action==='archive'?'Archivar':'Activar versión'} onConfirm={()=>execute(action!)}/>
 </main>
}
export default function PackageEditorPage(){const context=usePackageScope(),{id}=useParams();if(!context.scope||!context.canRead)return <p className="p-6" role="status">Selecciona una empresa y sucursal con acceso a Inventario.</p>;return <PackageEditor key={context.key+id} context={context} id={id}/>}
