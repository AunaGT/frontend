import type {PrintRoute} from './types'
export function PrintDestination({route,value,onChange,disabled=false}:{route:PrintRoute|null;value:string|null;onChange:(value:string|null)=>void;disabled?:boolean}){
 return <label className="grid max-w-sm gap-1 text-sm">Destino previsto<select className="auna-control auna-control-select" value={value||''} disabled={disabled} onChange={e=>onChange(e.target.value||null)}><option value="">PDF sin equipo</option>{route?.destination&&<option value={route.destination.id}>{route.destination.name}</option>}</select><span className="text-xs text-muted-foreground">El navegador no confirma impresión física. Usa tamaño real, sin ajustar.</span></label>
}
