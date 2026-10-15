import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import type {CompletionPolicy} from '../types'
export function CompletionPolicyField({value,onChange,disabled=false,id}:{value:CompletionPolicy;onChange:(v:CompletionPolicy)=>void;disabled?:boolean;id:string}){
  return <div className="space-y-2"><Label id={`${id}-label`}>Cierre de horario</Label><Select value={value} disabled={disabled} onValueChange={v=>onChange(v as CompletionPolicy)}><SelectTrigger aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}><SelectValue>{value==='AUTO'?'Automático · solo después de iniciar':'Manual · el responsable finaliza'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="MANUAL">Manual · el responsable finaliza</SelectItem><SelectItem value="AUTO">Automático · solo después de iniciar</SelectItem></SelectContent></Select><p id={`${id}-help`} className="text-xs text-muted-foreground">El cierre automático solo finaliza el horario de una actividad iniciada. No confirma prestación comercial, pagos, asistencia ni entregas. El tiempo de regreso sigue ocupado.</p></div>
}
