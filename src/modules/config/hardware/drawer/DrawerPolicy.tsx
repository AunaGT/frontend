import {useEffect,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {authSessionIdentity} from '@/services/authSession'
import {printRequest} from '../printing/api'
import type {HardwareScope} from '../types'
type Policy={version:number;posCashSale:boolean;initialCreditReceipt:boolean;receivableReceipt:boolean;agendaReceipt:boolean;cashReturn:boolean}
const labels={posCashSale:'Ventas POS en efectivo',initialCreditReceipt:'Abono inicial al crédito',receivableReceipt:'Cobros de Cartera',agendaReceipt:'Anticipos de Agenda',cashReturn:'Reintegros por devoluciones'}
export function DrawerPolicyFields({value,onChange,disabled}:{value:Policy;onChange:(value:Policy)=>void;disabled:boolean}){
 return <fieldset disabled={disabled} className="space-y-3"><legend className="mb-2 text-sm font-semibold">Solo simulación</legend><p className="max-w-2xl text-sm text-muted-foreground">Esta política no envía pulsos ni abre equipos. Solo autoriza una prueba breve después de guardar efectivo real, con turno y ruta válidos. No se aplica a pagos antiguos.</p>{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={value[key]} disabled={disabled} onCheckedChange={checked=>onChange({...value,[key]:checked===true})}/>{labels[key]}</label>)}</fieldset>
}
export function DrawerPolicy({scope,canManage,onDirty}:{scope:HardwareScope;canManage:boolean;onDirty?:(dirty:boolean)=>void}){
 const [value,setValue]=useState<Policy|null>(null),[saved,setSaved]=useState<Policy|null>(null),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[reload,setReload]=useState(0)
 const session=authSessionIdentity(),key=JSON.stringify([scope,canManage,session]),live=useRef(key);live.current=key
 useEffect(()=>{const abort=new AbortController();setValue(null);setSaved(null);setMessage('');setPending(false);void printRequest<Policy>(scope,'/drawer-policy',{signal:abort.signal}).then(p=>{if(!abort.signal.aborted&&live.current===key){setValue(p);setSaved(p)}}).catch(e=>{if(!abort.signal.aborted&&live.current===key)setMessage(e.message)});return()=>abort.abort()},[key,reload])
 const save=async()=>{
  if(!value||pending||!canManage)return
  setPending(true);setMessage('')
  const {version,...policy}=value
  try{const result=await printRequest<Policy>(scope,'/drawer-policy',{method:'PUT',body:JSON.stringify({...policy,expectedVersion:version})});if(live.current===key&&authSessionIdentity()===session){setValue(result);setSaved(result);setMessage('Política de simulación guardada.');onDirty?.(false)}}catch(e){if(live.current===key)setMessage(e instanceof Error?e.message:'No se pudo guardar')}finally{if(live.current===key)setPending(false)}
 }
 return <section className="space-y-4">{value&&<DrawerPolicyFields value={value} disabled={!canManage||pending} onChange={next=>{setValue(next);onDirty?.(JSON.stringify(next)!==JSON.stringify(saved))}}/>}{message&&<p role="status" className="text-sm">{message}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={()=>{onDirty?.(false);setReload(n=>n+1)}}>Actualizar política</Button><Button disabled={!canManage||pending||!value||JSON.stringify(value)===JSON.stringify(saved)} onClick={()=>void save()}>{pending?'Guardando…':'Guardar política'}</Button></div></section>
}
