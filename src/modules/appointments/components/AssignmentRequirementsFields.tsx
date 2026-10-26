import {Plus,Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {AssignmentChoices} from './AssignmentChoices'
import type {AssignmentRequirement,Directory} from '../types'
type Options=Pick<Directory,'providers'|'resources'>
export function AssignmentRequirementsFields({value=[],onChange,directory,providerIds,resourceIds,disabled,errors={}}:{value?:AssignmentRequirement[];onChange:(v:AssignmentRequirement[])=>void;directory:Options;providerIds:string[];resourceIds:string[];disabled:boolean;errors?:Record<string,string>}){
 const set=(id:string,patch:Partial<AssignmentRequirement>)=>onChange(value.map(r=>r.id===id?{...r,...patch}:r))
 const messages=Object.entries(errors).filter(([key])=>key.startsWith('assignmentRequirements'))
 return <details className="max-w-3xl rounded-lg border p-3" open={value.length>0||messages.length>0}><summary className="cursor-pointer py-1 text-sm font-medium">Requisitos específicos{value.length?` · ${value.length}`:' · opcional'}</summary><div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">Define cuántas personas o equipos distintos necesita cada programación. El nombre y la cantidad aparecen en nuevas cotizaciones; no uses nombres de personas ni información privada.</p>
 {value.map((r,index)=>{
  const allowed=r.kind==='PROVIDER'?providerIds:resourceIds,items=(r.kind==='PROVIDER'?directory.providers:directory.resources).filter(p=>p.active&&allowed.includes(p.id)),invalid=r.optionIds.some(id=>!items.some(p=>p.id===id))
  const prefix=`requirement-${r.id}`
  return <fieldset key={r.id} className="min-w-0 rounded-md border p-3 space-y-3" disabled={disabled}><legend className="px-1 text-xs text-muted-foreground">Requisito {index+1}</legend><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_5rem_auto]"><div className="min-w-0"><Label htmlFor={`${prefix}-name`}>Nombre *</Label><Input id={`${prefix}-name`} value={r.name} maxLength={100} onChange={e=>set(r.id,{name:e.target.value})} disabled={disabled}/></div><div><Label id={`${prefix}-kind`}>Tipo</Label><Select value={r.kind} onValueChange={kind=>set(r.id,{kind:kind as AssignmentRequirement['kind'],optionIds:[]})} disabled={disabled}><SelectTrigger aria-labelledby={`${prefix}-kind`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="PROVIDER">Personal</SelectItem><SelectItem value="RESOURCE">Equipo o sala</SelectItem></SelectContent></Select></div><div><Label htmlFor={`${prefix}-quantity`}>Cantidad *</Label><Input id={`${prefix}-quantity`} type="number" min={1} max={20} value={r.quantity} onChange={e=>set(r.id,{quantity:Number(e.target.value)})} disabled={disabled}/></div><Button type="button" variant="ghost" size="icon" className="self-end" disabled={disabled} aria-label={`Quitar requisito ${r.name||index+1}`} onClick={()=>onChange(value.filter(item=>item.id!==r.id))}><Trash2 className="h-4 w-4" aria-hidden/></Button></div>
  <AssignmentChoices label="Opciones habilitadas para este requisito *" items={items} value={r.optionIds} onChange={optionIds=>set(r.id,{optionIds})} disabled={disabled}/>
  {invalid&&<div role="alert" className="text-sm text-destructive"><p>Hay opciones no habilitadas. Revisa las asignaciones del servicio.</p><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={()=>set(r.id,{optionIds:r.optionIds.filter(id=>items.some(p=>p.id===id))})}>Quitar opciones no habilitadas</Button></div>}
 </fieldset>})}
 {messages.map(([key,message])=><p key={key} role="alert" className="text-sm text-destructive">{message}</p>)}
 <Button type="button" size="sm" variant="outline" disabled={disabled||value.length>=20} onClick={()=>onChange([...value,{id:crypto.randomUUID(),kind:'RESOURCE',name:'',quantity:1,optionIds:[]}])}><Plus className="mr-2 h-4 w-4" aria-hidden/>Agregar requisito</Button></div></details>
}
function counts(requirements:AssignmentRequirement[],selected:Map<string,string>){
 const seats=requirements.flatMap(r=>Array.from({length:r.quantity},()=>r)),owner=new Map<string,number>(),matched=new Map<number,string>()
 function assign(index:number,seen:Set<string>):boolean{
  for(const id of seats[index].optionIds){const identity=selected.get(`${seats[index].kind}:${id}`);if(!identity||seen.has(identity))continue;seen.add(identity)
   const before=owner.get(identity);if(before===undefined||assign(before,seen)){owner.set(identity,index);matched.set(index,id);return true}}
  return false
 }
 seats.forEach((_,index)=>assign(index,new Set()))
 return requirements.map(r=>seats.reduce((sum,seat,index)=>sum+Number(seat.id===r.id&&matched.has(index)),0))
}
export function AssignmentRequirementsStatus({requirements=[],providerIds,resourceIds,directory}:{requirements?:AssignmentRequirement[];providerIds:string[];resourceIds:string[];directory:Options}){
 if(!requirements.length)return null
 const selected=new Map<string,string>()
 directory.providers.filter(p=>p.active&&providerIds.includes(p.id)).forEach(p=>selected.set(`PROVIDER:${p.id}`,`person:${p.userId||p.employeeId||p.id}`))
 directory.resources.filter(r=>r.active&&resourceIds.includes(r.id)).forEach(r=>selected.set(`RESOURCE:${r.id}`,`resource:${r.id}`))
 const progress=counts(requirements,selected)
 return <section className="rounded-lg border p-3 text-sm space-y-2" aria-label="Requisitos de esta programación"><h3 className="font-medium">Personal y equipo necesarios</h3><ul className="space-y-1" aria-live="polite" aria-atomic="true">{requirements.map((r,index)=><li key={r.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="min-w-0 break-words">{r.name}</span><span className="tabular-nums text-muted-foreground">{progress[index]} de {r.quantity} seleccionados</span></li>)}</ul><p className="text-xs text-muted-foreground">Cada persona o equipo cuenta una sola vez. La identidad, el horario y la disponibilidad se validarán al guardar.</p></section>
}
