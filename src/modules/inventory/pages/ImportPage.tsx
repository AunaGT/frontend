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
 * ImportPage - Advanced import page with column mapping
 * 
 * Features:
 * - Sheet selector for multi-sheet Excel files
 * - Column mapping with system field dropdowns
 * - Preview of first row data per column
 * - Real-time validation feedback
 */
import { useState, useEffect, useMemo } from 'react'
import { apiFetch, getApiBaseUrl, getAuthToken } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { fetchWarehouses } from '@/services/warehouseService'
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

// System fields available for mapping
const SYSTEM_FIELDS = [
    { id: 'name', label: 'Nombre', required: true, type: 'string' },
    { id: 'category', label: 'Categoría', required: true, type: 'relation' },
    { id: 'supplier', label: 'Proveedor', required: true, type: 'relation' },
    { id: 'price', label: 'Precio', required: true, type: 'number' },
    { id: 'cost', label: 'Costo', required: false, type: 'number' },
    { id: 'stock', label: 'Stock', required: false, type: 'number' },
    { id: 'min_stock', label: 'Stock Mínimo', required: false, type: 'number' },
    { id: 'brand', label: 'Marca', required: false, type: 'string' },
    { id: 'size', label: 'Tamaño', required: false, type: 'string' },
    { id: 'barcode', label: 'Código de Barras', required: false, type: 'string' },
    { id: 'description', label: 'Descripción', required: false, type: 'string' },
    { id: 'available_for_sale', label: 'Disponible para la venta', required: false, type: 'boolean' },
    { id: 'tracks_expiry', label: 'Controla lotes y caducidad', required: false, type: 'boolean' },
]

interface ColumnMapping {
    excelColumn: string
    systemField: string | null
    sampleData: string[]
}

type ImportStep = 'mapping' | 'testing' | 'validating' | 'importing' | 'success' | 'error'

// Validation error per row with field-specific errors
interface ValidationError {
    rowIndex: number
    errors: string[]
    fieldErrors: Record<string, string[]>  // field name -> errors
}

interface ResolutionHint {
    kind: 'category' | 'supplier'
    value: string
    rowIndexes: number[]
}

