import type { SystemSettings } from '@/services/settingsService'
import type { EditableSection, FieldErrors, SectionValues } from '../settingsModel'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type SectionEditorProps = { section: EditableSection; values: SectionValues; disabled: boolean; errors: FieldErrors; onField: (key: keyof SystemSettings, value: unknown) => void }
type FieldProps = SectionEditorProps & { field: keyof SystemSettings; label: string; help?: string }
export function FieldError({ field, errors }: Pick<FieldProps, 'field' | 'errors'>) {
  return errors[field] ? <p className="text-sm text-destructive" id={`${field}-error`}>{errors[field]}</p> : null
}
export function SettingsInput({ field, label, help, values, disabled, onField, errors, type = 'text', min, step, maxLength }: FieldProps & { type?: string; min?: number; step?: string; maxLength?: number }) {
  return <div className="grid gap-2"><Label htmlFor={field}>{label}</Label><Input id={field} value={String(values[field] ?? '')} disabled={disabled} type={type} min={min} step={step} maxLength={maxLength}
    aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : help ? `${field}-help` : undefined} onChange={e => onField(field, e.target.value)} />
    {help && <p id={`${field}-help`} className="text-xs text-muted-foreground">{help}</p>}<FieldError field={field} errors={errors} /></div>
}
export function SettingsSelect({ field, label, help, values, disabled, onField, errors, options }: FieldProps & { options: readonly { value: string; label: string }[] }) {
  const value = String(values[field] ?? ''), known = options.some(o => o.value === value)
  return <div className="grid gap-2"><Label htmlFor={field}>{label}</Label><Select value={value || '__none__'} disabled={disabled} onValueChange={v => onField(field, v === '__none__' ? '' : v)}>
    <SelectTrigger id={field} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined}><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="__none__">Selecciona una opción</SelectItem>{value && !known && <SelectItem value={value}>{value} · valor actual no reconocido</SelectItem>}{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
  </Select>{help && <p className="text-xs text-muted-foreground">{help}</p>}<FieldError field={field} errors={errors} /></div>
}
export function SettingsSwitch({ field, label, help, values, disabled, onField, errors }: FieldProps) {
  return <div className="config-toggle-row"><div className="space-y-1"><Label htmlFor={field}>{label}</Label>{help && <p id={`${field}-help`} className="text-xs text-muted-foreground">{help}</p>}<FieldError field={field} errors={errors} /></div>
    <Switch id={field} checked={String(values[field]).toLowerCase() === 'true'} disabled={disabled} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : help ? `${field}-help` : undefined} onCheckedChange={checked => onField(field, String(checked))} /></div>
}
