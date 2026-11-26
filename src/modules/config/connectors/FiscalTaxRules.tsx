import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CompanyTaxConfiguration, ProfileDraft, TaxRule } from './types'

type Props = {
  draft: ProfileDraft; taxConfiguration: CompanyTaxConfiguration; fields: Record<string, string>; disabled: boolean
  update: (change: (draft: ProfileDraft) => ProfileDraft) => void; onFiscalSettings: () => void
}
const percentage = (rate: string) => new Intl.NumberFormat('es-GT', { maximumFractionDigits: 4 }).format(Number(rate) * 100)

export function FiscalTaxRules({ draft, taxConfiguration: config, fields, disabled, update, onFiscalSettings }: Props) {
  const small = config?.regime === 'PEQUENO'
  const ready = !!config && !Object.keys(config.issues).length && (small ? config.pequenoRate !== null : config.regime === 'GENERAL' && config.ivaRate !== null && Number(config.ivaRate) > 0)
  const normal = { mode: small ? 'NO_BREAKDOWN' as const : 'INCLUDED' as const, rate: small ? '0' : config?.ivaRate || '' }
  return <details id="profile-taxRules" className="rounded border bg-card p-4">
    <summary className="cursor-pointer font-semibold">Reglas de impuestos ({draft.taxRules.length})</summary>
    <div className="mt-4 space-y-4">
      <section className="space-y-3 rounded border bg-muted/30 p-3" aria-label="Tasas compartidas con Contabilidad">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium">Tasas compartidas con Contabilidad</h3><Button type="button" variant="outline" className="min-h-11" onClick={onFiscalSettings}>Editar datos fiscales</Button></div>
        <p className="text-sm">{small ? 'Pequeño contribuyente' : config?.regime === 'GENERAL' ? 'Régimen general' : 'Régimen sin confirmar'} · {small ? `Tarifa contable: ${config.pequenoPercent ?? 'sin confirmar'} %` : `IVA incluido: ${config?.ivaPercent ?? 'sin confirmar'} %`}</p>
        <p className="text-sm text-muted-foreground">{small ? 'La tarifa es una obligación contable sobre ventas; no se suma al total ni se desglosa como IVA en cada línea de FPEQ.' : 'La tasa se guarda una sola vez en la empresa. Aquí relacionas productos y categorías; no defines otra tasa para Infile.'}</p>
        {Object.entries(config?.issues || {}).map(([key, message]) => <p key={key} className="text-sm text-destructive">{message}</p>)}
        {config?.regime === 'GENERAL' && config.ivaRate === '0' && <p className="text-sm text-destructive">El IVA incluido necesita una tasa mayor que cero. Los tratamientos exentos requieren revisión separada.</p>}
        {!config && <p className="text-sm text-destructive">Recarga para consultar la configuración compartida.</p>}
        <p className="text-sm text-muted-foreground">Guardar captura una versión. Si cambian el régimen o las tasas, tendrás que revisar este perfil; no se modifica el historial.</p>
      </section>
      {fields.taxConfiguration && <p role="alert" className="text-sm text-destructive">{fields.taxConfiguration}</p>}
      {fields['taxConfiguration.accountingAlignment'] && <p role="alert" className="text-sm text-destructive">{fields['taxConfiguration.accountingAlignment']}</p>}
      {draft.taxRules.map((row, index) => {
        const used = [...draft.productTaxMap, ...draft.categoryTaxMap].some(map => map.taxRuleId === row.id)
        const edit = (values: Partial<TaxRule>) => update(d => ({ ...d, taxRules: d.taxRules.map(rule => rule.id === row.id ? { ...rule, ...values } : rule) }))
        const mismatched = row.mode !== 'EXEMPT' && (row.mode !== normal.mode || row.rate !== normal.rate)
        return <div key={row.id} className="space-y-3 border-b pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">Nombre de la regla<Input className="min-h-11" maxLength={100} value={row.name} onChange={e => edit({ name: e.target.value })}/></label>
            <label className="grid gap-2 text-sm">Tratamiento<select className="auna-control auna-control-select min-h-11" value={row.mode} aria-invalid={!!fields[`taxRules.${index}.mode`]} onChange={e => edit(e.target.value === 'EXEMPT' ? { mode: 'EXEMPT', rate: '0', exemptionCode: '' } : { ...normal, exemptionCode: '' })}>
              <option value="INCLUDED" disabled={small || !ready}>IVA incluido · tasa de Datos fiscales</option>
              <option value="NO_BREAKDOWN" disabled={!small || !ready}>Sin desglose · pequeño contribuyente</option>
              <option value="EXEMPT" disabled={small}>Exento · preparación local</option>
            </select>{fields[`taxRules.${index}.mode`] && <span className="text-destructive">{fields[`taxRules.${index}.mode`]}</span>}</label>
            {row.mode === 'INCLUDED' && <p className="text-sm">Guardada: {percentage(row.rate)} % · IVA incluido</p>}
            {row.mode === 'EXEMPT' && <label className="grid gap-2 text-sm">Código de exención<Input className="min-h-11" maxLength={40} value={row.exemptionCode} aria-invalid={!!fields[`taxRules.${index}.exemptionCode`]} onChange={e => edit({ exemptionCode: e.target.value })}/></label>}
          </div>
          {row.mode === 'EXEMPT' && <p className="text-sm text-muted-foreground">Las exenciones por producto o categoría todavía no modifican los asientos. Solo puedes preparar este borrador; falta integrar el cálculo por línea antes de habilitarlo.</p>}
          {fields[`taxRules.${index}.rate`] && <p role="alert" className="text-sm text-destructive">{fields[`taxRules.${index}.rate`]}</p>}
          {mismatched && <div className="flex flex-wrap items-center gap-3"><p className="text-sm">Esta regla no coincide con la configuración actual.</p><Button type="button" variant="outline" className="min-h-11" disabled={disabled || !ready} onClick={() => edit({ ...normal, exemptionCode: '' })}>Usar configuración actual</Button></div>}
          <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={used || disabled} onClick={() => update(d => ({ ...d, taxRules: d.taxRules.filter(rule => rule.id !== row.id) }))}>Quitar regla</Button>{used && <span className="text-sm text-muted-foreground">Quita primero sus relaciones con categorías o productos.</span>}</div>
        </div>
      })}
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled || !ready || draft.taxRules.length >= 40} onClick={() => update(d => ({ ...d, taxRules: [...d.taxRules, { id: crypto.randomUUID(), name: small ? 'Pequeño contribuyente · sin desglose' : `IVA incluido · ${config.ivaPercent} %`, ...normal, exemptionCode: '' }] }))}>Agregar regla</Button>
    </div>
  </details>
}
