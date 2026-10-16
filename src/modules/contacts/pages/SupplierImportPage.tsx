/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * SupplierImportPage - Importación de contactos (proveedores y clientes)
 *
 * - Categoría / términos desconocidos: validación falla hasta crearlos en sus catálogos u omitir filas
 * - importOptions: createCategories, createPaymentTerms, skipRowIndexes
 */
import { useState, useEffect } from 'react'
import { getApiBaseUrl } from '@/services/api'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ImportWorkbench } from '@/components/shared/ImportWorkbench'
import { useImportDecisions, type ImportDecisions } from '@/components/shared/useImportDecisions'
import { useImportStream } from '@/components/shared/useImportStream'
import { assignImportField, readImportErrors } from '@/components/shared/importRowFeedback.mjs'
import { validateImportFile } from '@/components/shared/importFile.mjs'
const SYSTEM_FIELDS = [
    {
        id: 'party_type',
        label: 'Tipo de relación (proveedor / cliente)',
        required: false,
        type: 'string',
    },
    {
        id: 'entity_kind',
        label: 'Naturaleza (empresa / persona)',
        required: false,
        type: 'string',
    },
    { id: 'name', label: 'Nombre / razón social', required: true, type: 'string' },
    { id: 'contact', label: 'Persona de contacto', required: false, type: 'string' },
    { id: 'phone', label: 'Teléfono', required: true, type: 'string' },
    { id: 'email', label: 'Email', required: false, type: 'string' },
    { id: 'address', label: 'Dirección', required: true, type: 'string' },
    { id: 'category', label: 'Categoría (solo proveedores)', required: false, type: 'string' },
    { id: 'payment_terms', label: 'Términos de pago', required: false, type: 'string' },
    { id: 'tax_id', label: 'ID fiscal', required: false, type: 'string' },
]

interface ColumnMapping {
    excelColumn: string
    systemField: string | null
    sampleData: string[]
}

type ImportStep = 'mapping' | 'testing' | 'validating' | 'importing' | 'success' | 'error'

interface ValidationError {
    rowIndex: number
    errors: string[]
    fieldErrors: Record<string, string[]>
}

interface ResolutionHint {
    kind: 'category' | 'payment_term'
    value: string
    rowIndexes: number[]
}

