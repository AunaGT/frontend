import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ServiceQuantityFields({unit,decimals,onUnitChange,onDecimalsChange,disabled=false}: {
  unit:string; decimals:string; onUnitChange:(value:string)=>void; onDecimalsChange:(value:string)=>void; disabled?:boolean
}) {
  return <>
    <div className="space-y-1.5">
      <Label htmlFor="service-unit">Unidad de cobro *</Label>
      <Input id="service-unit" value={unit} onChange={event=>onUnitChange(event.target.value)} maxLength={50} list="service-unit-suggestions" disabled={disabled} />
      <datalist id="service-unit-suggestions">{['Hora','Sesión','Trabajo','Mes'].map(value=><option key={value} value={value} />)}</datalist>
      <p className="text-xs text-muted-foreground">Usa una sugerencia o escribe tu propia unidad.</p>
    </div>
    <div className="space-y-1.5">
      <Label id="service-decimals-label">Decimales de cantidad *</Label>
      <Select value={decimals} onValueChange={onDecimalsChange} disabled={disabled}>
        <SelectTrigger aria-labelledby="service-decimals-label"><SelectValue /></SelectTrigger>
        <SelectContent>{[0,1,2,3,4].map(value=><SelectItem key={value} value={String(value)}>{value === 0 ? 'Solo enteros' : `${value} decimal${value>1?'es':''}`}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{decimals==='0' ? 'Ejemplo: 1 o 2 unidades de cobro.' : `Ejemplo: ${Number(10 ** -Number(decimals)).toFixed(Number(decimals))} ${unit || 'unidades de cobro'}.`} No crea agenda ni suscripciones.</p>
    </div>
  </>
}
