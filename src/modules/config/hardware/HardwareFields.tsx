import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { stateLabels } from './model'
import type { HardwareConfigState } from './types'
export function HardwareField({ id, label, error, children, hint }: { id: string; label: string; error?: string; children: ReactNode; hint?: string }) {
  return <div className="grid min-w-0 gap-1.5"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}{error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}</div>
}
export function HardwareInput({ id, label, value, onChange, disabled, error, maxLength = 120 }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean; error?: string; maxLength?: number }) {
  return <HardwareField id={id} label={label} error={error}><Input id={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} maxLength={maxLength} required aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /></HardwareField>
}
export function HardwareState({ value, onChange, disabled }: { value: HardwareConfigState; onChange: (v: HardwareConfigState) => void; disabled: boolean }) {
  return <HardwareField id="hardware-state" label="Estado de configuración" hint="Habilitado no significa conectado ni probado físicamente."><select id="hardware-state" className="auna-control auna-control-select w-full" value={value} disabled={disabled} onChange={e => onChange(e.target.value as HardwareConfigState)}>{Object.entries(stateLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></HardwareField>
}
export function HardwareErrors({ fields, error }: { fields: Record<string,string>; error?: string }) {
  if (!error && !Object.keys(fields).length) return null
  return <div role="alert" tabIndex={-1} className="config-error-summary"><p>{error || 'Revisa estos datos antes de guardar.'}</p>{Object.entries(fields).map(([field, message]) => <p key={field}><a href={`#hardware-${field}`}>{message}</a></p>)}</div>
}
