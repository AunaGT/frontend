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
 * - Categoría / términos desconocidos: validación falla hasta Crear en Datos maestros u Omitir filas
 * - importOptions: createCategories, createPaymentTerms, skipRowIndexes
 */
import { useState, useEffect, useMemo } from 'react'
import { getApiBaseUrl } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    FileSpreadsheet,
    Upload,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
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

const HR = () => <div className="border-t my-4" />

export default function SupplierImportPage() {
    const navigate = useNavigate()
    const { toast } = useToast()

    // State
    const [step, setStep] = useState<ImportStep>('mapping')
    const [file, setFile] = useState<File | null>(null)
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
    const [sheetNames, setSheetNames] = useState<string[]>([])
    const [selectedSheet, setSelectedSheet] = useState<string>('')
    const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState(true)
    const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
    const [importProgress, setImportProgress] = useState(0)
    const [errorMessage, setErrorMessage] = useState('')
    const [importResult, setImportResult] = useState<{ created: number; skipped?: number } | null>(null)

    // Testing/Validation state
    const [isTesting, setIsTesting] = useState(false)
    const [hasTestedOnce, setHasTestedOnce] = useState(false)
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
    const [validRowCount, setValidRowCount] = useState(0)
    const [totalRowCount, setTotalRowCount] = useState(0)

    /** Celda vacía de términos de pago: usar el primero del sistema vs exigir texto */
    const [paymentTermsWhenEmpty, setPaymentTermsWhenEmpty] = useState<'default' | 'require'>('default')

    const [createCategories, setCreateCategories] = useState<string[]>([])
    const [createPaymentTerms, setCreatePaymentTerms] = useState<string[]>([])
    const [skipRowIndexes, setSkipRowIndexes] = useState<number[]>([])
    const [resolutionHints, setResolutionHints] = useState<ResolutionHint[]>([])

    // Check for file in sessionStorage on mount
    useEffect(() => {
        const storedFileName = sessionStorage.getItem('import:fileName')
        const storedFileData = sessionStorage.getItem('import:fileData')

        if (storedFileName && storedFileData) {
            try {
                const binaryString = atob(storedFileData)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }

                const wb = XLSX.read(bytes.buffer, { type: 'array' })
                setWorkbook(wb)
                setSheetNames(wb.SheetNames)
                setSelectedSheet(wb.SheetNames[0])
                setFile({ name: storedFileName } as File)

                sessionStorage.removeItem('import:fileName')
                sessionStorage.removeItem('import:fileData')
            } catch (err) {
                console.error('Error loading file from sessionStorage:', err)
                navigate('/contactos')
            }
        } else {
            navigate('/contactos')
        }
    }, [navigate])

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

    const requiredFieldsMapped = useMemo(() => {
        const mappedFields = columnMappings.map(m => m.systemField).filter(Boolean)
        return SYSTEM_FIELDS.filter(f => f.required).every(f => mappedFields.includes(f.id))
    }, [columnMappings])

    const handleMappingChange = (excelColumn: string, systemField: string | null) => {
        setColumnMappings(prev => {
            const newMappings = prev.map(m => {
                if (m.systemField === systemField && systemField !== null) {
                    return { ...m, systemField: null }
                }
                return m
            })
            return newMappings.map(m =>
                m.excelColumn === excelColumn ? { ...m, systemField } : m
            )
        })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const data = event.target?.result
                const wb = XLSX.read(data, { type: 'array' })
                setWorkbook(wb)
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
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo leer el archivo' })
            }
        }
        reader.readAsArrayBuffer(selectedFile)
    }

    const executeValidate = async (overrides?: {
        createCategories?: string[]
        createPaymentTerms?: string[]
        skipRowIndexes?: number[]
    }) => {
        if (!workbook || !selectedSheet) return

        const cats = overrides?.createCategories ?? createCategories
        const pts = overrides?.createPaymentTerms ?? createPaymentTerms
        const skips = overrides?.skipRowIndexes ?? skipRowIndexes

        setIsTesting(true)
        setStep('testing')

        try {
            const sheet = workbook.Sheets[selectedSheet]
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                header: useFirstRowAsHeader ? undefined : 1,
                defval: ''
            })

            setTotalRowCount(data.length)

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
                    },
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                let errorMessage = 'Error al validar contactos'
                try {
                    const errorJson = JSON.parse(errorText)
                    errorMessage = errorJson.message || errorMessage
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
                    return { rowIndex: row.rowIndex, errors: row.errors, fieldErrors }
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


    const approveAllUnknownCatalogValues = () => {
        const catVals = resolutionHints.filter(h => h.kind === 'category').map(h => h.value)
        const ptVals = resolutionHints.filter(h => h.kind === 'payment_term').map(h => h.value)
        const nextCats = Array.from(new Set([...createCategories, ...catVals]))
        const nextPts = Array.from(new Set([...createPaymentTerms, ...ptVals]))
        setCreateCategories(nextCats)
        setCreatePaymentTerms(nextPts)
        void executeValidate({
            createCategories: nextCats,
            createPaymentTerms: nextPts,
            skipRowIndexes,
        })
    }

    const omitAllRowsAffectedByUnknownCatalog = () => {
        const allRows = Array.from(new Set(resolutionHints.flatMap(h => h.rowIndexes)))
        const nextSkip = Array.from(new Set([...skipRowIndexes, ...allRows]))
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
        setImportProgress(10)

        try {
            const sheet = workbook.Sheets[selectedSheet]
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                header: useFirstRowAsHeader ? undefined : 1,
                defval: ''
            })

            const total = data.length || 1

            const mappedData: Record<string, unknown>[] = []
            data.forEach((row, index) => {
                const mapped: Record<string, unknown> = {}
                columnMappings.forEach(mapping => {
                    if (mapping.systemField) {
                        mapped[mapping.systemField] = row[mapping.excelColumn]
                    }
                })
                mappedData.push(mapped)

                // 10% -> 60% según filas mapeadas
                if (index % 10 === 0) {
                    const progress = 10 + Math.round(((index + 1) / total) * 50)
                    setImportProgress(progress)
                }
            })

            const token = localStorage.getItem('auth:token')
            const response = await fetch(`${getApiBaseUrl()}/suppliers/bulk-import-mapped`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    suppliers: mappedData,
                    importOptions: {
                        paymentTermsWhenEmpty,
                        createCategories,
                        createPaymentTerms,
                        skipRowIndexes,
                    },
                })
            })

            setImportProgress(80)
            
            if (!response.ok) {
                const errorText = await response.text()
                let errorMessage = 'Error en importación'
                try {
                    const errorJson = JSON.parse(errorText)
                    errorMessage = errorJson.message || errorMessage
                } catch {
                    errorMessage = errorText || `Error ${response.status}: ${response.statusText}`
                }
                throw new Error(errorMessage)
            }

            const result = await response.json()

            setImportProgress(100)
            setImportResult(result)
            setStep('success')
            toast({ title: '¡Importación exitosa!', description: `Se importaron ${result.created} contactos` })
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Error en importación')
            setStep('error')
        }
    }

    const getFieldErrors = (systemField: string | null): string[] => {
        if (!systemField || !hasTestedOnce) return []
        const allErrors: string[] = []
        validationErrors.forEach(ve => {
            const fieldErrs = ve.fieldErrors[systemField]
            if (fieldErrs) fieldErrs.forEach(e => { if (!allErrors.includes(e)) allErrors.push(e) })
        })
        return allErrors
    }

    const getFieldErrorCount = (systemField: string | null): number => {
        if (!systemField || !hasTestedOnce) return 0
        let count = 0
        validationErrors.forEach(ve => { if (ve.fieldErrors[systemField]?.length) count++ })
        return count
    }

    // Hints / posibles errores por campo (para sección Comentarios)
    const getFieldHints = (systemField: string | null): string[] => {
        if (!systemField) return []

        switch (systemField) {
            case 'party_type':
                return [
                    'Opcional. Si no mapea esta columna, todas las filas se importan como proveedor.',
                    'Columna sugerida: tipo_relacion. Valores: proveedor o cliente.',
                    'Los clientes no requieren categoría; los proveedores sí.',
                ]
            case 'entity_kind':
                return [
                    'Opcional. Columna sugerida en plantilla: naturaleza_contacto.',
                    'Valores: empresa o persona (vacío = empresa). También acepta tipo_entidad.',
                    'Empresa: nombre = razón social y persona de contacto obligatoria.',
                    'Persona: nombre = nombre completo; contacto puede ir vacío.',
                ]
            case 'name':
                return [
                    'Debe estar lleno en todas las filas.',
                    'Razón social si es empresa, o nombre completo si es persona.',
                ]
            case 'contact':
                return [
                    'Obligatorio si la naturaleza es empresa.',
                    'Si es persona, puede omitirse; se usará el nombre.',
                ]
            case 'phone':
                return [
                    'Requerido. Incluye código de país si aplica.',
                    'Usa solo números, espacios y signos como + o -, sin texto adicional.',
                ]
            case 'email':
                return [
                    'Obligatorio para proveedores; opcional para clientes.',
                    'Si hay email, debe ser válido y único en el archivo y en el sistema.',
                ]
            case 'address':
                return [
                    'Requerido. Incluye al menos ciudad y zona/barrio.',
                    'Útil para rutas de reparto y reportes por ubicación.',
                ]
            case 'category':
                return [
                    'Solo proveedores: una o varias separadas por ; , o /.',
                    'Si el nombre no está en Datos maestros, «Probar» fallará hasta que elija «Crear» u «Omitir filas».',
                    'Clientes: puede omitir el mapeo.',
                ]
            case 'payment_terms':
                return [
                    'Texto que coincida con un término existente o que apruebe con «Crear» tras Probar.',
                    'Celda vacía: según la opción lateral, término por defecto o error.',
                ]
            case 'tax_id':
                return [
                    'Opcional. NIT, RFC, VAT u otro identificador fiscal.',
                ]
            default:
                return []
        }
    }

    // Render success state
    if (step === 'success' && importResult) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">¡Importación Exitosa!</h3>
                        <p className="text-muted-foreground mb-4">
                            Se importaron {importResult.created} contactos.
                            {importResult.skipped && importResult.skipped > 0 && ` ${importResult.skipped} fueron omitidos.`}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => navigate('/contactos')}>Ir a contactos</Button>
                            <Button onClick={() => { setStep('mapping'); setImportResult(null) }}>Importar Más</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Render error state
    if (step === 'error') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Error</h3>
                        <p className="text-muted-foreground mb-4">{errorMessage}</p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => navigate('/contactos')}>Cancelar</Button>
                            <Button onClick={() => setStep('mapping')}>Intentar de nuevo</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Render importing state
    if (step === 'importing' || step === 'validating') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Importando contactos...</h3>
                        <Progress value={importProgress} className="mt-4" />
                        <p className="text-sm text-muted-foreground mt-2">{importProgress}%</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Render mapping UI
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-card">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/contactos')}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleImport}
                                    disabled={
                                        !requiredFieldsMapped ||
                                        isTesting ||
                                        !hasTestedOnce ||
                                        validationErrors.length > 0
                                    }
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Importar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTest}
                                    disabled={!requiredFieldsMapped || isTesting}
                                >
                                    {isTesting ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Probando...</>
                                    ) : (
                                        'Probar'
                                    )}
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                    <label className="cursor-pointer">
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Cargar otro archivo
                                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                                    </label>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/contactos')}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Contactos / Importar
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="col-span-3">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">Datos a importar</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                    <span className="truncate">{file?.name}</span>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Hoja:</Label>
                                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar hoja" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sheetNames.map(name => (
                                                <SelectItem key={name} value={name}>{name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="useHeader"
                                        checked={useFirstRowAsHeader}
                                        onCheckedChange={(checked) => setUseFirstRowAsHeader(checked as boolean)}
                                    />
                                    <Label htmlFor="useHeader" className="text-xs">
                                        Utilizar la primera fila como encabezado
                                    </Label>
                                </div>

                                <HR />

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Términos de pago vacíos</p>
                                    <Select
                                        value={paymentTermsWhenEmpty}
                                        onValueChange={(v) => {
                                            setPaymentTermsWhenEmpty(v as 'default' | 'require')
                                            setHasTestedOnce(false)
                                            setValidationErrors([])
                                            setCreateCategories([])
                                            setCreatePaymentTerms([])
                                            setSkipRowIndexes([])
                                            setResolutionHints([])
                                        }}
                                    >
                                        <SelectTrigger className="text-xs h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">
                                                Usar término por defecto del sistema (omitir celda vacía)
                                            </SelectItem>
                                            <SelectItem value="require">
                                                Exigir valor en cada fila
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                        Si «Probar» marca categoría o término inexistente, elija crear el valor en Datos maestros u omitir las filas del Excel .
                                    </p>
                                </div>

                                <HR />

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Ayuda</p>
                                    <a
                                        href={`${getApiBaseUrl()}/suppliers/template`}
                                        className="text-xs text-primary hover:underline block"
                                    >
                                        Descargar plantilla de contactos (.xlsx)
                                    </a>
                                </div>

                                <HR />

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Estado del mapeo</p>
                                    {SYSTEM_FIELDS.filter(f => f.required).map(field => {
                                        const isMapped = columnMappings.some(m => m.systemField === field.id)
                                        return (
                                            <div key={field.id} className="flex items-center gap-2 text-xs">
                                                {isMapped ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                ) : (
                                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                                )}
                                                <span className={isMapped ? 'text-green-600' : 'text-orange-500'}>
                                                    {field.label} {!isMapped && '(requerido)'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content - Column Mapping */}
                    <div className="col-span-9">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium">Mapeo de columnas</CardTitle>
                                    <Badge variant="outline">
                                        {columnMappings.filter(m => m.systemField).length} / {columnMappings.length} columnas mapeadas
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {hasTestedOnce && resolutionHints.length > 0 && (
                                    <div className="mb-4 space-y-2 rounded-md border border-orange-200 bg-orange-50/90 p-3">
                                        <p className="text-sm font-medium text-orange-950">
                                            ¿Qué hacer con datos que no existen en Datos maestros?
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Aplique a todos los valores detectados, o use los botones por columna en «Comentarios».
                                        </p>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                                                onClick={approveAllUnknownCatalogValues}
                                                disabled={isTesting}
                                            >
                                                Crear todos los valores nuevos
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={omitAllRowsAffectedByUnknownCatalog}
                                                disabled={isTesting}
                                            >
                                                Omitir todas las filas afectadas
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <ScrollArea className="h-[calc(100vh-280px)]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[200px]">Columna del archivo</TableHead>
                                                <TableHead className="w-[250px]">Campo del Sistema</TableHead>
                                                <TableHead>Comentarios</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {columnMappings.map((mapping) => {
                                                const field = SYSTEM_FIELDS.find(f => f.id === mapping.systemField)
                                                const errorCount = getFieldErrorCount(mapping.systemField)

                                                return (
                                                    <TableRow key={mapping.excelColumn}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">{mapping.excelColumn}</p>
                                                                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                                                    {mapping.sampleData[0] || '(vacío)'}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={mapping.systemField || 'no-mapear'}
                                                                onValueChange={(val) => handleMappingChange(mapping.excelColumn, val === 'no-mapear' ? null : val)}
                                                            >
                                                                <SelectTrigger className={errorCount > 0 ? 'border-destructive' : ''}>
                                                                    <SelectValue placeholder="No importar" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="no-mapear">No importar</SelectItem>
                                                                    {SYSTEM_FIELDS.map(f => (
                                                                        <SelectItem key={f.id} value={f.id}>
                                                                            {f.label} {f.required && '*'}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-2">
                                                                {field?.required && (
                                                                    <span className="text-xs text-muted-foreground">Requerido</span>
                                                                )}
                                                                {hasTestedOnce && mapping.systemField && errorCount > 0 && (
                                                                    <div className="space-y-1">
                                                                        {getFieldErrors(mapping.systemField).slice(0, 4).map((err, i) => (
                                                                            <p key={i} className="text-xs text-destructive">{err}</p>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Acciones junto al error (categoría / términos) */}
                                                                {hasTestedOnce && mapping.systemField === 'category' &&
                                                                    resolutionHints.filter(h => h.kind === 'category').length > 0 && (
                                                                    <div className="mt-2 space-y-2 rounded-md border border-orange-100 bg-orange-50/50 p-2">
                                                                        <p className="text-[11px] font-medium text-orange-900">
                                                                            Valores de categoría no encontrados:
                                                                        </p>
                                                                        {resolutionHints.filter(h => h.kind === 'category').map(h => (
                                                                            <div key={`${h.value}-${h.rowIndexes.join(',')}`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                                                                <span className="text-xs break-words">
                                                                                    «{h.value}» <span className="text-muted-foreground">(filas {h.rowIndexes.join(', ')})</span>
                                                                                </span>
                                                                                <div className="flex shrink-0 gap-1.5">
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="sm"
                                                                                        className="h-7 text-xs px-2 bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                                                                                        onClick={() => approveCreateCatalogValue(h)}
                                                                                        disabled={isTesting}
                                                                                    >
                                                                                        Crear
                                                                                    </Button>
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="h-7 text-xs px-2"
                                                                                        onClick={() => omitRowsForHint(h)}
                                                                                        disabled={isTesting}
                                                                                    >
                                                                                        Omitir filas
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {hasTestedOnce && mapping.systemField === 'payment_terms' &&
                                                                    resolutionHints.filter(h => h.kind === 'payment_term').length > 0 && (
                                                                    <div className="mt-2 space-y-2 rounded-md border border-orange-100 bg-orange-50/50 p-2">
                                                                        <p className="text-[11px] font-medium text-orange-900">
                                                                            Términos de pago no encontrados:
                                                                        </p>
                                                                        {resolutionHints.filter(h => h.kind === 'payment_term').map(h => (
                                                                            <div key={`${h.value}-${h.rowIndexes.join(',')}`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                                                                <span className="text-xs break-words">
                                                                                    «{h.value}» <span className="text-muted-foreground">(filas {h.rowIndexes.join(', ')})</span>
                                                                                </span>
                                                                                <div className="flex shrink-0 gap-1.5">
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="sm"
                                                                                        className="h-7 text-xs px-2 bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                                                                                        onClick={() => approveCreateCatalogValue(h)}
                                                                                        disabled={isTesting}
                                                                                    >
                                                                                        Crear
                                                                                    </Button>
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="h-7 text-xs px-2"
                                                                                        onClick={() => omitRowsForHint(h)}
                                                                                        disabled={isTesting}
                                                                                    >
                                                                                        Omitir filas
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Hints estáticos por campo */}
                                                                {mapping.systemField && getFieldHints(mapping.systemField).length > 0 && (
                                                                    <ul className="text-xs text-muted-foreground space-y-0.5">
                                                                        {getFieldHints(mapping.systemField).map((hint, idx) => (
                                                                            <li key={idx}>• {hint}</li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>

                                {/* Validation Summary */}
                                {hasTestedOnce && (
                                    <div className={`mt-4 p-3 rounded-md ${validationErrors.length > 0 ? 'bg-destructive/10' : 'bg-green-50'}`}>
                                                {validationErrors.length > 0 ? (
                                            <p className="text-sm text-destructive flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4" />
                                                {validationErrors.length} filas con errores. Resuelva categoría/términos en «Comentarios» o con los botones globales encima del cuadro.
                                            </p>
                                        ) : (
                                            <p className="text-sm text-green-700 flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                ¡Validación exitosa! {validRowCount} filas listas para importar.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
