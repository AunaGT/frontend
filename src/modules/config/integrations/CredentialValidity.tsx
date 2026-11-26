import {useState} from 'react'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'

const periods=[7,30,60,90,180,365]
export function CredentialValidity({days,onChange,disabled}:{days:number|null;onChange:(days:number|null)=>void;disabled:boolean}){
 const [custom,setCustom]=useState(days!==null&&!periods.includes(days))
 const value=days===null?'never':custom?'custom':String(days)
 return <div className="integration-validity-field">
  <Label htmlFor="integration-validity">Vigencia</Label>
  <Select value={value} disabled={disabled} onValueChange={next=>{
   if(disabled)return
   setCustom(next==='custom')
   onChange(next==='never'?null:next==='custom'?(days??90):Number(next))
  }}>
   <SelectTrigger id="integration-validity" aria-describedby="integration-validity-help"><SelectValue>{days===null?'Sin vencimiento':custom?'Plazo personalizado':`${days} días${days===90?' · recomendado':''}`}</SelectValue></SelectTrigger>
   <SelectContent>{periods.map(n=><SelectItem key={n} value={String(n)}>{n} días{n===90?' · recomendado':''}</SelectItem>)}<SelectItem value="custom">Plazo personalizado</SelectItem><SelectItem value="never">Sin vencimiento</SelectItem></SelectContent>
  </Select>
  {custom&&days!==null&&<div className="integration-custom-days"><Label htmlFor="integration-custom-days">Cantidad de días</Label><Input id="integration-custom-days" type="number" inputMode="numeric" min={1} max={365} step={1} required disabled={disabled} value={Number.isNaN(days)?'':days} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))} aria-describedby="integration-validity-help"/></div>}
  <p id="integration-validity-help" className="auna-field-message">{days===null?'Seguirá activa hasta que la revoques o el responsable pierda acceso. Conserva los mismos permisos y límites de uso.':'90 días por defecto. Puedes revocarla antes; no se renueva automáticamente.'}</p>
 </div>
}
