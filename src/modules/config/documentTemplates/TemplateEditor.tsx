import {lazy,Suspense,useEffect,useRef,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {LoadingState} from '@/components/shared/LoadingState'
import {Alert,AlertDescription} from '@/components/ui/alert'
import {toast} from '@/hooks/use-toast'
import {useTemplateConfirmation} from './useTemplateConfirmation'
import {useTemplateDraft} from './useTemplateDraft'
import {useTemplateLeaveGuard,type TemplateExitGuard} from './useTemplateLeaveGuard'
import {TemplateBlocks,type TemplateBlockSection} from './TemplateBlocks'
import {TemplateSettingsLayout} from './TemplateSettingsLayout'
import {TemplatePreview,downloadDocumentBlob} from './TemplatePreview'
import * as api from './api'
import {formatLabels,baseLabels,fiscalTemplateNotice,type TemplateScope,type Design,type Diagnostic,type PaperFormat,type Theme,type DocumentPurpose} from './types'
const Code=lazy(()=>import('./TemplateCode').then(m=>({default:m.TemplateCode})))
const typeLabel=(purpose:DocumentPurpose)=>purpose==='FEL_INVOICE'?'Factura FEL':'Comprobante interno'
type Props={scope:TemplateScope;id?:string;baseId?:string;format?:PaperFormat;purpose?:DocumentPurpose;canManage:boolean;canPublish:boolean;companyName:string;registerGuard:(guard:TemplateExitGuard)=>()=>void}
export function TemplateEditor({scope,id,baseId,format,purpose,canManage,canPublish,companyName,registerGuard}:Props){
  const h=useTemplateDraft({scope,id,baseId,format,purpose}),navigate=useNavigate(),{confirm,dialog}=useTemplateConfirmation()
  const [mode,setMode]=useState<'visual'|'code'>('visual'),[source,setSource]=useState(''),[codeDirty,setCodeDirty]=useState(false),[diagnostics,setDiagnostics]=useState<Diagnostic[]>([])
  const [pdf,setPdf]=useState<Blob|null>(null),[pdfSignature,setPdfSignature]=useState(''),[scenario,setScenario]=useState('SHORT'),[working,setWorking]=useState(false),[setDefault,setDefaultState]=useState(true)
  const setNotice=(message:string)=>{if(message)toast({title:message})}
  const [importTarget,setImportTarget]=useState<Design|null>(null)
  const [visualSection,setVisualSection]=useState<TemplateBlockSection|'appearance'>('header')
  const busy=useRef(false),errorBox=useRef<HTMLDivElement>(null),activity=useRef({dirty:false,pending:false})
  activity.current={dirty:h.dirty||codeDirty,pending:working||h.pending}
  const disabled=!canManage||working||h.pending,hSignature=JSON.stringify([h.design,codeDirty?source:null])
  const canLeave=useTemplateLeaveGuard(activity,registerGuard,setNotice,confirm)
  useEffect(()=>{if(h.error||diagnostics.length)errorBox.current?.focus()},[h.error,diagnostics])
  useEffect(()=>{if(h.row&&!codeDirty)setSource(h.row.source)},[h.row])
  async function run(action:()=>Promise<void>){
    if(busy.current||h.pending)return
    busy.current=true;setWorking(true);h.setError('');setNotice('');setImportTarget(null)
    try{await action()}catch(e){if((e as Error).name!=='AbortError'){try{api.assertTemplateScope(scope,h.signal);h.setError((e as Error).message);setDiagnostics((e as {data?:{diagnostics?:Diagnostic[]}}).data?.diagnostics||[])}catch{/* Discard the old context response. */}}}
    finally{busy.current=false;if(!h.signal.aborted)setWorking(false)}
  }
  async function canonical():Promise<Design>{
    if(!h.design)throw new Error('El diseño todavía no está listo')
    if(!canManage)return h.design
    const compiled=await api.compileTemplate(scope,mode==='code'&&codeDirty?{source}:{design:h.design},h.signal)
    compatible(compiled.design)
    h.setDesign(compiled.design);setSource(compiled.source);setCodeDirty(false);setDiagnostics([]);return compiled.design
  }
  function compatible(design:Design){
    if(h.row&&(design.purpose!==h.row.purpose||design.paper.format!==h.row.format)){
      setImportTarget(design)
      const difference=design.paper.format===h.row.format?`El tamaño ${formatLabels[design.paper.format]} sí coincide; lo que cambia es el tipo de documento.`:'El tamaño del XML no coincide con el de la plantilla abierta.'
      throw new Error(`${difference} XML: ${typeLabel(design.purpose)} · ${formatLabels[design.paper.format]}. Plantilla actual: ${typeLabel(h.row.purpose)} · ${formatLabels[h.row.format]}. La plantilla actual no cambió.`)
    }
  }
  async function importXml(file:File){await run(async()=>{
    if(file.size>(h.schema?.limits.xmlBytes||262144))throw new Error('El XML admite hasta 256 KiB')
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())}catch{throw new Error('Guarda el XML con codificación UTF-8 antes de importarlo')}
    api.assertTemplateScope(scope,h.signal);setSource(text);setCodeDirty(true);setMode('code')
    const compiled=await api.compileTemplate(scope,{source:text},h.signal);compatible(compiled.design)
    h.setDesign(compiled.design);setSource(compiled.source);setCodeDirty(false);setDiagnostics([]);setNotice('Diseño importado y normalizado como borrador. No se publicó.')
  })}
  async function exportXml(){await run(async()=>{
    const xml=canManage?(await api.compileTemplate(scope,mode==='code'&&codeDirty?{source}:{design:h.design!},h.signal)).source:h.row?await api.exportTemplateXml(scope,h.row.id,h.signal):null
    if(xml===null)throw new Error('Abre un diseño guardado para exportarlo')
    downloadDocumentBlob(scope,new Blob([xml],{type:'application/xml;charset=utf-8'}),'plantilla-auna.xml')
  })}
  async function save(){await run(async()=>{const row=await h.save(await canonical());if(row){setNotice('Borrador guardado. El diseño publicado no cambió.');if(!id)navigate(`/configuracion/plantillas/${row.id}/editar`,{replace:true})}})}
  async function preview(){await run(async()=>{
    const design=await canonical(),row=h.dirty||codeDirty||!h.row?await h.save(design):h.row
    if(!row)return
    const artifact=await api.startPreview(scope,{templateId:row.id,expectedVersion:row.version,scenario},h.signal)
    const ready=await api.waitPreview(scope,artifact,h.signal),blob=await api.previewBlob(scope,ready.id,h.signal)
    api.assertTemplateScope(scope,h.signal);setPdf(blob);setPdfSignature(JSON.stringify([design,null]));setNotice('Muestra lista. No se creó ni modificó una venta.')
  })}
  async function publish(){await run(async()=>{
    const design=await canonical(),row=h.dirty||codeDirty||!h.row?await h.save(design):h.row
    if(!row)return
    const ids=await Promise.all(['SHORT','LONG','LONG_TEXT'].map(async scenario=>{
      const started=await api.startPreview(scope,{templateId:row.id,expectedVersion:row.version,scenario},h.signal)
      return (await api.waitPreview(scope,started,h.signal)).id
    }))
    const published=await api.templateAction(scope,row.id,'publish',{expectedVersion:row.version,setDefault,validationArtifactIds:ids},h.signal)
    h.acceptSaved(published);setNotice(`Versión publicada para ${formatLabels[design.paper.format]}. Los documentos anteriores conservan su diseño.`)
  })}
  async function reset(){
    if(!h.design||!await confirm({title:'¿Volver al diseño base?',description:'Se descartarán los cambios de este borrador; la versión publicada se conserva.',confirmText:'Restablecer base'}))return
    await run(async()=>{if(h.row){h.acceptSaved(await api.templateAction(scope,h.row.id,'reset',{expectedVersion:h.row.version,baseId:h.design!.base.id},h.signal))}else{const presets=h.design!.purpose==='FEL_INVOICE'?h.schema!.fiscalPresets!:h.schema!.presets;h.setDesign(structuredClone(presets[h.design!.base.id][h.design!.paper.format]))}setCodeDirty(false);setDiagnostics([]);setNotice('Base restablecida como borrador, sin publicar.')})
  }
  async function image(slot:string,file:File){await run(async()=>{
    const row=h.dirty||!h.row||h.row.status==='PUBLISHED'?await h.save(await canonical()):h.row
    if(!row)return
    await api.uploadTemplateImage(scope,{versionId:row.versionId,expectedVersion:row.version,slot,file},h.signal)
    h.acceptSaved(await api.getTemplate(scope,row.id,h.signal));setNotice('Imagen asociada al borrador. Genera otra muestra para comprobarla.')
  })}
  const leaveTo=(path:string)=>{const go=()=>navigate(path);if(canLeave(go))go()}
  const back=()=>leaveTo('/configuracion/plantillas')
  if(h.loading)return <TemplateSettingsLayout companyName={companyName} canLeave={canLeave}><LoadingState variant="page" message="Preparando tu diseño…"/></TemplateSettingsLayout>
  if(!h.design||!h.schema)return <TemplateSettingsLayout companyName={companyName} canLeave={canLeave}>{dialog}<Alert variant="destructive"><AlertDescription><p>{h.error||'No se pudo abrir el diseño.'}</p><Button variant="outline" className="mt-2" onClick={h.reload}>Reintentar</Button></AlertDescription></Alert></TemplateSettingsLayout>
  const design=h.design,schema=h.schema
  function theme(key:keyof Theme,value:string|number|undefined){const next=structuredClone(design);if(value===undefined)delete next.themeOverrides[key];else Object.assign(next.themeOverrides,{[key]:value});h.setDesign(next)}
  const previewActions=<>
    <div className="document-template-generate"><label className="document-template-field">Ejemplo para probar<select className="auna-control auna-control-select" disabled={working} value={scenario} onChange={e=>setScenario(e.target.value)}><option value="SHORT">Una línea</option><option value="LONG">Muchas líneas</option><option value="LONG_TEXT">Textos extensos</option></select></label><Button variant="outline" disabled={working||(!canManage&&!canPublish)} onClick={()=>void preview()}>{working?'Generando…':'Generar muestra'}</Button></div>
    <details className="document-template-publish-help"><summary>Validación y publicación</summary>{canPublish&&design.purpose==='INTERNAL_RECEIPT'&&<label className="document-template-check"><input type="checkbox" disabled={working} checked={setDefault} onChange={e=>setDefaultState(e.target.checked)}/> Usar al preparar nuevos documentos de este formato</label>}<p className="document-template-help">Publicar ejecuta las tres pruebas. No emite FEL: <Link to="/configuracion?seccion=fiscal" className="underline">el certificador sigue pendiente</Link>.</p></details>
  </>
  return <TemplateSettingsLayout companyName={companyName} canLeave={canLeave}>{dialog}<div className="document-templates-page">
    <header className="document-template-toolbar document-template-editor-toolbar"><div><h1 className="sr-only">Editor de plantillas</h1><Button variant="ghost" onClick={back} disabled={working}>← Plantillas</Button><p className="text-sm text-muted-foreground">{companyName} · {typeLabel(design.purpose)} · {formatLabels[design.paper.format]} · {h.row?.status==='PUBLISHED'?'Versión publicada; editar creará otro borrador':'Borrador · No afecta documentos activos'}</p></div><div className="flex flex-wrap gap-2">{canManage&&<Button disabled={disabled||!h.name.trim()} onClick={()=>void save()}>Guardar borrador</Button>}{canPublish&&<Button variant="outline" disabled={working||h.pending||!h.row||h.row.status==='ARCHIVED'||design.purpose==='FEL_INVOICE'} onClick={()=>void publish()}>{design.purpose==='FEL_INVOICE'?'Publicación FEL pendiente':working?'Preparando…':'Validar y publicar'}</Button>}</div></header>
    {design.purpose==='FEL_INVOICE'&&<p role="status" className="text-sm py-3">{fiscalTemplateNotice(schema.fiscalEnabled)} Puedes guardar el diseño y generar muestras sin validez fiscal.</p>}
    {(h.error||diagnostics.length>0)&&<Alert variant="destructive" tabIndex={-1} ref={errorBox}><AlertDescription><p>{diagnostics.length?'Revisa lo señalado en el diseño.':h.error}</p>{diagnostics.map((d,i)=><p key={i}>{d.line?`Línea ${d.line}${d.column?`, columna ${d.column}`:''}`:d.path}: {d.message}</p>)}{canManage&&importTarget&&<div className="flex flex-wrap items-center gap-3 pt-3"><Button variant="outline" disabled={disabled} onClick={()=>leaveTo(`/configuracion/plantillas/nueva?base=${encodeURIComponent(importTarget.base.id)}&formato=${importTarget.paper.format}&tipo=${importTarget.purpose}`)}>{`Crear ${typeLabel(importTarget.purpose).toLowerCase().replace('fel','FEL')} en ${formatLabels[importTarget.paper.format]}`}</Button><p className="text-sm">Abre el diseño correcto y vuelve a seleccionar tu archivo XML. No se reemplaza esta plantilla.</p></div>}</AlertDescription></Alert>}
    <div className={`document-template-editor-layout ${mode==='code'?'is-code':''}`}><div className="document-template-controls"><label className="document-template-field">Nombre de la plantilla<Input value={h.name} maxLength={150} disabled={disabled} onChange={e=>h.setName(e.target.value)}/></label>
      <div className="flex flex-wrap gap-2 py-3">
        <Button variant={mode==='visual'?'default':'outline'} onClick={()=>void run(async()=>{if(mode==='code')await canonical();setMode('visual')})} disabled={working}>Diseño visual</Button>
        <Button variant={mode==='code'?'default':'outline'} onClick={()=>void run(async()=>{if(!codeDirty)await canonical();setMode('code')})} disabled={working}>Código XML</Button>
        <label className="document-template-import">Importar XML<input type="file" accept=".xml,application/xml,text/xml" disabled={disabled} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importXml(file)}}/></label>
        <Button variant="ghost" disabled={working||(!canManage&&!h.row)} onClick={()=>void exportXml()}>Exportar XML</Button>
      </div>
      {mode==='code'?<Suspense fallback={<LoadingState message="Abriendo editor XML…"/>}><Code value={source} onChange={v=>{setSource(v);setCodeDirty(true);setDiagnostics([]);setImportTarget(null);h.setError('')}} onValidate={()=>void run(async()=>{await canonical();setNotice('XML válido y aplicado al diseño visual.')})} schema={schema} diagnostics={diagnostics} disabled={disabled}/></Suspense>:<>
        <nav className="document-template-section-nav" aria-label="Secciones del diseño">{([['header','Encabezado'],['columns','Columnas'],['footer','Notas y pie'],['images','Imágenes'],['appearance','Apariencia']] as const).map(([key,label])=><Button key={key} variant="ghost" aria-pressed={visualSection===key} onClick={()=>setVisualSection(key)}>{label}</Button>)}</nav>
        {visualSection==='appearance'?<section aria-label="Apariencia del documento" className="document-template-appearance-panel"><h3 className="font-semibold">Tipografía, color y márgenes</h3><div className="document-template-form-grid">
          <label className="document-template-field">Tipografía<select className="auna-control auna-control-select" disabled={disabled} value={design.themeOverrides.fontFamily||''} onChange={e=>theme('fontFamily',e.target.value||undefined)}><option value="">Heredada de la empresa</option>{(schema.theme.fontFamily as string[]).map(f=><option key={f}>{f}</option>)}</select></label>
          {(['fontSize','spacing'] as const).map(key=><label key={key} className="document-template-field">{key==='fontSize'?'Tamaño del texto':'Espacio entre bloques'}<Input type="number" disabled={disabled} min={(schema.theme[key] as number[])[0]} max={(schema.theme[key] as number[])[1]} value={design.themeOverrides[key]??''} placeholder="Heredado" onChange={e=>theme(key,e.target.value===''?undefined:Number(e.target.value))}/></label>)}
          {(['accentColor','textColor'] as const).map(key=><label className="document-template-field" key={key}>{key==='accentColor'?'Color destacado':'Color del texto'}<Input disabled={disabled} value={design.themeOverrides[key]||''} placeholder="Heredado" onChange={e=>theme(key,e.target.value||undefined)}/></label>)}
          <label className="document-template-field">Margen (mm)<Input type="number" step="0.1" min="2.9" max={design.paper.format==='RECEIPT_80'?7:21} disabled={disabled} value={Math.round(design.paper.margin/2.83465*10)/10} onChange={e=>h.setDesign({...design,paper:{...design.paper,margin:Number(e.target.value)*2.83465}})}/></label>
        </div><p className="document-template-help">{baseLabels[design.base.id]} · {formatLabels[design.paper.format]}. Los campos vacíos heredan la apariencia de empresa. Para otro tamaño, crea otra plantilla.</p>{canManage&&<Button variant="outline" disabled={disabled} onClick={()=>void reset()}>Restablecer base</Button>}</section>:<TemplateBlocks design={design} schema={schema} section={visualSection} onChange={h.setDesign} disabled={disabled} onImage={canManage?image:undefined}/>}</>}
    </div><TemplatePreview scope={scope} pdf={pdf} pending={working} stale={pdfSignature!==hSignature} actions={previewActions}/></div>
  </div></TemplateSettingsLayout>
}
