import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export function ServiceQuantityFields({unit,decimals,onUnitChange,onDecimalsChange,disabled=false}: {
  unit:string; decimals:string; onUnitChange:(value:string)=>void; onDecimalsChange:(value:string)=>void; disabled?:boolean
}) {
  return <>
    <div className="space-y-1.5">
      <Label htmlFor="service-unit">¿Cómo cobras? · Unidad de cobro *</Label>
      <Input id="service-unit" value={unit} onChange={event=>onUnitChange(event.target.value)} maxLength={50} list="service-unit-suggestions" disabled={disabled} />
      <datalist id="service-unit-suggestions">{['Hora','Sesión','Trabajo','Mes'].map(value=><option key={value} value={value} />)}</datalist>
      <p className="text-xs text-muted-foreground">Por sesión, hora o trabajo. También puedes escribir tu propia unidad.</p>
    </div>
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3"><Label htmlFor="service-fractions">Permitir fracciones</Label><Switch id="service-fractions" checked={decimals !== '0'} onCheckedChange={enabled => onDecimalsChange(enabled ? '2' : '0')} disabled={disabled} /></div>
      <p className="text-xs text-muted-foreground">Ejemplo: {decimals === '0' ? `2 ${unit || 'sesiones'}` : `1.5 ${unit || 'horas'}`}. La duración de la cita se define por separado.</p>
      <details><summary className="cursor-pointer text-sm text-muted-foreground">Precisión avanzada</summary><Label id="service-decimals-label">Decimales de cantidad</Label>
      <Select value={decimals} onValueChange={onDecimalsChange} disabled={disabled}>
        <SelectTrigger aria-labelledby="service-decimals-label"><SelectValue /></SelectTrigger>
        <SelectContent>{[0,1,2,3,4].map(value=><SelectItem key={value} value={String(value)}>{value === 0 ? 'Solo enteros' : `${value} decimal${value>1?'es':''}`}</SelectItem>)}</SelectContent>
      </Select>
      </details>
    </div>
  </>
}
