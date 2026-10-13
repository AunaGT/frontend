import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Link } from 'react-router-dom'
import { apiFetch, getApiBaseUrl } from '@/services/api'
import { useTenant } from '@/context/useTenant'
import { ImportWorkbench } from '@/components/shared/ImportWorkbench'
import { useImportStream } from '@/components/shared/useImportStream'
import { useImportDecisions, type ImportDecisions, type ImportRowIssue } from '@/components/shared/useImportDecisions'

type Validation = { totals: { total: number; valid: number; invalid: number; skipped: number }; invalidRows: ImportRowIssue[] }
type Result = { created: number; skipped: number; errors: { rowIndex: number; error: string }[] }
// La vista previa compartida muestra los tres primeros campos, nunca credenciales.
const fields = [{id:'name',label:'Nombre',required:true}, {id:'email',label:'Correo',required:true}, {id:'role',label:'Rol',required:true}, {id:'password',label:'Contraseña',required:true}]
export default function UserImportPage() {
  const { company } = useTenant()
  const [workbook,setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheet,setSheet] = useState(''), [file,setFile] = useState<File | null>(null)
  const [mapping,setMapping] = useState<Record<string,string>>({})
  const [validation,setValidation] = useState<Validation | null>(null), [result,setResult] = useState<Result | null>(null)
  const [busy,setBusy] = useState(false), [error,setError] = useState('')
  const importStream = useImportStream()
  const decisions = useImportDecisions(workbook, sheet, mapping)
  const rows = workbook && sheet ? XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[sheet], {defval:''}) : []
  const columns = rows.length ? Object.keys(rows[0]) : []
  function clearValidation() { setValidation(null); setResult(null); setError('') }
  async function loadFile(nextFile: File) {
    if (busy) return
    clearValidation()
    setWorkbook(null); setMapping({}); setFile(null)
    if (!/\.(xlsx|xls|csv)$/i.test(nextFile.name) || nextFile.size > 5 * 1024 * 1024) { const message = 'Selecciona un archivo XLSX, XLS o CSV de hasta 5 MB.'; setError(message); return message }
    try {
      const wb = XLSX.read(await nextFile.arrayBuffer(), {type:'array', codepage: /\.csv$/i.test(nextFile.name) ? 65001 : undefined})
      if (!wb.SheetNames.length) throw new Error('El archivo no contiene hojas.')
      const data = XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]], {defval:''})
      if (!data.length || data.length > 1000) throw new Error('El archivo debe tener entre 1 y 1000 filas.')
      const aliases: Record<string,string[]> = {name:['nombre','name'],email:['email','correo'],password:['password','contraseña','contrasena'],role:['rol','role']}
      const map: Record<string,string> = {}
      for (const f of fields) map[f.id] = Object.keys(data[0]).find(k => aliases[f.id].includes(k.trim().toLowerCase())) || ''
      setWorkbook(wb); setSheet(wb.SheetNames[0]); setFile(nextFile); setMapping(map)
    } catch(e) { const message = (e as Error).message; setError(message); return message }
  }
  function payload(importOptions: ImportDecisions = decisions.options) { return { rows: rows.map(row => Object.fromEntries(fields.map(f => [f.id, row[mapping[f.id]]]))), importOptions } }
  async function validate(importOptions: ImportDecisions = decisions.options) {
    setBusy(true); setError('')
    try { setValidation(await apiFetch<Validation>('/api/auth/users/validate-import-mapped',{method:'POST',body:JSON.stringify(payload(importOptions))})) }
    catch(e) { setValidation(null); setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function importRows() {
    if (!validation || validation.totals.invalid || busy) return
    setBusy(true); setError('')
    try {
      setResult(await importStream.start<Result>(`${getApiBaseUrl()}/auth/users/bulk-import-mapped-stream`, payload()))
      // Quitar las credenciales del estado al terminar. Nunca se guardan en sessionStorage.
      setWorkbook(null); setMapping({}); setFile(null)
    } catch(e) {
      const importError = e as Error & { invalidRows?: Validation['invalidRows'] }
      if (importError.invalidRows) setValidation(previous => previous ? { ...previous, invalidRows: importError.invalidRows!, totals: { ...previous.totals, invalid: importError.invalidRows!.length, valid: 0 } } : null)
      setError(importError.name === 'AbortError' ? 'Importación cancelada. Verifica los datos antes de reintentar; alguna cuenta pudo haberse creado.' : importError.message)
    }
    finally { setBusy(false) }
  }
  return <ImportWorkbench title="Importar usuarios" description={`Carga y valida las cuentas para ${company?.name || 'la empresa activa'} antes de importarlas.`}
    back="/usuarios" backLabel="Usuarios" templatePath="/auth/users/template" templateName="plantilla_usuarios.xlsx"
    file={file} maxSizeBytes={5 * 1024 * 1024} onFile={loadFile} sheetNames={workbook?.SheetNames || []} selectedSheet={sheet}
    onSheetChange={value => { setSheet(value); setMapping({}); clearValidation() }}
    fields={fields} mappings={columns.map(column => ({ excelColumn: column, systemField: fields.find(field => mapping[field.id] === column)?.id || null }))}
    onMappingChange={(field, column) => { setMapping(previous => ({ ...previous, [field]: column })); clearValidation() }}
    rows={rows} firstErrorIndex={2} validated={!!validation} validCount={validation?.totals.valid || 0} errors={validation?.invalidRows || []}
    skippedRowIndexes={decisions.options.skipRowIndexes} onResolveRow={(rowIndex, action) => decisions.resolve(rowIndex, action, validate)}
    onValidate={() => validate()} onImport={importRows} busy={busy} progress={importStream.progress} onCancel={importStream.cancel} result={result} errorMessage={error}
    options={<div className="mt-4 text-sm text-muted-foreground"><p>Hasta 1000 filas · máximo 5 MB. Los roles deben existir y estar autorizados para tu empresa. Las contraseñas deben tener al menos 10 caracteres y no se muestran en la vista previa. No se importan datos de RRHH.</p><Link className="inline-block mt-2 text-brand-orange" to="/usuarios/roles-permisos">Administrar roles</Link></div>}
    rowResolutionActions={rowIndex => validation?.invalidRows.find(row => row.rowIndex === rowIndex)?.errors.some(message => /rol.+no existe/i.test(message)) ? <Link className="block text-brand-orange mt-2" to="/usuarios/roles-permisos">Crear o revisar rol autorizado</Link> : null}
  />
}
