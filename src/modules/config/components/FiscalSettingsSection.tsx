import { SettingsInput, SettingsSelect, SettingsSwitch, type SectionEditorProps } from './SettingsFields'
const fields = [{ field: 'company_nit', label: 'NIT del emisor' }, { field: 'company_address', label: 'Dirección fiscal' }, { field: 'company_municipality', label: 'Municipio' }, { field: 'company_department', label: 'Departamento' }, { field: 'company_postal_code', label: 'Código postal' }, { field: 'establishment_code', label: 'Código de establecimiento' }] as const
export function FiscalSettingsSection(props: SectionEditorProps) {
  return <div className="space-y-5"><SettingsSwitch {...props} field="fel_enabled" label="Este negocio emitirá facturas electrónicas" help="Las nuevas ventas del POS solicitarán su factura automáticamente; las demás se solicitarán desde el detalle de venta." />
    <div className="config-note"><p>El certificador aún no está conectado: las solicitudes quedarán pendientes, sin autorización fiscal. Activar esta opción no envía ventas históricas.</p></div>
    <div className="config-fields-grid">{fields.map(f => <SettingsInput key={f.field} {...props} {...f} />)}<SettingsSelect {...props} field="vat_affiliation" label="Afiliación IVA" options={[{ value: 'general', label: 'Régimen general' }, { value: 'pequeno_contribuyente', label: 'Pequeño contribuyente' }, { value: 'no_obligado', label: 'No obligado' }, { value: 'exento', label: 'Exento' }, { value: 'otro', label: 'Otro' }]} /></div>
    <p className="text-xs text-muted-foreground">Los cambios no recalculan impuestos de documentos anteriores.</p></div>
}