export default function ImportPage() {
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

    const [createCategories, setCreateCategories] = useState<string[]>([])
    const [createSuppliers, setCreateSuppliers] = useState<string[]>([])
    const [importLocation, setImportLocation] = useState('default')

    // El catálogo es de la empresa, pero las existencias del archivo caen en la
    // sucursal activa: hay que decir en cuál, y dejar elegir el anaquel.
    const { branch } = useTenant()
    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses', branch?.id],
        queryFn: () => fetchWarehouses(),
        enabled: Boolean(branch),
    })
    const importLocations = useMemo(
        () =>
            warehouses
                .filter((w) => w.active)
                .flatMap((w) => w.locations.filter((l) => l.active).map((l) => ({ ...l, warehouse: w.name }))),
        [warehouses]
    )
    const [skipRowIndexes, setSkipRowIndexes] = useState<number[]>([])
    const [resolutionHints, setResolutionHints] = useState<ResolutionHint[]>([])

    // Check for file in sessionStorage on mount
    useEffect(() => {
        const storedFileName = sessionStorage.getItem('import:fileName')
        const storedFileData = sessionStorage.getItem('import:fileData')

        if (storedFileName && storedFileData) {
            try {
                // Convert base64 back to ArrayBuffer
                const binaryString = atob(storedFileData)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }

                const wb = XLSX.read(bytes.buffer, { type: 'array' })
                setWorkbook(wb)
                setSheetNames(wb.SheetNames)
                setSelectedSheet(wb.SheetNames[0])

                // Create a mock file object for display
                setFile({ name: storedFileName } as File)

                // Clear sessionStorage
                sessionStorage.removeItem('import:fileName')
                sessionStorage.removeItem('import:fileData')
            } catch (err) {
                console.error('Error loading file from sessionStorage:', err)
                navigate('/inventario')
            }
        } else {
            // No file provided, redirect back
            navigate('/inventario')
        }
    }, [navigate])

    // Parse selected sheet and extract columns
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

        // Get column names from first row keys
        const columns = Object.keys(data[0])

        // Create mappings with sample data
        const mappings: ColumnMapping[] = columns.map(col => {
            const samples = data.slice(0, 3).map(row => String(row[col] || ''))

            // Auto-detect mapping based on column name
            const lowerCol = col.toLowerCase().trim()
            let autoField: string | null = null

            if (lowerCol.includes('nombre') || lowerCol === 'name') autoField = 'name'
            else if (lowerCol.includes('categor')) autoField = 'category'
            else if (lowerCol.includes('proveedor') || lowerCol.includes('supplier')) autoField = 'supplier'
            else if (lowerCol.includes('precio') || lowerCol === 'price') autoField = 'price'
            else if (lowerCol.includes('costo') || lowerCol === 'cost') autoField = 'cost'
            else if (lowerCol.includes('stock') && !lowerCol.includes('min')) autoField = 'stock'
            else if (lowerCol.includes('stock_min') || lowerCol.includes('minimo')) autoField = 'min_stock'
            else if (lowerCol.includes('marca') || lowerCol === 'brand') autoField = 'brand'
            else if (lowerCol.includes('tama') || lowerCol === 'size') autoField = 'size'
            else if (lowerCol.includes('codigo') || lowerCol.includes('barcode') || lowerCol.includes('barras')) autoField = 'barcode'
            else if (lowerCol.includes('descr')) autoField = 'description'
            else if (lowerCol.includes('disponible')) autoField = 'available_for_sale'
            else if (lowerCol.includes('caduc') || lowerCol.includes('lote')) autoField = 'tracks_expiry'

            return {
                excelColumn: col,
                systemField: autoField,
                sampleData: samples
            }
        })

        setColumnMappings(mappings)
    }, [workbook, selectedSheet, useFirstRowAsHeader])

    // Check if required fields are mapped
    const requiredFieldsMapped = useMemo(() => {
        const mappedFields = columnMappings.map(m => m.systemField).filter(Boolean)
        return SYSTEM_FIELDS
            .filter(f => f.required)
            .every(f => mappedFields.includes(f.id))
    }, [columnMappings])

    // Update a column mapping
    const updateMapping = (excelColumn: string, systemField: string | null) => {
        setColumnMappings(prev => prev.map(m =>
            m.excelColumn === excelColumn
                ? { ...m, systemField }
                : m
        ))
    }

    // Handle file drop (for re-upload)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const selectedFile = files[0]
        setFile(selectedFile)

        try {
            const buffer = await selectedFile.arrayBuffer()
            const wb = XLSX.read(buffer, { type: 'array' })
            setWorkbook(wb)
            setSheetNames(wb.SheetNames)
            setSelectedSheet(wb.SheetNames[0])
            setHasTestedOnce(false)
            setValidationErrors([])
            setCreateCategories([])
            setCreateSuppliers([])
            setSkipRowIndexes([])
            setResolutionHints([])
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo leer el archivo'
            })
        }
    }

    const buildMappedRows = (): Record<string, unknown>[] => {
        if (!workbook || !selectedSheet) return []
        const sheet = workbook.Sheets[selectedSheet]
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            header: useFirstRowAsHeader ? undefined : 1,
            defval: '',
        })
        return data.map(row => {
            const mapped: Record<string, unknown> = {}
            columnMappings.forEach(mapping => {
                if (mapping.systemField) {
                    mapped[mapping.systemField] = row[mapping.excelColumn]
                }
            })
            return mapped
        })
    }

    const executeValidate = async (overrides?: {
        createCategories?: string[]
        createSuppliers?: string[]
        skipRowIndexes?: number[]
    }) => {
        if (!workbook || !selectedSheet) return

        const cats = overrides?.createCategories ?? createCategories
        const sups = overrides?.createSuppliers ?? createSuppliers
        const skips = overrides?.skipRowIndexes ?? skipRowIndexes

        setIsTesting(true)
        setStep('testing')

        try {
            const sheet = workbook.Sheets[selectedSheet]
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                header: useFirstRowAsHeader ? undefined : 1,
                defval: '',
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

            const token = getAuthToken()
            const response = await fetch(`${getApiBaseUrl()}/products/validate-import-mapped`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    products: mappedData,
                    importOptions: {
                        createCategories: cats,
                        createSuppliers: sups,
                        skipRowIndexes: skips,
                    },
                }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                let msg = 'Error al validar productos'
                try {
                    const j = JSON.parse(errorText) as { message?: string }
                    msg = j.message || msg
                } catch {
                    msg = errorText || `Error ${response.status}`
                }
                throw new Error(msg)
            }

            const result = (await response.json()) as {
                invalidRows?: Array<{ rowIndex: number; errors: string[] }>
                totals?: { valid: number; invalid?: number; skipped?: number; total?: number }
                resolutionHints?: ResolutionHint[]
            }

            const hints: ResolutionHint[] = Array.isArray(result.resolutionHints)
                ? result.resolutionHints
                : []
            setResolutionHints(hints)

            if (result.invalidRows && result.invalidRows.length > 0) {
                const processed: ValidationError[] = result.invalidRows.map(row => {
                    const fieldErrors: Record<string, string[]> = {}
                    row.errors.forEach(error => {
                        if (error.includes('nombre')) fieldErrors.name = [...(fieldErrors.name || []), error]
                        else if (error.includes('categoria') || error.includes('Categoría')) fieldErrors.category = [...(fieldErrors.category || []), error]
                        else if (error.includes('proveedor') || error.includes('Proveedor')) fieldErrors.supplier = [...(fieldErrors.supplier || []), error]
                        else if (error.includes('precio')) fieldErrors.price = [...(fieldErrors.price || []), error]
                        else if (error.includes('costo')) fieldErrors.cost = [...(fieldErrors.cost || []), error]
                        else if (error.includes('stock') && !error.includes('mínimo')) fieldErrors.stock = [...(fieldErrors.stock || []), error]
                        else if (error.includes('stock mínimo') || error.includes('minimo')) fieldErrors.min_stock = [...(fieldErrors.min_stock || []), error]
                        else if (error.includes('código') || error.includes('barras')) fieldErrors.barcode = [...(fieldErrors.barcode || []), error]
                        else fieldErrors._general = [...(fieldErrors._general || []), error]
                    })
                    return { rowIndex: row.rowIndex, errors: row.errors, fieldErrors }
                })
                setValidationErrors(processed)
                setValidRowCount(result.totals?.valid ?? 0)
                const hintCount = hints.length
                toast({
                    variant: 'destructive',
                    title: 'Hay errores en el archivo',
                    description: hintCount > 0
                        ? `${result.totals?.invalid ?? result.invalidRows.length} fila(s) con error. Use «Comentarios» o los botones globales.`
                        : `${result.invalidRows.length} fila(s) con errores.`,
                })
            } else {
                setValidationErrors([])
                setValidRowCount(result.totals?.valid ?? data.length)
                const skipped = Number(result.totals?.skipped ?? 0)
                toast({
                    title: '¡Validación exitosa!',
                    description: skipped > 0
                        ? `${result.totals?.valid ?? 0} fila(s) lista(s); ${skipped} omitida(s) del archivo.`
                        : `${result.totals?.valid ?? data.length} fila(s) válida(s).`,
                })
            }

            setHasTestedOnce(true)
            setStep('mapping')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al validar productos'
            toast({ title: 'Error de validación', description: msg, variant: 'destructive' })
            setValidationErrors([{ rowIndex: -1, errors: [msg], fieldErrors: { _general: [msg] } }])
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
        const nextCats =
            h.kind === 'category'
                ? Array.from(new Set([...createCategories, h.value]))
                : createCategories
        const nextSups =
            h.kind === 'supplier'
                ? Array.from(new Set([...createSuppliers, h.value]))
                : createSuppliers
        setCreateCategories(nextCats)
        setCreateSuppliers(nextSups)
        void executeValidate({
            createCategories: nextCats,
            createSuppliers: nextSups,
            skipRowIndexes,
        })
    }

    const omitRowsForHint = (h: ResolutionHint) => {
        const nextSkip = Array.from(new Set([...skipRowIndexes, ...h.rowIndexes]))
        setSkipRowIndexes(nextSkip)
        void executeValidate({
            createCategories,
            createSuppliers,
            skipRowIndexes: nextSkip,
        })
    }

    const approveAllUnknownCatalogValues = () => {
        const catVals = resolutionHints.filter(h => h.kind === 'category').map(h => h.value)
        const supVals = resolutionHints.filter(h => h.kind === 'supplier').map(h => h.value)
        const nextCats = Array.from(new Set([...createCategories, ...catVals]))
        const nextSups = Array.from(new Set([...createSuppliers, ...supVals]))
        setCreateCategories(nextCats)
        setCreateSuppliers(nextSups)
        void executeValidate({
            createCategories: nextCats,
            createSuppliers: nextSups,
            skipRowIndexes,
        })
    }

    const omitAllRowsAffectedByUnknownCatalog = () => {
        const allRows = Array.from(new Set(resolutionHints.flatMap(h => h.rowIndexes)))
        const nextSkip = Array.from(new Set([...skipRowIndexes, ...allRows]))
        setSkipRowIndexes(nextSkip)
        void executeValidate({
            createCategories,
            createSuppliers,
            skipRowIndexes: nextSkip,
        })
    }

    const handleImport = async () => {
        if (!workbook || !selectedSheet) return

        setStep('validating')
        setImportProgress(10)

        try {
            const mappedData = buildMappedRows()
            const total = mappedData.length || 1

            mappedData.forEach((_, index) => {
                if (index % 10 === 0) {
                    setImportProgress(10 + Math.round(((index + 1) / total) * 50))
                }
            })

            setStep('importing')
            setImportProgress(65)

            const result = await apiFetch<{ created: number; adopted?: number; skipped?: number; message?: string }>(
                '/products/bulk-import-mapped',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        products: mappedData,
                        location_id: importLocation === 'default' ? undefined : importLocation,
                        importOptions: {
                            createCategories,
                            createSuppliers,
                            skipRowIndexes,
                        },
                    }),
                }
            )

            setImportProgress(100)
            setImportResult(result)
            setStep('success')

            toast({
                title: '¡Importación exitosa!',
                description: result.message ?? `Se importaron ${result.created} productos`,
            })
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'Error en importación')
            setStep('error')
        }
    }

    // Get errors for a specific column/field
    const getFieldErrors = (systemField: string | null): string[] => {
        if (!systemField || !hasTestedOnce) return []

        const allErrors: string[] = []
        validationErrors.forEach(ve => {
            const fieldErrs = ve.fieldErrors[systemField]
            if (fieldErrs) {
                // Add row number to error
                fieldErrs.forEach(e => {
                    if (!allErrors.includes(e)) allErrors.push(e)
                })
            }
        })
        return allErrors
    }

    // Get count of errors for a field
    const getFieldErrorCount = (systemField: string | null): number => {
        if (!systemField || !hasTestedOnce) return 0

        let count = 0
        validationErrors.forEach(ve => {
            if (ve.fieldErrors[systemField]?.length) count++
        })
        return count
    }

    // Possible error/hint messages per field (shown in comentarios)
    const getFieldHints = (systemField: string | null): string[] => {
        if (!systemField) return []

        switch (systemField) {
            case 'name':
                return [
                    'Debe estar lleno en todas las filas.',
                    'Mínimo 2 caracteres, evita nombres genéricos como "Producto 1".',
                ]
            case 'category':
                return [
                    'Si el nombre no está en Datos maestros, «Probar» fallará hasta «Crear categoría» u «Omitir filas».',
                    'Puede crear el valor en Datos maestros desde esta pantalla sin salir del import.',
                ]
            case 'supplier':
                return [
                    'Solo se consideran contactos con tipo proveedor.',
                    'Si no existe, use «Crear» para darlo de alta con datos mínimos u «Omitir filas».',
                ]
            case 'price':
                return [
                    'Requerido y debe ser un número mayor a 0.',
                    'Usa punto como separador decimal (por ejemplo, 25.50).',
                ]
            case 'cost':
                return [
                    'Opcional, pero si se indica debe ser un número mayor o igual a 0.',
                    'Útil para calcular márgenes y reportes de rentabilidad.',
                ]
            case 'stock':
                return [
                    'Opcional; si se deja vacío se tomará 0.',
                    'Debe ser un número entero mayor o igual a 0 (sin decimales).',
                ]
            case 'min_stock':
                return [
                    'Opcional; si se deja vacío se tomará 0.',
                    'Debe ser un número entero mayor o igual a 0. Se usa para alertas de stock bajo.',
                ]
            case 'brand':
                return [
                    'Opcional. Ideal para agrupar productos por marca en reportes y filtros.',
                ]
            case 'barcode':
                return [
                    'Opcional, pero si existe debe ser único en todo el sistema.',
                    'No debe repetirse ni en el archivo ni en productos ya cargados.',
                ]
            case 'description':
                return [
                    'Opcional. Úsala para detalles adicionales que ayuden en la búsqueda.',
                ]
            default:
                return []
        }
    }

    // Get available fields (not yet mapped)
    const getAvailableFields = (currentColumn: string) => {
        const usedFields = columnMappings
            .filter(m => m.excelColumn !== currentColumn && m.systemField)
            .map(m => m.systemField)

        return SYSTEM_FIELDS.filter(f => !usedFields.includes(f.id))
    }

    // Render mapping UI (incluye 'testing' mientras revalidamos tras Crear/Omitir)
    if (step === 'mapping' || step === 'testing') {
        return (
            <div className="min-h-screen bg-background">
                {/* Header */}
                <div className="border-b bg-card">
                    <div className="container mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" onClick={() => navigate('/inventario')}>
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
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => navigate('/inventario')}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Productos / Importar un archivo
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
                                    {/* A dónde va lo que trae el archivo */}
                                    <div className="rounded-md border bg-muted/40 p-2 text-xs space-y-2">
                                        <p className="text-muted-foreground">
                                            Los productos se crean en el catálogo de la empresa. Las
                                            existencias del archivo se cargan en{' '}
                                            <span className="font-medium text-foreground">{branch?.name ?? 'la sucursal activa'}</span>.
                                        </p>
                                        {importLocations.length > 1 ? (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Ubicación:</Label>
                                                <Select value={importLocation} onValueChange={setImportLocation}>
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="default">Ubicación de recepción por defecto</SelectItem>
                                                        {importLocations.map((l) => (
                                                            <SelectItem key={l.id} value={l.id}>
                                                                {l.warehouse} · {l.code}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : importLocations.length === 1 ? (
                                            <p className="text-muted-foreground">
                                                Entran a <span className="font-mono">{importLocations[0].warehouse} · {importLocations[0].code}</span>.
                                            </p>
                                        ) : null}
                                        <p className="text-muted-foreground">
                                            Si un código de barras ya está en el catálogo, no se duplica:
                                            se le carga esa existencia aquí.
                                        </p>
                                    </div>

                                    {/* File info */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                        <span className="truncate">{file?.name}</span>
                                    </div>

                                    {/* Sheet selector */}
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

                                    {/* First row as header */}
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
                                        <p className="text-xs font-medium text-muted-foreground">Datos maestros</p>
                                        <p className="text-[11px] text-muted-foreground leading-snug">
                                            Si «Probar» detecta categoría o proveedor inexistente, elija crear el valor o omitir las filas del Excel (mismo criterio que en importación de contactos).
                                        </p>
                                    </div>

                                    <HR />

                                    {/* Help section */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">Ayuda</p>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                            📄 Plantilla de importación para productos
                                        </Button>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                            ❓ Preguntas frecuentes de importación
                                        </Button>
                                    </div>

                                    <HR />

                                    {/* Validation status */}
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
                                                ¿Qué hacer con categorías o proveedores que no existen?
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
                                                                    value={mapping.systemField || '__none__'}
                                                                    onValueChange={(value) => updateMapping(mapping.excelColumn, value === '__none__' ? null : value)}
                                                                >
                                                                    <SelectTrigger className={!mapping.systemField ? 'border-orange-300 text-orange-600' : ''}>
                                                                        <SelectValue placeholder="Para importar, seleccione un campo..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="__none__">No importar</SelectItem>
                                                                        {getAvailableFields(mapping.excelColumn).map(field => (
                                                                            <SelectItem key={field.id} value={field.id}>
                                                                                {field.label} {field.required && '*'}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell className="min-w-[300px]">
                                                                <div className="space-y-2">
                                                                    {/* Error badge - professional, no emoji */}
                                                                    {hasTestedOnce && mapping.systemField && getFieldErrorCount(mapping.systemField) > 0 && (
                                                                        <Badge variant="destructive" className="text-xs font-medium">
                                                                            {getFieldErrorCount(mapping.systemField)} error(es)
                                                                        </Badge>
                                                                    )}

                                                                    {/* Error messages */}
                                                                    {hasTestedOnce && mapping.systemField && getFieldErrors(mapping.systemField).length > 0 && (
                                                                        <div className="space-y-1">
                                                                            {getFieldErrors(mapping.systemField).slice(0, 2).map((err, i) => (
                                                                                <p key={i} className="text-xs text-red-600">{err}</p>
                                                                            ))}
                                                                            {getFieldErrors(mapping.systemField).length > 2 && (
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    + {getFieldErrors(mapping.systemField).length - 2} error(es) más
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {hasTestedOnce && mapping.systemField === 'category' &&
                                                                        resolutionHints.filter(h => h.kind === 'category').length > 0 && (
                                                                        <div className="mt-2 space-y-2 rounded-md border border-orange-100 bg-orange-50/50 p-2">
                                                                            <p className="text-[11px] font-medium text-orange-900">
                                                                                Categorías no encontradas:
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
                                                                    {hasTestedOnce && mapping.systemField === 'supplier' &&
                                                                        resolutionHints.filter(h => h.kind === 'supplier').length > 0 && (
                                                                        <div className="mt-2 space-y-2 rounded-md border border-orange-100 bg-orange-50/50 p-2">
                                                                            <p className="text-[11px] font-medium text-orange-900">
                                                                                Proveedores no encontrados:
                                                                            </p>
                                                                            {resolutionHints.filter(h => h.kind === 'supplier').map(h => (
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

                                                                    {/* Relation hint - show before testing */}
                                                                    {field?.type === 'relation' && !hasTestedOnce && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Para múltiples valores, sepárelos con coma.
                                                                        </p>
                                                                    )}

                                                                    {/* Static hints about common errors per field */}
                                                                    {mapping.systemField && getFieldHints(mapping.systemField).length > 0 && (
                                                                        <ul className="text-xs text-muted-foreground space-y-0.5">
                                                                            {getFieldHints(mapping.systemField).map((hint, idx) => (
                                                                                <li key={idx}>• {hint}</li>
                                                                            ))}
                                                                        </ul>
                                                                    )}

                                                                    {/* Required badge */}
                                                                    {field?.required && (
                                                                        <Badge variant="outline" className="text-xs">Requerido</Badge>
                                                                    )}

                                                                    {/* Success indicator */}
                                                                    {hasTestedOnce && mapping.systemField && getFieldErrorCount(mapping.systemField) === 0 && (
                                                                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                                                            <CheckCircle2 className="h-3 w-3 mr-1" />Válido
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>

                                    {hasTestedOnce && (
                                        <div className={`mt-4 p-3 rounded-md ${validationErrors.length > 0 ? 'bg-destructive/10' : 'bg-green-50'}`}>
                                            {validationErrors.length > 0 ? (
                                                <p className="text-sm text-destructive flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    {validationErrors.length} filas con errores. Resuelva categoría/proveedor en «Comentarios» o con los botones globales.
                                                </p>
                                            ) : (
                                                <p className="text-sm text-green-700 flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    ¡Validación exitosa! {validRowCount} fila(s) lista(s) para importar.
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

    // Loading/importing state
    if (step === 'validating' || step === 'importing') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12">
                        <div className="flex flex-col items-center gap-6">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <div className="text-center space-y-2">
                                <p className="font-medium">
                                    {step === 'validating' ? 'Validando datos...' : 'Importando productos...'}
                                </p>
                                <Progress value={importProgress} className="w-64" />
                                <p className="text-sm text-muted-foreground">
                                    Por favor, no cierre esta ventana
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Success state
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12">
                        <div className="flex flex-col items-center gap-6">
                            <div className="p-4 rounded-full bg-green-100">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-xl font-medium">¡Importación completada!</p>
                                <p className="text-muted-foreground">
                                    Se importaron {importResult?.created || 0} productos exitosamente.
                                    {importResult?.skipped && importResult.skipped > 0 && (
                                        <span className="block mt-1 text-orange-600">
                                            {importResult.skipped} fueron omitidos por errores.
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => navigate('/inventario')}>
                                    Ir al Inventario
                                </Button>
                                <Button
                                    onClick={() => {
                                        setStep('mapping')
                                        setImportResult(null)
                                        setHasTestedOnce(false)
                                        setValidationErrors([])
                                        setCreateCategories([])
                                        setCreateSuppliers([])
                                        setSkipRowIndexes([])
                                        setResolutionHints([])
                                    }}
                                >
                                    Importar Más
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Error state
    if (step === 'error') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12">
                        <div className="flex flex-col items-center gap-6">
                            <div className="p-4 rounded-full bg-red-100">
                                <AlertCircle className="h-12 w-12 text-red-600" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-xl font-medium">Error en la importación</p>
                                <p className="text-muted-foreground">{errorMessage}</p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => navigate('/inventario')}>
                                    Cancelar
                                </Button>
                                <Button onClick={() => setStep('mapping')}>
                                    Intentar de nuevo
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return null
}

// Helper component
function HR() {
    return <div className="border-t my-3" />
}
