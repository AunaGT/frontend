import {useEffect,useRef,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {useTemplateConfirmation} from '../documentTemplates/useTemplateConfirmation'
import {IntegrationSettingsLayout,IntegrationAccessState} from '../integrations/IntegrationSettingsLayout'
import {useIntegrationScope,type IntegrationContext} from '../integrations/useIntegrationScope'
import {getKey,getHistory,revokeKey,pauseKey,resumeKey,integrationError} from '../integrations/api'
import {scopeLabels,credentialStatuses} from '../integrations/model'
import {IntegrationUsage} from '../integrations/IntegrationUsage'
import {useIntegrationDate} from '../integrations/useIntegrationDate'
import type {Credential,AuditEvent} from '../integrations/types'

const actionText={pause:{title:'¿Pausar esta clave?',description:'La aplicación dejará de acceder. Puedes reanudarla mientras siga vigente; su fecha de vencimiento no cambia.',button:'Pausar'},resume:{title:'¿Reanudar esta clave?',description:'Se comprobarán los permisos y sucursales actuales del responsable. No se amplían permisos ni vigencia.',button:'Reanudar'},revoke:{title:'¿Revocar esta clave?',description:'La aplicación dejará de acceder en su próxima solicitud. Esta acción es definitiva.',button:'Revocar clave'}}
export function IntegrationDetail({context,id}:{context:IntegrationContext;id:string}){
 const date=useIntegrationDate()
 const [row,setRow]=useState<Credential|null>(null),[events,setEvents]=useState<AuditEvent[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[reload,setReload]=useState(0)
 const active=useRef<AbortController|null>(null),working=useRef(false),alive=useRef(true),current=useRef(context),{confirm,dialog}=useTemplateConfirmation()
 current.current=context
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[])
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');void Promise.all([getKey(context.scope!,id,abort.signal),getHistory(context.scope!,id,page,abort.signal)]).then(([key,h])=>{if(!abort.signal.aborted){setRow(key);setEvents(h.items);setTotal(h.total);setUncertain(false)}}).catch(e=>{if(!abort.signal.aborted)setError(integrationError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[context.key,context.scope,id,page,reload])
 const mutate=async(action:keyof typeof actionText)=>{
  if(working.current||uncertain||!row||!context.canManage||context.readOnly||row.status==='REVOKED'||action==='pause'&&row.status!=='ACTIVE'||action==='resume'&&row.status!=='PAUSED')return
  working.current=true
  try{
   const copy=actionText[action]
   if(!await confirm({title:copy.title,description:copy.description,confirmText:copy.button})||!alive.current||current.current.key!==context.key||!current.current.canManage||current.current.readOnly)return
   setBusy(true);const abort=new AbortController();active.current=abort
   await ({pause:pauseKey,resume:resumeKey,revoke:revokeKey})[action](context.scope!,id,abort.signal)
   if(alive.current&&!abort.signal.aborted)setReload(n=>n+1)
  }catch(e){if(alive.current&&(e as Error).name!=='AbortError'){setUncertain(true);setError(integrationError(e)+' No repitas la acción: recarga los datos para comprobar el estado.')}}
  finally{working.current=false;if(alive.current)setBusy(false)}
 }
 const blocked=busy||uncertain||loading
 return <IntegrationSettingsLayout companyName={context.companyName}>{dialog}
  {error&&<div className="integration-error" role="alert">{error}<Button variant="outline" onClick={()=>setReload(n=>n+1)}>Recargar</Button></div>}
  {loading?<p role="status">Cargando integración…</p>:row&&<>
   <header><div><h1>{row.name}</h1><p className="integration-help">{credentialStatuses[row.status]} · Identificador {row.publicId.slice(0,8)}…</p></div>
   {context.canManage&&!context.readOnly&&row.status!=='REVOKED'&&<div className="integration-actions">
    {row.status==='ACTIVE'&&<Button variant="outline" disabled={blocked} onClick={()=>void mutate('pause')}>Pausar</Button>}
    {row.status==='PAUSED'&&<Button variant="outline" disabled={blocked} onClick={()=>void mutate('resume')}>Reanudar</Button>}
    <Button variant="outline" disabled={blocked} asChild><Link onClick={e=>{if(blocked)e.preventDefault()}} to={'/configuracion/integraciones/nueva?reemplazar='+encodeURIComponent(row.id)}>Crear reemplazo</Link></Button>
    <Button variant="destructive" disabled={blocked} onClick={()=>void mutate('revoke')}>Revocar clave</Button>
    {busy&&<span role="status">Aplicando cambio…</span>}
   </div>}</header>
   {row.status==='PAUSED'&&<p className="integration-help">Pausada desde {date(row.pausedAt)}. Sigue contando en el límite de claves y su vigencia continúa. Si creas un reemplazo, también quedará pausado hasta que lo reanudes.</p>}
   <IntegrationUsage scope={context.scope!} credentialId={id} refreshKey={reload}/>
   <div className="integration-grid"><section className="integration-card"><h2>Alcance de esta clave</h2><ul>{row.scopes.map(s=><li key={s}>{scopeLabels[s]}</li>)}</ul><p>Sucursales: {row.branches.map(b=>b.name).join(', ')}</p><p className="integration-help">Los permisos y sucursales del responsable se vuelven a comprobar en cada solicitud. Los documentos consultables son solo los originados por esta integración.</p></section>
   <section className="integration-card"><h2>Responsable y vigencia</h2><p>Clientes: {row.customerPolicy==='CREATE_IF_MISSING'?'Puede registrar clientes nuevos al preparar borradores':'Solo clientes registrados'}.</p>{row.customerPaymentTermId&&<p>Término: {row.customerPaymentTermName||'Configurado en la clave'}</p>}<p className="integration-help">Identidad de integración: {row.integrationId}. Un reemplazo conserva esta identidad sin ampliar su alcance.</p><dl><div><dt>Responsable</dt><dd>{row.owner.name}</dd></div><div><dt>Vence</dt><dd>{date(row.expiresAt)}</dd></div><div><dt>Último acceso permitido</dt><dd>{row.lastUsedAt?date(row.lastUsedAt):'Sin accesos permitidos'}</dd></div></dl>{row.replacesId&&<p className="integration-help">Esta clave reemplaza otra. La anterior no se revoca automáticamente: <Link to={'/configuracion/integraciones/'+row.replacesId}>revisar clave anterior</Link>.</p>}</section></div>
   <section className="integration-card integration-table"><h2>Actividad</h2><p className="integration-help">Sin secretos ni datos de productos. Uso: 30 días; administración y creación de borradores: 365. Los acuses de idempotencia se conservan con el documento.</p>{!events.length?<p>Sin actividad registrada.</p>:<table><thead><tr><th>Fecha</th><th>Acción</th><th>Ruta y resultado</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{date(e.created_at)}</td><td>{{CREATE:'Creación',REPLACE:'Reemplazo',REVOKE:'Revocación',PAUSE:'Pausa',RESUME:'Reanudación',USE:'Solicitud',CREATE_DRAFT:'Creación de borrador'}[e.action]||e.action}</td><td>{e.route||'Administración'} {e.status||''}</td></tr>)}</tbody></table>}<div className="integration-actions"><Button variant="outline" disabled={page===1||busy} onClick={()=>setPage(n=>n-1)}>Anterior</Button><span>Página {page}</span><Button variant="outline" disabled={page*20>=total||busy} onClick={()=>setPage(n=>n+1)}>Siguiente</Button></div></section>
   <p className="integration-help">El secreto no puede recuperarse. Si no lo guardaste, crea un reemplazo y revoca esta clave.</p>
  </>}
 </IntegrationSettingsLayout>
}
export default function IntegrationDetailPage(){const context=useIntegrationScope(),{id}=useParams();if(!context.scope||!context.canRead||!id)return <IntegrationAccessState denied={!context.canRead}/>;return <IntegrationDetail key={context.key+id} context={context} id={id}/>}
