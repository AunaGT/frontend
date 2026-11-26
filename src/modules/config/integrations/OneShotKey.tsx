import {useState} from 'react'
import {Copy,EyeOff,KeyRound} from 'lucide-react'
import {Button} from '@/components/ui/button'
export function OneShotKey({value,onHide}:{value:string;onHide:()=>void}){
 const [message,setMessage]=useState('')
 return <section className="integration-secret" aria-labelledby="integration-secret-title"><KeyRound aria-hidden="true"/><h2 id="integration-secret-title">Guarda tu clave: se muestra una sola vez</h2><p>Al salir no podrás recuperarla. Guárdala en el servidor de tu aplicación, nunca en código público, enlaces o capturas.</p><pre aria-label="Clave API recién creada">{value}</pre><div className="integration-actions"><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(value);setMessage('Clave copiada. Guárdala en un lugar seguro.')}catch{setMessage('No se pudo copiar. Selecciona la clave para copiarla manualmente.')}}}><Copy size={16} aria-hidden="true"/>Copiar clave</Button><Button variant="ghost" aria-label="Ocultar clave" onClick={onHide}><EyeOff size={16} aria-hidden="true"/>Ya la guardé · ocultar</Button></div><p role="status">{message}</p></section>
}
