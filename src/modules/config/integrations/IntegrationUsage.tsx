import {useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {getUsage,integrationError} from './api'
import {useIntegrationDate} from './useIntegrationDate'
import type {IntegrationScope,UsagePeriod,UsageSummary} from './types'

export function IntegrationUsage({scope,credentialId,refreshKey=0}:{scope:IntegrationScope;credentialId?:string;refreshKey?:number}){
 const [period,setPeriod]=useState<UsagePeriod>('7d'),[summary,setSummary]=useState<UsageSummary|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0)
 const date=useIntegrationDate(),{locale}=useSystemSettings(),id=credentialId?'key-usage-period':'company-usage-period'
 useEffect(()=>{const abort=new AbortController();setSummary(null);setError('');void getUsage(scope,period,credentialId,abort.signal).then(value=>{if(!abort.signal.aborted)setSummary(value)}).catch(e=>{if(!abort.signal.aborted)setError(integrationError(e))});return()=>abort.abort()},[scope,period,credentialId,refreshKey,reload])
 return <section className="integration-card integration-usage" aria-label={credentialId?'Uso de esta clave':'Uso de la empresa'}><header><h2>{credentialId?'Uso de esta clave':'Uso de la empresa'}</h2><div className="integration-usage-period"><Label className="sr-only" htmlFor={id}>Período de uso</Label><Select value={period} onValueChange={value=>setPeriod(value as UsagePeriod)}><SelectTrigger id={id}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="24h">Últimas 24 horas</SelectItem><SelectItem value="7d">Últimos 7 días</SelectItem><SelectItem value="30d">Últimos 30 días</SelectItem></SelectContent></Select></div></header>
 {error?<p role="alert">{error} <Button variant="outline" onClick={()=>setReload(n=>n+1)}>Recargar uso</Button></p>:!summary?<p role="status">Cargando uso…</p>:<><dl className="integration-usage-totals"><div><dt>Solicitudes</dt><dd>{summary.total.toLocaleString(locale)}</dd></div><div><dt>Satisfactorias</dt><dd>{summary.successful.toLocaleString(locale)}</dd></div><div><dt>Errores</dt><dd>{summary.errors.toLocaleString(locale)}</dd></div><div><dt>Tasa de error</dt><dd>{summary.errorRate===null?'Sin actividad':new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(summary.errorRate)}</dd></div></dl><details><summary>Ver detalle de uso</summary><p className="integration-help">{date(summary.from)} — {date(summary.to)}. Solo solicitudes autenticadas registradas; no incluye intentos rechazados antes de autenticar. Uso retenido: 30 días.</p>{!summary.total?<p>Sin actividad registrada en este período.</p>:<div className="integration-usage-breakdown"><ul aria-label="Resultados HTTP">{summary.byStatus.map(item=><li key={item.family}>{item.family}: {item.count.toLocaleString(locale)}</li>)}</ul><ul aria-label="Rutas consultadas">{summary.byRoute.map(item=><li key={item.route}><code>{item.route}</code>: {item.count.toLocaleString(locale)}</li>)}</ul></div>}</details></>}
 </section>
}
