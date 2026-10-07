import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { downloadFile, getAuthToken } from '@/services/api'
import { ImportWizardSteps } from './ImportWizardSteps'
import { ImportProgress, type ImportProgressEvent } from './ImportProgress'
import { ImportSummary, type ImportSummaryResult } from './ImportSummary'
import { feedbackForRow } from './importRowFeedback.mjs'
import { ImportRowActions, type ImportRowIssue } from './useImportDecisions'
import { validateImportFile } from './importFile.mjs'
import './dataTransfer.css'
import { usePageNavigation, usePageTrail } from '@/components/layout/PageNavigation'

type Field = { id: string; label: string; required: boolean }
type Mapping = { excelColumn: string; systemField: string | null }
type RowError = ImportRowIssue

export function ImportWorkbench({ title, description, back, backLabel, templatePath, templateName, file, onFile, sheetNames, selectedSheet, onSheetChange, useFirstRowAsHeader = true, onHeaderChange, fields, mappings, onMappingChange, rows, firstErrorIndex, validated, validCount, errors, skippedRowIndexes = [], automaticSkippedRowIndexes = [], onResolveRow, onValidate, onImport, busy = false, progress, onCancel, result, errorMessage, options, resolutionActions, rowResolutionActions }: {
  title: string
  description: string
  back: string
  backLabel: string
  templatePath: string
  templateName: string
  file: File | null
  onFile: (file: File) => Promise<string | void> | string | void
  sheetNames: string[]
  selectedSheet: string
  onSheetChange: (sheet: string) => void
  useFirstRowAsHeader?: boolean
  onHeaderChange?: (checked: boolean) => void
  fields: readonly Field[]
  mappings: Mapping[]
  onMappingChange: (field: string, column: string) => void
  rows: Record<string, unknown>[]
  firstErrorIndex: number
  validated: boolean
  validCount: number
  errors: RowError[]
  skippedRowIndexes?: number[]
  automaticSkippedRowIndexes?: number[]
  onResolveRow?: (rowIndex: number, action: 'skip' | 'restore' | 'allow') => void
  onValidate: () => void
  onImport: () => void
  busy?: boolean
  progress?: ImportProgressEvent | null
  onCancel?: () => void
  result: ImportSummaryResult | null
  errorMessage?: string
  options?: ReactNode
  resolutionActions?: ReactNode
  rowResolutionActions?: (rowIndex: number) => ReactNode
}) {
  const navigation = usePageNavigation()
  const [fileError, setFileError] = useState('')
  const [page, setPage] = useState(1)
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const errorSummary = useRef<HTMLParagraphElement>(null)
  const selected = Object.fromEntries(mappings.filter((mapping) => mapping.systemField).map((mapping) => [mapping.systemField, mapping.excelColumn])) as Record<string, string>
  const requiredMapped = fields.filter((field) => field.required).every((field) => selected[field.id])
  const mappedFields = mappings.map((mapping) => mapping.systemField).filter(Boolean)
  const uniqueMapping = new Set(mappedFields).size === mappedFields.length
  const invalid = errors.filter((error) => error.rowIndex >= 0).length
  const firstError = errors.find((error) => error.rowIndex < 0)
  const previewFields = fields.filter((field) => selected[field.id]).slice(0, 3)
  const filtered = showErrorsOnly && validated ? rows.map((row, index) => ({ row, index })).filter(({ index }) => feedbackForRow(errors, index, firstErrorIndex).length > 0) : rows.map((row, index) => ({ row, index }))
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10)
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])).filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b)
  const step = result ? 4 : validated ? 3 : file ? 2 : 1
  usePageTrail(navigation ? [{ label: 'Importar' }, { label: ['Cargar archivo', 'Mapeo de campos', 'Validación', 'Resultado'][step - 1] }] : null)
  useEffect(() => { if (validated && errors.length) errorSummary.current?.focus() }, [validated, errors])

  const loadFile = async (next?: File) => {
    if (!next || busy) return
    const problem = validateImportFile(next)
    setFileError(problem || '')
    if (!problem) {
      setPage(1); setShowErrorsOnly(false)
      try { setFileError((await onFile(next)) || '') }
      catch (error) { setFileError(error instanceof Error ? error.message : 'No se pudo leer el archivo.') }
    }
  }
  const downloadTemplate = async () => {
    setTemplateError('')
    try {
      const token = getAuthToken()
      await downloadFile(templatePath, templateName, token ? { Authorization: `Bearer ${token}` } : undefined)
    } catch (error) { setTemplateError(error instanceof Error ? error.message : 'No se pudo descargar la plantilla.') }
  }

  if (result) return <main className="auna-import-workbench">{navigation ? <h1 className="sr-only">{title}</h1> : <header className="auna-import-workbench-heading"><h1>{title}</h1></header>}<ImportWizardSteps current={4} fileName={file?.name} /><section className="auna-import-panel"><div className="auna-import-panel-body"><ImportSummary result={result} back={back} backLabel={backLabel} /></div></section></main>

  return <main className="auna-import-workbench">
    {!navigation && <Link className="auna-import-back" to={back}>← {backLabel}</Link>}
    {navigation ? <><h1 className="sr-only">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></> : <header className="auna-import-workbench-heading"><h1>{title}</h1><p>{description}</p></header>}
    <ImportWizardSteps current={step as 1 | 2 | 3 | 4} fileName={file?.name} />

    <section className="auna-import-panel" aria-labelledby="import-upload-heading">
      <header><h2 id="import-upload-heading" className="auna-import-panel-title"><span className="auna-import-panel-icon"><Upload size={15} /></span>1. Cargar archivo</h2></header>
      <div className="auna-import-panel-body auna-import-upload-grid">
        <ImageUploadDropzone className="auna-import-file-drop" accept=".xlsx,.xls,.csv" maxSizeBytes={10 * 1024 * 1024} fileLabel="archivo" formatsLabel="XLSX, XLS o CSV" validateFile={validateImportFile} disabled={busy} onReject={setFileError} onFileSelect={(next) => void loadFile(next)} />
        <div className="auna-import-upload-help"><FileSpreadsheet size={26} /><strong className="block break-all mt-2">{file?.name || 'Ningún archivo seleccionado'}</strong><p>Hasta 10 MB</p>
          {sheetNames.length > 0 && <label className="auna-import-field">Hoja<select className="auna-control auna-control-select" value={selectedSheet} onChange={(event) => { onSheetChange(event.target.value); setPage(1) }}>{sheetNames.map((sheet) => <option key={sheet}>{sheet}</option>)}</select></label>}
          {file && onHeaderChange && <label className="auna-import-only-errors"><input className="auna-checkbox" type="checkbox" checked={useFirstRowAsHeader} onChange={(event) => { onHeaderChange(event.target.checked); setPage(1) }} />Usar primera fila como encabezado</label>}
        </div>
        <div className="auna-import-upload-help"><p>La primera fila debe contener encabezados. Podrás revisar el mapeo y los errores antes de guardar datos.</p>
          <Button type="button" variant="outline" onClick={() => void downloadTemplate()}><Download size={15} className="mr-2" />Descargar plantilla</Button>
        </div>
      </div>
      {(fileError || templateError) && <p className="auna-import-error" role="alert">{fileError || templateError}</p>}
    </section>

    <section className="auna-import-panel" aria-labelledby="import-mapping-heading">
      <header><h2 id="import-mapping-heading">2. Mapeo de campos</h2><span>Asocia cada campo con una columna del archivo.</span></header>
      <div className="auna-import-panel-body"><div className="auna-import-fields">{fields.map((field) => <label className="auna-import-field" key={field.id}>{field.label}{field.required && ' *'}<select className="auna-control auna-control-select" value={selected[field.id] || ''} disabled={!file || busy} onChange={(event) => { onMappingChange(field.id, event.target.value); setPage(1) }}><option value="">Selecciona columna</option>{mappings.map((mapping) => <option key={mapping.excelColumn} value={mapping.excelColumn} disabled={Boolean(mapping.systemField && mapping.systemField !== field.id)}>{mapping.excelColumn}</option>)}</select></label>)}</div>{options}</div>
    </section>

    <section className="auna-import-panel" aria-labelledby="import-validation-heading">
      <header><h2 id="import-validation-heading">3. Validación</h2><Button type="button" variant="outline" disabled={!file || Boolean(fileError) || !rows.length || !requiredMapped || !uniqueMapping || busy} onClick={() => { setPage(1); onValidate() }}>{busy ? 'Procesando…' : 'Validar archivo'}</Button></header>
      <div className="auna-import-panel-body">
        {!requiredMapped && file && <p className="auna-import-note" role="status">Asocia todos los campos obligatorios para validar.</p>}
        {!uniqueMapping && <p className="auna-import-error" role="alert">Hay campos asignados a más de una columna. Ajusta el mapeo antes de validar.</p>}
        {firstError && <p className="auna-import-error" role="alert">{firstError.errors.join(' · ')}</p>}
        {validated ? <>
          {invalid > 0 && <p ref={errorSummary} tabIndex={-1} role="alert" className="auna-import-error">{invalid} {invalid === 1 ? 'fila necesita' : 'filas necesitan'} corrección. Revisa el mensaje de cada fila en la tabla.</p>}
          <div className="auna-import-totals"><div><strong>{validCount}</strong><span>Válidos</span></div><div><strong>{invalid}</strong><span>Con errores</span></div><div><strong>{firstError ? skippedRowIndexes.length : Math.max(0, rows.length - validCount - invalid)}</strong><span>Omitidos</span></div></div>
          {resolutionActions}
          <label className="auna-import-only-errors"><input className="auna-checkbox" type="checkbox" checked={showErrorsOnly} onChange={(event) => { setShowErrorsOnly(event.target.checked); setPage(1) }} />Mostrar solo filas con errores</label>
          <div className="auna-import-table-wrap"><table className="auna-import-table"><thead><tr><th>Fila</th>{previewFields.map((field) => <th key={field.id}>{field.label}</th>)}<th>Validación</th></tr></thead><tbody>{visible.map(({ row, index }) => { const rowErrors = feedbackForRow(errors, index, firstErrorIndex); const skipped = skippedRowIndexes.includes(index + firstErrorIndex) || automaticSkippedRowIndexes.includes(index + firstErrorIndex); return <tr key={index}><td>{index + (useFirstRowAsHeader ? 2 : 1)}</td>{previewFields.map((field) => <td key={field.id}>{String(row[selected[field.id]] ?? '') || '—'}</td>)}<td className={firstError ? '' : rowErrors.length ? 'auna-import-invalid' : skipped ? '' : 'auna-import-valid'}>{firstError ? 'Pendiente de validación' : rowErrors.length ? rowErrors.join(' · ') : skipped ? automaticSkippedRowIndexes.includes(index + firstErrorIndex) ? 'Omitido: el código ya existe' : 'Omitido por decisión del usuario' : 'Válido'}{rowResolutionActions?.(index + firstErrorIndex)}{onResolveRow && !automaticSkippedRowIndexes.includes(index + firstErrorIndex) && <ImportRowActions rowIndex={index + firstErrorIndex} displayRowIndex={index + (useFirstRowAsHeader ? 2 : 1)} issue={errors.find(error => error.rowIndex === index + firstErrorIndex)} skipped={skipped} disabled={busy || Boolean(firstError)} onResolve={onResolveRow} />}</td></tr> })}</tbody></table></div>
        </> : <p className="auna-import-note">Valida el archivo para revisar cada fila antes de guardar datos.</p>}
      </div>
    </section>
    {validated && <div className="auna-pagination-outside"><footer className="auna-import-pagination"><span>Mostrando {visible.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, filtered.length)} de {filtered.length}</span><nav aria-label="Paginación"><Button type="button" size="icon" variant="outline" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></Button>{pages.map((number, index) => <span key={number} className="auna-import-page-number">{index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}<Button type="button" size="icon" variant={number === currentPage ? 'default' : 'outline'} aria-label={`Página ${number}`} aria-current={number === currentPage ? 'page' : undefined} onClick={() => setPage(number)}>{number}</Button></span>)}<Button type="button" size="icon" variant="outline" aria-label="Página siguiente" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></Button></nav></footer></div>}

    <section className="auna-import-panel" aria-labelledby="import-result-heading">
      <header><h2 id="import-result-heading">4. Resultado</h2></header>
      <div className="auna-import-panel-body auna-import-result-row">{progress && onCancel ? <ImportProgress progress={progress} onCancel={onCancel} /> : result ? <ImportSummary result={result} back={back} backLabel={backLabel} /> : errorMessage ? <p className="auna-import-error" role="alert">{errorMessage}</p> : <p>La validación no guarda datos. Confirma únicamente cuando todas las filas estén listas.</p>}
        <div>{!progress && !result && <Button asChild variant="outline"><Link to={back}>Cancelar</Link></Button>}{!result && !progress && <Button type="button" disabled={Boolean(fileError) || !validated || !validCount || invalid > 0 || Boolean(firstError) || busy} onClick={onImport}>{busy ? 'Importando…' : `Importar ${validCount} registros`}</Button>}</div>
      </div>
    </section>
  </main>
}
