import {useState} from 'react'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {localDateTime} from '../viewModel'
export function ActivityDateTime({value,zone,date,onChange,label,id,disabled,required=true}: {value:string;zone:string;date?:string;onChange:(v:string)=>void;label:string;id:string;disabled:boolean;required?:boolean}) {
  const local=localDateTime(value,zone),[day,setDay]=useState(local.split('T')[0]||date||''),clock=local.split('T')[1]?.slice(0,5)||''
  const selected=local.split('T')[0]||day
  return <div className="min-w-0"><Label htmlFor={id}>{label}</Label><div className="flex flex-wrap gap-2"><Input id={id} type="date" className="min-w-[9rem] flex-[1.4_1_9rem]" required={required} value={selected} disabled={disabled} onChange={e=>{setDay(e.target.value);onChange(`${e.target.value}T${clock}`)}}/><Input type="time" className="min-w-[6.5rem] flex-[1_1_6.5rem]" required={required} aria-label={`${label} hora`} value={clock} disabled={disabled} step={60} onChange={e=>onChange(`${selected}T${e.target.value}`)}/></div></div>
}
