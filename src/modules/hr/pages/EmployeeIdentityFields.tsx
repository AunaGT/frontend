import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EmployeePayload } from '@/services/hrService'

/** Datos del expediente que comparten el alta y la edición. */
export function EmployeeIdentityFields({ value, onChange, identityOnly = false }: { value: EmployeePayload; onChange: (value: EmployeePayload) => void; identityOnly?: boolean }) {
  return <>
    <div><Label>Tipo de contrato</Label><Select value={value.contract_type ?? 'INDEFINIDO'} onValueChange={contract => onChange({ ...value, contract_type: contract as EmployeePayload['contract_type'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INDEFINIDO">Indefinido</SelectItem><SelectItem value="PLAZO_FIJO">Plazo fijo</SelectItem><SelectItem value="POR_OBRA">Por obra</SelectItem></SelectContent></Select></div>
    {([{ key: 'nit', label: 'NIT', type: 'text' }, { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date' }, { key: 'email', label: 'Correo electrónico', type: 'email' }, { key: 'address', label: 'Dirección', type: 'text' }] as const).filter(field => !identityOnly || field.key !== 'email').map(field => <div key={field.key}><Label htmlFor={`employee-${field.key}`}>{field.label}</Label><Input id={`employee-${field.key}`} type={field.type} value={value[field.key] ?? ''} onChange={e => onChange({ ...value, [field.key]: e.target.value })} /></div>)}
  </>
}
