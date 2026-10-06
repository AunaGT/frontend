import { useState } from 'react'
import { BriefcaseBusiness, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PAYMENT_METHOD_LABELS, type EmployeePayload } from '@/services/hrService'
import { EmployeeSupervisorSelect } from './EmployeeSupervisorSelect'

export function EmployeeForm({ value, onChange, disabled, className = 'space-y-4' }: { value: EmployeePayload; onChange: (value: EmployeePayload) => void; disabled: boolean; className?: string }) {
  const [igssEnabled, setIgssEnabled] = useState(!!value.igss_number)
  const field = (key: keyof EmployeePayload, title: string, type = 'text', required = false, span = '') => <div className={span} key={key}><Label htmlFor={`hr-${key}`}>{title}{required && <span className="text-brand-orange"> *</span>}</Label><Input id={`hr-${key}`} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '.01' : undefined} required={required} disabled={disabled} value={String(value[key] ?? '')} onChange={e => onChange({ ...value, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} /></div>
  const select = (key: keyof EmployeePayload, title: string, options: Record<string, string>, fallback: string) => <div><Label htmlFor={`hr-${key}`}>{title}</Label><select id={`hr-${key}`} className="auna-control auna-control-select hr-native-select" disabled={disabled} value={String(value[key] ?? fallback)} onChange={e => onChange({ ...value, [key]: e.target.value })}>{Object.entries(options).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
  return <div className={className}><Card className="hr-panel"><CardHeader><CardTitle><UserRound />Datos personales</CardTitle></CardHeader><CardContent className="hr-fields-grid">
    {field('first_name', 'Nombre(s)', 'text', true)}{field('last_name', 'Apellidos', 'text', true)}{field('dpi', 'DPI')}
    {field('birth_date', 'Fecha de nacimiento', 'date')}{field('nit', 'NIT')}{field('phone', 'Teléfono', 'tel')}
    {field('gender', 'Género (opcional)')}{field('marital_status', 'Estado civil (opcional)')}{field('nationality', 'Nacionalidad (opcional)')}
    {field('email', 'Correo electrónico', 'email', false, 'sm:col-span-2')}
    <div><Label htmlFor="hr-igss-enabled" className="flex items-center gap-2"><Checkbox id="hr-igss-enabled" disabled={disabled} checked={igssEnabled} onCheckedChange={checked => { setIgssEnabled(checked === true); if (!checked) onChange({ ...value, igss_number: '' }) }} />Afiliado al IGSS</Label>{igssEnabled ? <Input aria-label="Número de IGSS" disabled={disabled} required value={value.igss_number || ''} onChange={e => onChange({ ...value, igss_number: e.target.value })} /> : <p className="text-xs text-muted-foreground mt-2">Sin retención de cuota IGSS.</p>}</div>
    {field('address', 'Dirección', 'text', false, 'sm:col-span-2 xl:col-span-3')}
  </CardContent></Card><Card className="hr-panel"><CardHeader><CardTitle><BriefcaseBusiness />Puesto y condiciones</CardTitle></CardHeader><CardContent className="hr-fields-grid">
    {field('position', 'Puesto')}{field('department', 'Departamento')}{select('contract_type', 'Tipo de contrato', { INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo fijo', POR_OBRA: 'Por obra' }, 'INDEFINIDO')}
    {field('base_salary', 'Salario mensual base', 'number', true)}{field('hire_date', 'Fecha de ingreso', 'date', true)}{field('bonificacion_incentivo', 'Bonificación incentivo', 'number')}
    {select('pay_frequency', 'Frecuencia de pago', { MENSUAL: 'Mensual', QUINCENAL: 'Quincenal' }, 'MENSUAL')}{select('payment_method', 'Forma de pago', PAYMENT_METHOD_LABELS, 'EFECTIVO')}
    {field('workday', 'Jornada (opcional)')}{field('work_schedule', 'Horario (opcional)', 'text', false, 'sm:col-span-2')}
    <EmployeeSupervisorSelect value={value.supervisor_id} onChange={supervisor_id => onChange({ ...value, supervisor_id })} disabled={disabled} />
    {value.payment_method === 'TRANSFERENCIA' && <>{field('bank_name', 'Banco')}{field('bank_account', 'Cuenta bancaria')}</>}
  </CardContent></Card></div>
}