export default function SupplierImportPage() {
    const { toast } = useToast()

    // State
    const [step, setStep] = useState<ImportStep>('mapping')
    const [file, setFile] = useState<File | null>(null)
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
    const [sheetNames, setSheetNames] = useState<string[]>([])
    const [selectedSheet, setSelectedSheet] = useState<string>('')
    const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState(true)
    const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
    const [errorMessage, setErrorMessage] = useState('')
    const [importResult, setImportResult] = useState<{ created: number; skipped?: number } | null>(null)
    const importStream = useImportStream()

    // Testing/Validation state
    const [isTesting, setIsTesting] = useState(false)
    const [hasTestedOnce, setHasTestedOnce] = useState(false)
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
    const [validRowCount, setValidRowCount] = useState(0)

    /** Celda vacía de términos de pago: usar el primero del sistema vs exigir texto */
    const [paymentTermsWhenEmpty, setPaymentTermsWhenEmpty] = useState<'default' | 'require'>('default')

    const [createCategories, setCreateCategories] = useState<string[]>([])
    const [createPaymentTerms, setCreatePaymentTerms] = useState<string[]>([])
    const [skipRowIndexes, setSkipRowIndexes] = useState<number[]>([])
    const [resolutionHints, setResolutionHints] = useState<ResolutionHint[]>([])
    const decisions = useImportDecisions(workbook, selectedSheet, columnMappings, useFirstRowAsHeader)

    // Parse selected sheet
    useEffect(() => {
        if (!workbook || !selectedSheet) return

        const sheet = workbook.Sheets[selectedSheet]
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            header: useFirstRowAsHeader ? undefined : 1,
            defval: ''
        })

        if (data.length === 0) {
            setColumnMappings([])
            return
        }

        const columns = Object.keys(data[0])
        const mappings: ColumnMapping[] = columns.map(col => {
            const samples = data.slice(0, 3).map(row => String(row[col] || ''))
            const lowerCol = col.toLowerCase().trim()
            let autoField: string | null = null

            if (
                lowerCol.includes('tipo_relacion') ||
                lowerCol.includes('party_type') ||
                lowerCol === 'relacion' ||
                (lowerCol.includes('rol') && lowerCol.includes('contacto'))
            )
                autoField = 'party_type'
            else if (
                lowerCol.includes('naturaleza') ||
                lowerCol.includes('tipo_entidad') ||
                lowerCol === 'entity_kind'
            )
                autoField = 'entity_kind'
            else if (lowerCol.includes('nombre') || lowerCol === 'name') autoField = 'name'
            else if (lowerCol.includes('contacto') || lowerCol === 'contact') autoField = 'contact'
            else if (lowerCol.includes('telefono') || lowerCol === 'phone') autoField = 'phone'
            else if (lowerCol.includes('email') || lowerCol.includes('correo')) autoField = 'email'
            else if (lowerCol.includes('direccion') || lowerCol === 'address') autoField = 'address'
            else if (lowerCol.includes('categor')) autoField = 'category'
            else if (lowerCol.includes('pago') || lowerCol.includes('payment')) autoField = 'payment_terms'
            else if (
                lowerCol.includes('fiscal') ||
                lowerCol.includes('nit') ||
                lowerCol === 'tax_id' ||
                lowerCol === 'rfc'
            )
                autoField = 'tax_id'

            return { excelColumn: col, systemField: autoField, sampleData: samples }
        })

        setColumnMappings(mappings)
    }, [workbook, selectedSheet, useFirstRowAsHeader])

    const handleFileChange = async (input: File | React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = input instanceof File ? input : input.target.files?.[0]
        if (!selectedFile) return
        const problem = validateImportFile(selectedFile)
        if (problem) { toast({ variant: 'destructive', title: 'Archivo no válido', description: problem }); return problem }
        try {
                const wb = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array', codepage: /\.csv$/i.test(selectedFile.name) ? 65001 : undefined })
                if (!wb.SheetNames.length) throw new Error('El archivo no contiene hojas')
                setWorkbook(wb)
                setStep('mapping')
                setImportResult(null)
                setErrorMessage('')
                setSheetNames(wb.SheetNames)
                setSelectedSheet(wb.SheetNames[0])
                setFile(selectedFile)
                setHasTestedOnce(false)
                setValidationErrors([])
                setCreateCategories([])
                setCreatePaymentTerms([])
                setSkipRowIndexes([])
                setResolutionHints([])
        } catch (err) {
            const message = err instanceof Error ? err.message : 'No se pudo leer el archivo'
            toast({ variant: 'destructive', title: 'Error', description: message })
            return message
        }
    }

    const executeValidate = async (overrides?: {
        createCategories?: string[]
        createPaymentTerms?: string[]
        skipRowIndexes?: number[]
        allowSimilarRowIndexes?: number[]
    }) => {
        if (!workbook || !selectedSheet) return

        const cats = overrides?.createCategories ?? createCategories
        const pts = overrides?.createPaymentTerms ?? createPaymentTerms
        const skips = overrides?.skipRowIndexes ?? [...new Set([...skipRowIndexes, ...decisions.options.skipRowIndexes])]
        const allows = overrides?.allowSimilarRowIndexes ?? decisions.options.allowSimilarRowIndexes

        setIsTesting(true)
        setStep('testing')

        try {
            const sheet = workbook.Sheets[selectedSheet]
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                header: useFirstRowAsHeader ? undefined : 1,
                defval: ''
            })

            const mappedData = data.map(row => {
                const mapped: Record<string, unknown> = {}
                columnMappings.forEach(mapping => {
                    if (mapping.systemField) {
                        mapped[mapping.systemField] = row[mapping.excelColumn]
                    }
                })
                return mapped
            })

            const token = localStorage.getItem('auth:token')
            const response = await fetch(`${getApiBaseUrl()}/suppliers/validate-import-mapped`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    suppliers: mappedData,
                    importOptions: {
                        paymentTermsWhenEmpty,
                        createCategories: cats,
                        createPaymentTerms: pts,
                        skipRowIndexes: skips,
                        allowSimilarRowIndexes: allows,
                    },
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                let errorMessage = 'Error al validar contactos'
                try {
                    const errorJson = JSON.parse(errorText)
                    errorMessage = errorJson.message || errorMessage
                    const rowErrors = readImportErrors(errorJson)
                    if (rowErrors.length) {
                        setValidationErrors(rowErrors.map(row => ({ ...row, fieldErrors: {} })))
                        setValidRowCount(0)
                        setHasTestedOnce(true)
                    }
                } catch {
                    errorMessage = errorText || `Error ${response.status}: ${response.statusText}`
                }
                throw new Error(errorMessage)
            }

            const result = await response.json()

            const hints: ResolutionHint[] = Array.isArray(result.resolutionHints)
                ? result.resolutionHints
                : []
            setResolutionHints(hints)

            if (result.invalidRows && result.invalidRows.length > 0) {
                const processed: ValidationError[] = result.invalidRows.map((row: { rowIndex: number; errors: string[] }) => {
                    const fieldErrors: Record<string, string[]> = {}
                    row.errors.forEach(error => {
                        if (error.includes('nombre')) fieldErrors.name = [...(fieldErrors.name || []), error]
                        else if (error.includes('contacto')) fieldErrors.contact = [...(fieldErrors.contact || []), error]
                        else if (error.includes('telefono')) fieldErrors.phone = [...(fieldErrors.phone || []), error]
                        else if (error.includes('email') || error.includes('Email')) fieldErrors.email = [...(fieldErrors.email || []), error]
                        else if (error.includes('direccion')) fieldErrors.address = [...(fieldErrors.address || []), error]
                        else if (error.includes('categoria') || error.includes('categoría') || error.includes('Categoría')) fieldErrors.category = [...(fieldErrors.category || []), error]
                        else if (error.includes('terminos') || error.includes('términos') || error.includes('Términos')) fieldErrors.payment_terms = [...(fieldErrors.payment_terms || []), error]
                        else if (
                            error.includes('tipo_relacion') ||
                            error.includes('Use proveedor o cliente')
                        )
                            fieldErrors.party_type = [...(fieldErrors.party_type || []), error]
                        else if (
                            error.includes('entidad') ||
                            error.includes('Tipo de entidad') ||
                            error.includes('naturaleza')
                        )
                            fieldErrors.entity_kind = [...(fieldErrors.entity_kind || []), error]
                        else if (error.includes('fiscal') || error.includes('tax')) fieldErrors.tax_id = [...(fieldErrors.tax_id || []), error]
                        else fieldErrors._general = [...(fieldErrors._general || []), error]
                    })
                    return { ...row, fieldErrors }
                })
                setValidationErrors(processed)
                setValidRowCount(result.totals.valid)
                const hintCount = hints.length
                toast({
                    title: 'Hay errores en el archivo',
                    description: hintCount > 0
                        ? `${result.totals.invalid} fila(s) con error. Use las acciones en «Comentarios» o los botones globales.`
                        : `${result.totals.invalid} fila(s) con errores.`,
                    variant: 'destructive',
                })
            } else {
                setValidationErrors([])
                setValidRowCount(result.totals.valid)
                const skipped = Number(result.totals?.skipped ?? 0)
                toast({
                    title: '¡Validación exitosa!',
                    description: skipped > 0
                        ? `${result.totals.valid} fila(s) lista(s); ${skipped} omitida(s) del archivo.`
                        : `${result.totals.valid} fila(s) válida(s).`,
                })
            }

            setHasTestedOnce(true)
            setStep('mapping')
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error al validar contactos'
            toast({
                title: 'Error de validación',
                description: errorMessage,
                variant: 'destructive'
            })
            setValidationErrors([{
                rowIndex: -1,
                errors: [errorMessage],
                fieldErrors: { _general: [errorMessage] }
            }])
            setHasTestedOnce(true)
            setValidRowCount(0)
            setResolutionHints([])
            setStep('mapping')
        } finally {
            setIsTesting(false)
        }
    }

    const handleTest = () => {
        void executeValidate()
    }

    const approveCreateCatalogValue = (h: ResolutionHint) => {
        const nextCats = h.kind === 'category'
            ? Array.from(new Set([...createCategories, h.value]))
            : createCategories
        const nextPts = h.kind === 'payment_term'
            ? Array.from(new Set([...createPaymentTerms, h.value]))
            : createPaymentTerms
        setCreateCategories(nextCats)
        setCreatePaymentTerms(nextPts)
        void executeValidate({
            createCategories: nextCats,
            createPaymentTerms: nextPts,
            skipRowIndexes,
        })
    }

    const omitRowsForHint = (h: ResolutionHint) => {
        const nextSkip = Array.from(new Set([...skipRowIndexes, ...h.rowIndexes]))
        setSkipRowIndexes(nextSkip)
        void executeValidate({
            createCategories,
            createPaymentTerms,
            skipRowIndexes: nextSkip,
        })
    }


    const handleImport = async () => {
        if (!workbook || !selectedSheet) return

        setStep('importing')
        setErrorMessage('')

        try {
            const sheet = workbook.Sheets[selectedSheet]
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                header: useFirstRowAsHeader ? undefined : 1,
                defval: ''
            })

            const mappedData: Record<string, unknown>[] = []
            data.forEach((row) => {
                const mapped: Record<string, unknown> = {}
                columnMappings.forEach(mapping => {
                    if (mapping.systemField) {
                        mapped[mapping.systemField] = row[mapping.excelColumn]
                    }
                })
                mappedData.push(mapped)
            })
            const result = await importStream.start<{ created: number; skipped?: number }>(`${getApiBaseUrl()}/suppliers/bulk-import-mapped-stream`, {
                    suppliers: mappedData,
                    importOptions: {
                        paymentTermsWhenEmpty,
                        createCategories,
                        createPaymentTerms,
                        skipRowIndexes: [...new Set([...skipRowIndexes, ...decisions.options.skipRowIndexes])],
                        allowSimilarRowIndexes: decisions.options.allowSimilarRowIndexes,
                    },
                }
            )
            setImportResult(result)
            setStep('success')
            toast({ title: '¡Importación exitosa!', description: `Se importaron ${result.created} contactos` })
        } catch (err) {
            const rowErrors = readImportErrors(err)
            if (rowErrors.length) { setValidationErrors(rowErrors.map(row => ({ ...row, fieldErrors: {} }))); setValidRowCount(0); setHasTestedOnce(true) }
            setErrorMessage(err instanceof Error && err.name === 'AbortError' ? 'Importación cancelada. Verifica los datos antes de reintentar; alguna fila pudo haberse guardado.' : err instanceof Error ? err.message : 'Error en importación')
            setStep('error')
        }
    }

    return <ImportWorkbench
        title="Importar contactos" description="Carga y valida proveedores y clientes antes de guardarlos para la empresa activa."
        back="/contactos" backLabel="Contactos" templatePath="/suppliers/template" templateName="plantilla_contactos.xlsx"
        file={file} onFile={selected => handleFileChange(selected)} sheetNames={sheetNames} selectedSheet={selectedSheet}
        onSheetChange={sheet => { setSelectedSheet(sheet); setHasTestedOnce(false); setValidationErrors([]); setResolutionHints([]); setCreateCategories([]); setCreatePaymentTerms([]); setSkipRowIndexes([]) }}
        useFirstRowAsHeader={useFirstRowAsHeader} onHeaderChange={checked => { setUseFirstRowAsHeader(checked); setHasTestedOnce(false); setValidationErrors([]); setResolutionHints([]); setCreateCategories([]); setCreatePaymentTerms([]); setSkipRowIndexes([]) }}
        fields={SYSTEM_FIELDS} mappings={columnMappings}
        onMappingChange={(field, column) => { setColumnMappings(previous => assignImportField(previous, field, column)); setHasTestedOnce(false); setValidationErrors([]); setResolutionHints([]); setCreateCategories([]); setCreatePaymentTerms([]); setSkipRowIndexes([]) }}
        rows={workbook && selectedSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[selectedSheet], { header: useFirstRowAsHeader ? undefined : 1, defval: '' }) : []}
        firstErrorIndex={2} validated={hasTestedOnce} validCount={validRowCount} errors={validationErrors} skippedRowIndexes={[...new Set([...skipRowIndexes, ...decisions.options.skipRowIndexes])]}
        onResolveRow={(row, action) => decisions.resolve(row, action, (options: ImportDecisions) => { const skips = [...new Set([...skipRowIndexes.filter(index => action !== 'restore' || index !== row), ...options.skipRowIndexes])]; setSkipRowIndexes(skips); return executeValidate({ ...options, skipRowIndexes: skips }) })}
        onValidate={handleTest} onImport={() => void handleImport()} busy={isTesting || step === 'validating' || step === 'importing'}
        progress={importStream.progress} onCancel={importStream.cancel}
        result={step === 'success' ? importResult : null} errorMessage={step === 'error' ? errorMessage : undefined}
        options={<div className="auna-import-options"><label className="auna-import-field">Términos de pago vacíos<select className="auna-control auna-control-select" value={paymentTermsWhenEmpty} onChange={event => { setPaymentTermsWhenEmpty(event.target.value as 'default' | 'require'); setHasTestedOnce(false); setValidationErrors([]); setResolutionHints([]); setCreateCategories([]); setCreatePaymentTerms([]); setSkipRowIndexes([]) }}><option value="default">Usar término por defecto</option><option value="require">Exigir valor en cada fila</option></select></label></div>}
        rowResolutionActions={row => resolutionHints.filter(hint => hint.rowIndexes.includes(row)).map(hint => <div key={`${hint.kind}:${hint.value}`} className="mt-2 text-foreground"><Button type="button" size="sm" variant="outline" disabled={isTesting} onClick={() => approveCreateCatalogValue(hint)}>Crear valor: {hint.value}</Button></div>)}
        resolutionActions={resolutionHints.length > 0 && <div className="auna-import-resolutions"><strong>Valores no encontrados en datos maestros</strong>{resolutionHints.map(hint => <div key={`${hint.kind}:${hint.value}`}><span>{hint.value} · filas {hint.rowIndexes.join(', ')}</span><Button type="button" variant="outline" size="sm" onClick={() => approveCreateCatalogValue(hint)} disabled={isTesting}>Crear valor</Button><Button type="button" variant="outline" size="sm" onClick={() => omitRowsForHint(hint)} disabled={isTesting}>Omitir filas</Button></div>)}</div>}
    />

}
