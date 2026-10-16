import { format } from 'date-fns'
import { CompanyLogo } from '@/components/branding/CompanyLogo'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { Button } from '@/components/ui/button'
import { SettingsInput, SettingsSelect, type SectionEditorProps } from './SettingsFields'
const currencies = [{ value: 'GTQ', label: 'GTQ – Quetzal', name: 'Quetzal' }, { value: 'MXN', label: 'MXN – Peso mexicano', name: 'Peso mexicano' }, { value: 'USD', label: 'USD – Dólar estadounidense', name: 'Dólar estadounidense' }]
const timezones = [{ value: 'America/Guatemala', label: 'Guatemala (America/Guatemala)' }, { value: 'America/El_Salvador', label: 'El Salvador (America/El_Salvador)' }, { value: 'UTC', label: 'UTC' }]
const locales = [{ value: 'es-GT', label: 'Español (Guatemala)' }, { value: 'es-MX', label: 'Español (México)' }, { value: 'en-US', label: 'English (United States)' }]
export function CompanySettingsSection(props: SectionEditorProps & { logoUrl: string; logoPending: boolean; onUpload: (file: File) => void; onRemove: () => void; onReject: (message: string) => void; canManage: boolean }) {
  if (props.section === 'empresa') return <div className="config-identity-fields">
    <SettingsInput {...props} field="company_name" label="Nombre de la empresa" maxLength={150} help="Se muestra en la aplicación y en los documentos de esta empresa." />
    <div className="config-logo-editor"><CompanyLogo key={props.logoUrl} src={props.logoUrl} size="lg" fallback={String(props.values.company_name || 'A').slice(0, 1)} /><div className="min-w-0 flex-1 space-y-3"><p className="text-sm font-medium">Logo del negocio</p><p className="text-xs text-muted-foreground">Aparece en cotizaciones, tickets, facturas y reportes PDF. Se aplica al subir o quitar el logo, sin esperar a Guardar cambios.</p>{props.canManage && <ImageUploadDropzone onFileSelect={props.onUpload} onReject={props.onReject} disabled={props.disabled} isUploading={props.logoPending} helperText="PNG o JPG · máx. 5 MB" />}{props.logoUrl && props.canManage && <Button variant="outline" type="button" disabled={props.disabled} onClick={props.onRemove}>Quitar logo</Button>}</div></div>
  </div>
  let preview = 'Selecciona formatos válidos para ver el ejemplo.'
  try { preview = `${new Intl.NumberFormat(props.values.locale, { style: 'currency', currency: props.values.currency_code }).format(1234.5)} · ${format(new Date(), props.values.date_format || '')} · ${new Intl.DateTimeFormat(props.values.locale, { timeStyle: 'short', timeZone: props.values.timezone }).format(new Date())}` } catch { /* Keep the form usable when a stored format is unknown. */ }
  return <div className="space-y-5"><div className="config-fields-grid">
    <SettingsSelect {...props} field="currency_code" label="Moneda" options={currencies} onField={(key, value) => { props.onField(key, value); props.onField('currency_name', currencies.find(c => c.value === value)?.name || String(value)) }} />
    <SettingsSelect {...props} field="timezone" label="Zona horaria" options={timezones} />
    <SettingsSelect {...props} field="locale" label="Idioma y formato regional" options={locales} />
    <SettingsSelect {...props} field="date_format" label="Formato de fecha" options={[{ value: 'dd/MM/yyyy', label: 'dd/MM/yyyy (día/mes/año)' }, { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy (mes/día/año)' }, { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd (ISO)' }]} />
  </div><div className="config-note"><div><p className="text-sm font-medium">Ejemplo de visualización</p><p className="mt-1 text-sm">{preview}</p></div></div><p className="text-xs text-muted-foreground">Cambiar estos formatos no convierte importes ni modifica documentos históricos.</p></div>
}
