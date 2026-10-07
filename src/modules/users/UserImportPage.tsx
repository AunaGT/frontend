import { useState } from 'react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import * as XLSX from 'xlsx'
import { Link } from 'react-router-dom'
import { Upload, FileSpreadsheet, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch, downloadFile, getApiBaseUrl } from '@/services/api'
import { useTenant } from '@/context/useTenant'
import { UsersPage, AunaPanel, PageFooter, Feedback } from './UsersUI'
import { ImportWizardSteps } from '@/components/shared/ImportWizardSteps'
import { ImportProgress } from '@/components/shared/ImportProgress'
import { ImportSummary } from '@/components/shared/ImportSummary'
import { useImportStream } from '@/components/shared/useImportStream'
import { validateImportFile } from '@/components/shared/importFile.mjs'
import { ImportRowActions, useImportDecisions, type ImportDecisions, type ImportRowIssue } from '@/components/shared/useImportDecisions'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'

type Validation = { totals: { total: number; valid: number; invalid: number; skipped: number }; invalidRows: ImportRowIssue[] }
type Result = { created: number; skipped: number; errors: { rowIndex: number; error: string }[] }
const fields = [{id:'name',label:'Nombre'}, {id:'email',label:'Correo'}, {id:'password',label:'Contraseña'}, {id:'role',label:'Rol'}]
export default function UserImportPage() {
  const { company } = useTenant()
  const [workbook,setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheet,setSheet] = useState(''), [fileName,setFileName] = useState('')
  const [mapping,setMapping] = useState<Record<string,string>>({})
  const [validation,setValidation] = useState<Validation | null>(null), [result,setResult] = useState<Result | null>(null)
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [page,setPage] = useState(1)
  const importStream = useImportStream()
  usePageTrail([{ label: 'Importar' }, { label: result ? 'Resultado' : validation ? 'Validación' : workbook ? 'Mapeo de campos' : 'Cargar archivo' }])
  const decisions = useImportDecisions(workbook, sheet, mapping)
  const rows = workbook && sheet ? XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[sheet], {defval:''}) : []
  const columns = rows.length ? Object.keys(rows[0]) : []
  const ready = fields.every(f => mapping[f.id]) && new Set(Object.values(mapping)).size === fields.length
  const step = result ? 4 : validation ? 3 : workbook ? 2 : 1
  function clearValidation() { setValidation(null); setResult(null); setError(''); setPage(1) }
  async function loadFile(file?: File) {
    if (!file || busy) return
    clearValidation()
    setWorkbook(null); setMapping({})
    if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size > 5 * 1024 * 1024) { setError('Selecciona un archivo XLSX, XLS o CSV de hasta 5 MB.'); return }
    try {
      const wb = XLSX.read(await file.arrayBuffer(), {type:'array', codepage: /\.csv$/i.test(file.name) ? 65001 : undefined})
      if (!wb.SheetNames.length) throw new Error('El archivo no contiene hojas.')
      const data = XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]], {defval:''})
      if (!data.length || data.length > 1000) throw new Error('El archivo debe tener entre 1 y 1000 filas.')
      const aliases: Record<string,string[]> = {name:['nombre','name'],email:['email','correo'],password:['password','contraseña','contrasena'],role:['rol','role']}
      const map: Record<string,string> = {}
      for (const f of fields) map[f.id] = Object.keys(data[0]).find(k => aliases[f.id].includes(k.trim().toLowerCase())) || ''
      setWorkbook(wb); setSheet(wb.SheetNames[0]); setFileName(file.name); setMapping(map)
    } catch(e) { setError((e as Error).message) }
  }
  function payload(importOptions: ImportDecisions = decisions.options) { return { rows: rows.map(row => Object.fromEntries(fields.map(f => [f.id, row[mapping[f.id]]]))), importOptions } }
  async function validate(importOptions: ImportDecisions = decisions.options) {
    setBusy(true); setError('')
    try { setValidation(await apiFetch<Validation>('/api/auth/users/validate-import-mapped',{method:'POST',body:JSON.stringify(payload(importOptions))})); setPage(1) }
    catch(e) { setValidation(null); setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function importRows() {
    if (!validation || validation.totals.invalid || busy) return
    setBusy(true); setError('')
    try {
      setResult(await importStream.start<Result>(`${getApiBaseUrl()}/auth/users/bulk-import-mapped-stream`, payload()))
      // Quitar las credenciales del estado al terminar. Nunca se guardan en sessionStorage.
      setWorkbook(null); setMapping({})
    } catch(e) {
      const importError = e as Error & { invalidRows?: Validation['invalidRows'] }
      if (importError.invalidRows) setValidation(previous => previous ? { ...previous, invalidRows: importError.invalidRows!, totals: { ...previous.totals, invalid: importError.invalidRows!.length, valid: 0 } } : null)
      setError(importError.name === 'AbortError' ? 'Importación cancelada. Verifica los datos antes de reintentar; alguna cuenta pudo haberse creado.' : importError.message)
    }
    finally { setBusy(false) }
  }
  if (result) return <UsersPage compact title="Importar usuarios" description={`Importación para ${company?.name || 'la empresa activa'} finalizada.`}><ImportWizardSteps current={4} fileName={fileName} /><AunaPanel title="Resultado"><ImportSummary result={result} back="/usuarios" backLabel="Usuarios" /></AunaPanel></UsersPage>
  return <UsersPage compact title="Importar usuarios" description={`Carga y valida las cuentas para ${company?.name || 'la empresa activa'} antes de importarlas.`}>
    <ImportWizardSteps current={step as 1 | 2 | 3 | 4} fileName={fileName} />
    <Feedback error={error ? new Error(error) : undefined}/>
    <AunaPanel title="1. Cargar archivo" icon={Upload}>
      <div className="grid gap-5 lg:grid-cols-3">
        <ImageUploadDropzone className="auna-import-file-drop" accept=".xlsx,.xls,.csv" maxSizeBytes={5 * 1024 * 1024} fileLabel="archivo" formatsLabel="XLSX, XLS o CSV" validateFile={validateImportFile} disabled={busy} onReject={setError} onFileSelect={(file) => void loadFile(file)} />
        <div className="rounded-lg border p-5"><FileSpreadsheet className="text-emerald-500 mb-2"/><strong className="text-sm break-all">{fileName || 'Ningún archivo seleccionado'}</strong><p className="users-muted text-xs mt-2">Hasta 1000 filas · máximo 5 MB</p>{workbook && <label className="block mt-3 text-xs">Hoja<select className="auna-control auna-control-select users-select mt-1" value={sheet} disabled={busy} onChange={e => { setSheet(e.target.value); setMapping({}); clearValidation() }}>{workbook.SheetNames.map(s => <option key={s}>{s}</option>)}</select></label>}</div>
        <div className="text-sm users-muted"><p>La primera fila debe contener encabezados. Los roles deben existir y estar autorizados para tu empresa. Las contraseñas deben tener al menos 10 caracteres.</p><Button variant="outline" className="mt-4" onClick={() => void downloadFile('/auth/users/template','plantilla_usuarios.xlsx').catch(e => setError(e.message))}><Download size={15} className="mr-2"/>Descargar plantilla</Button><Link className="block text-orange-500 mt-3" to="/usuarios/roles-permisos">Administrar roles</Link></div>
      </div>
    </AunaPanel>
    <AunaPanel title="2. Mapeo de campos" subtitle="Asocia cada columna con un campo requerido. No se importan datos de RRHH."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fields.map(f => <label className="text-sm" key={f.id}>{f.label} *<select className="auna-control auna-control-select users-select mt-2" disabled={!workbook || busy} value={mapping[f.id] || ''} onChange={e => { setMapping({...mapping,[f.id]:e.target.value}); clearValidation() }}><option value="">Selecciona columna</option>{columns.map(c => <option key={c}>{c}</option>)}</select></label>)}</div></AunaPanel>
    <><AunaPanel title="3. Validación" actions={<Button variant="outline" disabled={!ready || !rows.length || busy} onClick={() => void validate()}>{busy ? 'Procesando…' : 'Validar archivo'}</Button>}>
      {validation ? <><div className="grid grid-cols-3 gap-3 mb-5">{[[validation.totals.valid,'Válidos'],[validation.totals.invalid,'Con errores'],[validation.totals.skipped,'Omitidos']].map(([n,label]) => <div key={label} className="rounded-lg border p-4"><strong className="text-2xl">{n}</strong><p className="users-muted text-sm">{label}</p></div>)}</div><div className="overflow-x-auto"><table className="users-table"><thead><tr><th>Fila</th><th>Nombre</th><th>Correo</th><th>Validación</th></tr></thead><tbody>{rows.slice((page-1)*10,page*10).map((r,i) => {const index=(page-1)*10+i+2, invalid=validation.invalidRows.find(v => v.rowIndex===index), skipped=decisions.options.skipRowIndexes.includes(index); return <tr key={index}><td>{index}</td><td>{String(r[mapping.name] || '')}</td><td>{String(r[mapping.email] || '')}</td><td className={invalid ? 'text-red-500' : skipped ? '' : 'text-emerald-600'}>{invalid ? invalid.errors.join(' · ') : skipped ? 'Omitida por el usuario' : 'Válido'}{invalid?.errors.some(message => /rol.+no existe/i.test(message)) && <Link className="block text-orange-500 mt-2" to="/usuarios/roles-permisos">Crear o revisar rol autorizado</Link>}<ImportRowActions rowIndex={index} issue={invalid} skipped={skipped} disabled={busy} onResolve={(row, action) => decisions.resolve(row, action, validate)} /></td></tr>})}</tbody></table></div></> : <p className="users-muted text-sm">Valida el archivo para revisar errores antes de escribir datos.</p>}
    </AunaPanel>
{validation ? <div className="auna-pagination-outside"><PageFooter page={page} totalPages={Math.max(1,Math.ceil(rows.length/10))} total={rows.length} pageSize={10} onChange={setPage}/></div>: null}</>
    <AunaPanel title="4. Resultado">{importStream.progress ? <ImportProgress progress={importStream.progress} onCancel={importStream.cancel} /> : result ? <ImportSummary result={result} back="/usuarios" backLabel="Usuarios" /> : <div className="flex flex-wrap justify-between items-center gap-3"><p className="users-muted text-sm">La validación no crea usuarios. Confirma para guardar las cuentas.</p><div className="flex gap-2"><Button variant="outline" asChild><Link to="/usuarios">Cancelar</Link></Button><Button disabled={busy || !validation?.totals.valid || !!validation?.totals.invalid} onClick={importRows}>{busy ? 'Importando…' : `Importar ${validation?.totals.valid || 0} usuarios`}</Button></div></div>}</AunaPanel>
  </UsersPage>
}
