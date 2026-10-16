import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import type { FieldErrors } from '../settingsModel'
export function SettingsErrorSummary({ errors, error }: { errors: FieldErrors; error?: string | null }) {
  const entries = Object.entries(errors).filter(([, value]) => value)
  if (!entries.length && !error) return null
  return <div id="config-errors" tabIndex={-1} role="alert" className="config-error-summary"><p className="font-semibold">Revisa los cambios</p>{error && <p>{error}</p>}{entries.length > 0 && <ul>{entries.map(([field, value]) => <li key={field}><a href={`#${field}`}>{value}</a></li>)}</ul>}</div>
}
export function SettingsSectionActions({ dirty, pending, canManage, onSave, onReset }: { dirty: boolean; pending: boolean; canManage: boolean; onSave: () => void; onReset: () => void }) {
  return <div className="config-section-actions"><p className="text-xs text-muted-foreground" aria-live="polite">{pending ? 'Guardando…' : dirty ? 'Hay cambios sin guardar en esta sección.' : 'Sin cambios pendientes en esta sección.'}</p>{canManage && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!dirty || pending} onClick={onReset}>Restablecer</Button><Button type="button" disabled={!dirty || pending} onClick={onSave}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}Guardar cambios</Button></div>}</div>
}
