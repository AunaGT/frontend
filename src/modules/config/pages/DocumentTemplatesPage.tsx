import {useCallback,useEffect,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Alert,AlertDescription} from '@/components/ui/alert'
import {toast} from '@/hooks/use-toast'
import {useTemplateConfirmation} from '../documentTemplates/useTemplateConfirmation'
import type {TemplateExitGuard} from '../documentTemplates/useTemplateLeaveGuard'
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {LoadingState} from '@/components/shared/LoadingState'
import {Pagination} from '@/components/shared/Pagination'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useTemplateScope} from '../documentTemplates/useTemplateScope'
import {TemplateBases} from '../documentTemplates/TemplateBases'
import {TemplateAppearance} from '../documentTemplates/TemplateAppearance'
import {TemplateSettingsLayout} from '../documentTemplates/TemplateSettingsLayout'
import * as api from '../documentTemplates/api'
import {formatLabels,fiscalTemplateNotice,type PaperFormat,type TemplateRow,type Schema,type DocumentPurpose} from '../documentTemplates/types'
import '../documentTemplates/documentTemplates.css'
type Context=ReturnType<typeof useTemplateScope>
function Management({context}:{context:Context&{scope:NonNullable<Context['scope']>}}){
  const navigate=useNavigate(),{scope,canManage,canPublish}=context,{confirm,dialog}=useTemplateConfirmation()
  const [tab,setTab]=useState<'templates'|'appearance'>('templates'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[status,setStatus]=useState('ACTIVE'),[format,setFormat]=useState<PaperFormat>('RECEIPT_80'),[purpose,setPurpose]=useState<DocumentPurpose>('INTERNAL_RECEIPT')
  const [rows,setRows]=useState<TemplateRow[]>([]),[total,setTotal]=useState(0),[schema,setSchema]=useState<Schema>(),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0)
  const controller=useRef(new AbortController()),busy=useRef(false),appearanceGuard=useRef<TemplateExitGuard|null>(null)
  const registerAppearanceGuard=useCallback((guard:TemplateExitGuard)=>{appearanceGuard.current=guard;const unregister=context.registerGuard(guard);return()=>{if(appearanceGuard.current===guard)appearanceGuard.current=null;unregister()}},[context.registerGuard])
  const canLeave:TemplateExitGuard=(proceed)=>!busy.current&&(appearanceGuard.current?.(proceed)??true)
  const guardedNavigate=(path:string)=>{const go=()=>navigate(path);if(canLeave(go))go()}
  const changeTab=(next:typeof tab)=>{if(next!==tab&&canLeave(()=>setTab(next)))setTab(next)}
  const archive=async(row:TemplateRow)=>{if(await confirm({title:'¿Archivar este diseño?',description:'Los documentos y versiones anteriores se conservan. Si está en uso, primero publica otro como predeterminado.',confirmText:'Archivar diseño'}))void action(async()=>{await api.templateAction(scope,row.id,'archive',{expectedVersion:row.version},controller.current.signal);setReload(n=>n+1);toast({title:'Diseño archivado'})})}
  const newDesign=(base='CLASSIC')=>`/configuracion/plantillas/nueva?base=${base}&formato=${format}&tipo=${purpose}`
  useEffect(()=>{const request=new AbortController();setLoading(true);setError('');void Promise.all([api.listTemplates(scope,page,pageSize,status,request.signal),schema?Promise.resolve(schema):api.templateSchema(scope,request.signal)]).then(([data,manifest])=>{setRows(data.rows);setTotal(data.total);setSchema(manifest)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!request.signal.aborted)setLoading(false)});return()=>request.abort()},[page,pageSize,status,reload])
  useEffect(()=>()=>controller.current.abort(),[])
  const action=async(run:()=>Promise<void>)=>{if(busy.current)return;busy.current=true;setPending(true);setError('');try{await run()}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message)}finally{busy.current=false;if(!controller.current.signal.aborted)setPending(false)}}
  return <TemplateSettingsLayout companyName={context.companyName} canLeave={canLeave}><div className="document-templates-page"><header className="document-template-toolbar"><div><h1 className="text-xl font-semibold">Plantillas de documentos</h1><p className="text-sm text-muted-foreground">{context.companyName} · Comprobantes internos y diseño de factura FEL pendiente.</p></div>{canManage&&<Button disabled={pending} onClick={()=>guardedNavigate(newDesign())}>Crear diseño</Button>}</header>
    {dialog}<nav className="document-template-tabs" aria-label="Plantillas y apariencia"><Button variant={tab==='templates'?'default':'ghost'} onClick={()=>changeTab('templates')}>Mis plantillas</Button><Button variant={tab==='appearance'?'default':'ghost'} onClick={()=>changeTab('appearance')}>Apariencia de facturación</Button></nav>
    {tab==='appearance'?<TemplateAppearance scope={scope} canManage={canManage} schema={schema} registerGuard={registerAppearanceGuard}/>:<>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de documento"><Button variant={purpose==='INTERNAL_RECEIPT'?'default':'outline'} aria-pressed={purpose==='INTERNAL_RECEIPT'} onClick={()=>{setPurpose('INTERNAL_RECEIPT');setFormat('RECEIPT_80')}}>Comprobante interno</Button><Button variant={purpose==='FEL_INVOICE'?'default':'outline'} aria-pressed={purpose==='FEL_INVOICE'} disabled={!schema?.fiscalPresets} onClick={()=>{setPurpose('FEL_INVOICE');setFormat('LETTER')}}>Factura FEL · Pendiente</Button></div>
      {purpose==='FEL_INVOICE'?<p role="status" className="text-sm text-muted-foreground py-3">{fiscalTemplateNotice(schema?.fiscalEnabled)}</p>:<p className="text-sm text-muted-foreground py-3">Ticket Auna de 80 mm con el logo de tu negocio. El logo se toma de Identidad; los documentos anteriores conservan su diseño.</p>}
      <div className="document-template-section-heading"><div><h2 className="font-semibold">Empieza con una base</h2><p className="text-sm text-muted-foreground">Personalizar crea tu propia copia. Las bases y los documentos anteriores se conservan.</p></div><label className="document-template-field">Formato<select className="auna-control auna-control-select" value={format} onChange={e=>setFormat(e.target.value as PaperFormat)}>{(['LETTER','A4','RECEIPT_80'] as const).map(f=><option key={f} value={f}>{formatLabels[f]}</option>)}</select></label></div>
      {schema&&<TemplateBases bases={schema.bases} format={format} purpose={purpose} disabled={!canManage||pending} onChoose={base=>guardedNavigate(newDesign(base))}/>}
      <div className="document-template-section-heading"><h2 className="font-semibold">Tus diseños</h2><label className="document-template-check"><input type="checkbox" checked={status==='ARCHIVED'} onChange={e=>{setStatus(e.target.checked?'ARCHIVED':'ACTIVE');setPage(1)}}/> Ver archivadas</label></div>
      {error&&<Alert variant="destructive"><AlertDescription><p>{error}</p><Button variant="outline" className="mt-2" onClick={()=>setReload(n=>n+1)}>Actualizar listado</Button></AlertDescription></Alert>}
      {loading?<LoadingState message="Cargando tus diseños…"/>:!rows.length?<CollectionEmptyState title="Tu marca todavía tiene espacio aquí" description="Elige una base, dale tu estilo y comprueba el resultado antes de publicarlo." action={canManage?<Button onClick={()=>guardedNavigate(newDesign())}>Crear mi primer diseño</Button>:undefined}/>:<><Table><TableHeader><TableRow><TableHead>Diseño</TableHead><TableHead>Formato</TableHead><TableHead>Estado</TableHead><TableHead>Versión</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.id}><TableCell><button className="document-template-name" onClick={()=>guardedNavigate(`/configuracion/plantillas/${row.id}/editar`)}>{row.name}</button><small className="block text-muted-foreground">{row.purpose==='INTERNAL_RECEIPT'?'Comprobante interno':'Factura FEL · Pendiente'}</small></TableCell><TableCell>{formatLabels[row.format]}</TableCell><TableCell>{row.status==='DRAFT'?'Borrador':row.status==='PUBLISHED'?'Publicada':'Archivada'}{row.isDefault&&<small className="block">En uso · v{row.activeVersionNumber}</small>}</TableCell><TableCell>{row.versionNumber}</TableCell><TableCell><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>guardedNavigate(`/configuracion/plantillas/${row.id}/editar`)}>Abrir</Button>{canManage&&<Button variant="ghost" size="sm" disabled={pending} onClick={()=>void action(async()=>{const copy=await api.duplicateTemplate(scope,{templateId:row.id,name:`${row.name.slice(0,140)} · copia`},controller.current.signal);toast({title:'Diseño duplicado'});navigate(`/configuracion/plantillas/${copy.id}/editar`)})}>Duplicar</Button>}{canPublish&&row.state==='ACTIVE'&&<Button variant="ghost" size="sm" disabled={pending} onClick={()=>void archive(row)}>Archivar</Button>}</div></TableCell></TableRow>)}</TableBody></Table><Pagination currentPage={page} totalPages={Math.max(1,Math.ceil(total/pageSize))} onPageChange={setPage} totalItems={total} pageSize={pageSize} count={rows.length} itemLabel="diseños" onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/></>}
    </>}
  </div></TemplateSettingsLayout>
}
export default function DocumentTemplatesPage(){
  const context=useTemplateScope();usePageTrail([{label:'Plantillas de documentos'}])
  if(!context.scope||!context.canRead)return <LoadingState message="Comprobando el acceso a las plantillas…"/>
  return <Management key={context.key} context={{...context,scope:context.scope}}/>
}
