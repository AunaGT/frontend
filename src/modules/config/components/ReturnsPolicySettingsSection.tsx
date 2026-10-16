import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RETURN_RESOLUTION_LABELS, type ReturnPolicy, type ReturnResolution } from '@/modules/returns/policy'
import { policyDraft, type ReturnPolicyFieldPath } from '../returnPolicyModel'
import type { SectionEditorProps } from './SettingsFields'

export function ReturnsPolicySettingsSection({ values, onField, disabled, errors }: SectionEditorProps) {
  const policy = policyDraft(values['returns.policy'])
  const set = (key: keyof ReturnPolicy, value: unknown) => onField('returns.policy', { ...policy, [key]: value })
  const id = (key: keyof ReturnPolicy): ReturnPolicyFieldPath => `returns.policy.${key}`
  const describedBy = (key: keyof ReturnPolicy) => errors[id(key)] ? `${id(key)}-error` : `${id(key)}-help`
  const error = (key: keyof ReturnPolicy) => errors[id(key)] ? <p className="text-sm text-destructive" id={`${id(key)}-error`}>{errors[id(key)]}</p> : null
  const selected = Array.isArray(policy.enabledResolutions) ? policy.enabledResolutions : []
  const pricing = typeof policy.exchangePricing === 'string' ? policy.exchangePricing : ''
  return <div className="space-y-5">
    <div className="config-fields-grid">
      <div className="grid gap-2"><Label htmlFor={id('windowDays')}>Plazo para solicitar una devolución (días)</Label>
        <Input id={id('windowDays')} type="number" min={1} step="1" value={String(policy.windowDays ?? '')} disabled={disabled} aria-invalid={!!errors[id('windowDays')]} aria-describedby={describedBy('windowDays')} onChange={e => set('windowDays', e.target.value)} />
        <p id={`${id('windowDays')}-help`} className="text-xs text-muted-foreground">Se cuenta hasta la fecha de solicitud, en períodos completos de 24 horas. Con 30 días, vence al completar el período 31; no al llegar la medianoche.</p>{error('windowDays')}</div>
      <div className="grid gap-2"><Label htmlFor={id('exchangePricing')}>Precio de los productos de reemplazo</Label>
        <Select value={pricing || '__none__'} disabled={disabled} onValueChange={value => set('exchangePricing', value === '__none__' ? '' : value)}><SelectTrigger id={id('exchangePricing')} aria-invalid={!!errors[id('exchangePricing')]} aria-describedby={describedBy('exchangePricing')}><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="__none__">Selecciona el precio para cambios</SelectItem>
          {pricing && !['CURRENT_PRICE', 'ORIGINAL_SALE_PRICE'].includes(pricing) && <SelectItem value={pricing}>{pricing} · valor actual no reconocido</SelectItem>}
          <SelectItem value="CURRENT_PRICE">Precio actual del producto</SelectItem><SelectItem value="ORIGINAL_SALE_PRICE">Precio original de la venta</SelectItem>
        </SelectContent></Select><p id={`${id('exchangePricing')}-help`} className="text-xs text-muted-foreground">El precio original aplica al mismo producto de la venta. Otros productos utilizan su precio vigente.</p>{error('exchangePricing')}</div>
    </div>
    <div className="config-toggle-row"><div className="space-y-1"><Label htmlFor={id('allowAuthorizedExceptions')}>Permitir excepciones fuera del plazo</Label>
      <p id={`${id('allowAuthorizedExceptions')}-help`} className="text-xs text-muted-foreground">Requiere un administrador o el permiso para autorizar devoluciones fuera de plazo, además de una justificación. Esta opción no concede ese permiso.</p>{error('allowAuthorizedExceptions')}</div>
      <Switch id={id('allowAuthorizedExceptions')} checked={policy.allowAuthorizedExceptions === true} disabled={disabled} aria-invalid={!!errors[id('allowAuthorizedExceptions')]} aria-describedby={describedBy('allowAuthorizedExceptions')} onCheckedChange={value => set('allowAuthorizedExceptions', value)} /></div>
    <fieldset id={id('enabledResolutions')} tabIndex={-1} disabled={disabled} aria-invalid={!!errors[id('enabledResolutions')]} aria-describedby={describedBy('enabledResolutions')} className="space-y-3">
      <legend className="text-sm font-medium">Resoluciones permitidas</legend><p id={`${id('enabledResolutions')}-help`} className="text-xs text-muted-foreground">Selecciona al menos una. Cada operación seguirá validando cliente, medios de pago, caja, fondos y disponibilidad.</p>
      <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(RETURN_RESOLUTION_LABELS) as ReturnResolution[]).map(value => <div key={value} className="flex items-center gap-2"><Checkbox id={`returns.policy.resolution.${value}`} checked={selected.includes(value)} disabled={disabled} onCheckedChange={checked => set('enabledResolutions', checked === true ? [...new Set([...selected, value])] : selected.filter(item => item !== value))} /><Label htmlFor={`returns.policy.resolution.${value}`}>{RETURN_RESOLUTION_LABELS[value]}</Label></div>)}</div>{error('enabledResolutions')}
    </fieldset>
    <p className="config-note">Revisa estas reglas antes de guardar. Las solicitudes pendientes se vuelven a validar al aprobar y completar, usando su fecha de solicitud. No se recalculan devoluciones completadas. Los servicios no generan recepción ni reposición física.</p>
  </div>
}
