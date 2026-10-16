import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {expiryDraft,type ExpiryPolicyFieldPath} from '../expiryPolicyModel'
import type {SectionEditorProps} from './SettingsFields'
const key='inventory.expiry_alert_policy'
export function ExpiryPolicySettingsSection({values,errors,disabled,onField}:SectionEditorProps){
  const policy=expiryDraft(values[key])
  return <section className="space-y-4 border-t pt-5" aria-labelledby="expiry-policy-heading"><div><h3 id="expiry-policy-heading" className="font-semibold">Avisos de vencimiento</h3><p className="text-sm text-muted-foreground">Una sola política para Inventario y Alertas de esta empresa.</p></div><div className="config-fields-grid">{([{field:'warningDays',label:'Avisar con anticipación (días)',min:1,max:3650,help:'Los lotes con existencias se incluyen desde esta cantidad de días antes de vencer.'},{field:'highPriorityDays',label:'Prioridad alta desde (días)',min:0,max:3650,help:'Debe ser igual o menor que la anticipación. Con 0, la prioridad alta comienza el día del vencimiento.'}] as const).map(({field,label,min,max,help})=>{
    const id:ExpiryPolicyFieldPath=`${key}.${field}`,error=errors[id]
    return <div key={field} className="grid gap-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={min} max={max} step={1} value={String(policy[field]??'')} disabled={disabled} aria-invalid={!!error} aria-describedby={`${id}-${error?'error':'help'}`} onChange={event=>onField(key,{...policy,[field]:event.target.value})}/><p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>{error&&<p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}</div>
  })}</div><p className="config-note">Los lotes ya vencidos mantienen prioridad crítica. Se conservan los días UTC del sistema; no cambia existencias ni genera alertas de lotes para servicios. Después de guardar se actualizan los avisos.</p></section>
}
