import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useTenant} from '@/context/useTenant'
import {getSettingsHistory,type SettingHistoryItem} from '@/services/settingsService'
import {Card,CardContent,CardHeader,CardTitle,CardDescription} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/shared/Pagination'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useModules} from '@/context/useModules'
import {SETTINGS_SECTIONS,SECTION_KEYS,type EditableSection} from '../settingsModel'

const names:Record<string,string>={company_name:'Nombre de empresa',company_logo_url:'Logo',company_nit:'NIT',company_address:'Dirección','returns.policy':'Política de devoluciones','inventory.expiry_alert_policy':'Avisos de vencimiento','accounting.defaultAccounts':'Cuentas por defecto','inventory.barcode_label_layout':'Diseño de códigos de barras','inventory.shelf_price_label_layout':'Diseño de etiquetas de precio'}
function value(text:string|null){if(text===null)return 'Sin configurar';if(text==='true')return 'Sí';if(text==='false')return 'No';return text||'Vacío'}
export function SettingsHistorySection(){
  const {company,branch,isConsolidated}=useTenant(),[page,setPage]=useState(1),[section,setSection]=useState('all')
  const {user,hasPermission,permissionsReady}=useAuthPermissions()
  const modules=useModules()
  const scope={companyId:company?.id||'',branchId:branch?.id||(isConsolidated?'all':'')}
  const keys=section==='all'?[]:[...(SECTION_KEYS[section as EditableSection]||[])]
  const query=useQuery({queryKey:['settings-history',user?.id,hasPermission('accounting.view'),hasPermission('products.view'),modules.enabledModuleCodes?.has('accounting')===true,modules.enabledModuleCodes?.has('inventory')===true,scope.companyId,scope.branchId,page,section],enabled:permissionsReady&&!modules.isLoading&&!modules.isError&&!!modules.enabledModuleCodes&&!!scope.companyId&&!!scope.branchId,queryFn:({signal})=>getSettingsHistory(page,keys,{scope,signal})})
  return <Card className="config-panel"><CardHeader><CardTitle>Historial de ajustes</CardTitle><CardDescription>Cambios registrados desde la activación del historial. No reconstruye cambios anteriores ni permite restaurarlos automáticamente.</CardDescription></CardHeader><CardContent className="space-y-4">
    <label className="grid gap-2 text-sm max-w-xs">Sección<select className="auna-control auna-control-select" value={section} onChange={e=>{setSection(e.target.value);setPage(1)}}><option value="all">Todos los ajustes autorizados</option>{SETTINGS_SECTIONS.filter(s=>Object.prototype.hasOwnProperty.call(SECTION_KEYS,s.id)).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    {modules.isLoading||query.isLoading?<p role="status">Cargando cambios…</p>:modules.isError||query.isError?<div role="alert"><p>No se pudo cargar el historial o confirmar sus módulos autorizados.</p><Button variant="outline" onClick={()=>void(modules.isError?modules.refetch():query.refetch())}>Reintentar</Button></div>:!query.data?.items.length?<p className="text-muted-foreground">No hay cambios registrados en esta selección.</p>:<ol className="divide-y">{query.data.items.map((item:SettingHistoryItem)=><li key={item.id} className="py-4 space-y-2"><div className="flex flex-wrap justify-between gap-2"><strong>{names[item.key]||item.key.replace(/_/g,' ')}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('es-GT')}</time></div><p className="text-xs text-muted-foreground">Revisión {item.revision} · {item.actor_name||(item.actor_id?'Usuario no disponible':'Sistema / autor no disponible')} · {item.source}</p><div className="grid gap-3 sm:grid-cols-2 text-sm"><div><span className="text-muted-foreground">Antes</span><p className="whitespace-pre-wrap break-all max-h-40 overflow-auto">{value(item.before_value)}</p></div><div><span className="text-muted-foreground">Después</span><p className="whitespace-pre-wrap break-all max-h-40 overflow-auto">{value(item.after_value)}</p></div></div></li>)}</ol>}
    {query.data&&<Pagination currentPage={page} totalPages={query.data.totalPages} totalItems={query.data.totalItems} count={query.data.items.length} pageSize={10} onPageChange={setPage} loading={query.isFetching} itemLabel="cambios"/>}
  </CardContent></Card>
}
