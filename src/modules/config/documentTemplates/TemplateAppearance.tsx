import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {LoadingState} from '@/components/shared/LoadingState'
import {Alert,AlertDescription} from '@/components/ui/alert'
import {toast} from '@/hooks/use-toast'
import {useTemplateConfirmation} from './useTemplateConfirmation'
import {readAppearance,saveAppearance,assertTemplateScope} from './api'
import {useTemplateLeaveGuard,type TemplateExitGuard} from './useTemplateLeaveGuard'
import type {Appearance,TemplateScope,Schema} from './types'
export function TemplateAppearance({scope,canManage,registerGuard,schema,onDirty}:{scope:TemplateScope;canManage:boolean;registerGuard:(guard:TemplateExitGuard)=>()=>void;schema?:Schema;onDirty?:(dirty:boolean)=>void}){
  const [draft,setDraft]=useState<Appearance>({}),[confirmed,setConfirmed]=useState(''),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState('')
  const {confirm,dialog}=useTemplateConfirmation()
  const activity=useRef({dirty:false,pending:false}),controller=useRef(new AbortController()),busy=useRef(false)
  const dirty=JSON.stringify(draft)!==confirmed;activity.current={dirty,pending}
  useEffect(()=>{onDirty?.(!loading&&dirty);return()=>onDirty?.(false)},[dirty,loading])
  useEffect(()=>{void readAppearance(scope,controller.current.signal).then(result=>{setDraft(result.values);setConfirmed(JSON.stringify(result.values));setRevision(result.revision)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.current.signal.aborted)setLoading(false)});return()=>controller.current.abort()},[])
  useTemplateLeaveGuard(activity,registerGuard,message=>toast({title:message}),confirm)
  const field=(key:keyof Appearance,value:string|number)=>{setDraft(old=>{const next={...old};if(value==='')delete next[key];else Object.assign(next,{[key]:value});return next})}
  if(loading)return <LoadingState message="Cargando apariencia…"/>
  return <section className="document-template-appearance">{dialog}<h2 className="text-lg font-semibold">La firma de tu empresa</h2><p className="text-sm text-muted-foreground max-w-2xl">Se usa al preparar nuevos documentos de facturación. Las variantes de una plantilla tienen prioridad; los archivos anteriores no cambian.</p><div className="document-template-origin"><span>Nombre y logo: <Link to="/configuracion?seccion=empresa">Identidad</Link></span><span>NIT y domicilio: <Link to="/configuracion?seccion=fiscal">Datos fiscales</Link></span><small>Cambiar el logo en Identidad conserva su alcance global: también afecta los nuevos documentos de otros módulos.</small></div>{error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <fieldset className="document-template-appearance-grid" disabled={!canManage||pending||!!error&&confirmed===''}>
      <label className="document-template-field">Título habitual<Input value={draft.headerText||''} placeholder="Comprobante interno" maxLength={2000} onChange={e=>field('headerText',e.target.value)}/></label>
      <label className="document-template-field">Tipografía<select className="auna-control auna-control-select" value={draft.fontFamily||''} onChange={e=>field('fontFamily',e.target.value)}><option value="">La del diseño base</option>{((schema?.theme.fontFamily||[]) as string[]).map(font=><option key={font}>{font}</option>)}</select></label>
      <label className="document-template-field">Color destacado<Input value={draft.accentColor||''} placeholder="#194f78" onChange={e=>field('accentColor',e.target.value)}/></label>
      <label className="document-template-field">Color del texto<Input value={draft.textColor||''} placeholder="#202a35" onChange={e=>field('textColor',e.target.value)}/></label>
      <label className="document-template-field">Hoja preferida<select className="auna-control auna-control-select" value={draft.preferredFormat||'LETTER'} onChange={e=>field('preferredFormat',e.target.value)}><option value="LETTER">Carta</option><option value="A4">A4</option></select></label>
      <label className="document-template-field">Pie comercial<textarea className="auna-control min-h-24" value={draft.footerText||''} placeholder="Gracias por tu compra." maxLength={2000} onChange={e=>field('footerText',e.target.value)}/></label>
    </fieldset><p className="text-xs text-muted-foreground">Los campos vacíos heredan el diseño base. El servidor comprueba que el texto tenga contraste suficiente sobre papel blanco.</p>
    <div className="flex flex-wrap gap-3 pt-4"><Button disabled={!canManage||pending||!dirty||confirmed===''} onClick={()=>{if(busy.current)return;busy.current=true;setPending(true);setError('');void saveAppearance(scope,draft,revision,controller.current.signal).then(result=>{assertTemplateScope(scope,controller.current.signal);setDraft(result.values);setConfirmed(JSON.stringify(result.values));setRevision(result.revision);toast({title:'Apariencia guardada',description:'Se aplicará a los nuevos documentos.'})}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{busy.current=false;if(!controller.current.signal.aborted)setPending(false)})}}>{pending?'Guardando…':'Guardar apariencia'}</Button><Button variant="outline" disabled={pending||!dirty} onClick={()=>{void confirm({title:'¿Restablecer la apariencia?',description:'Se descartarán los cambios sin guardar y se recuperará la apariencia guardada.',confirmText:'Restablecer cambios'}).then(accepted=>{if(accepted&&!busy.current){setDraft(JSON.parse(confirmed||'{}'));setError('')}})}}>Restablecer cambios</Button></div>
  </section>
}
