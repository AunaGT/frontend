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
 * UserImportPage - Advanced import page for users with column mapping
 * 
 * Features:
 * - Sheet selector for multi-sheet Excel files
 * - Column mapping with system field dropdowns
 * - Preview of first row data per column
 * - Real-time validation feedback
 */
import { useState, useEffect, useMemo } from 'react'
import { getApiBaseUrl, getAuthToken } from '@/services/api'
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
    { id: 'email', label: 'Email', required: true, type: 'string' },
    { id: 'password', label: 'Contraseña', required: true, type: 'string' },
    { id: 'role', label: 'Rol', required: true, type: 'relation' },
    { id: 'is_employee', label: 'Es Empleado', required: false, type: 'boolean' },
    { id: 'phone', label: 'Teléfono', required: false, type: 'string' },
    { id: 'address', label: 'Dirección', required: false, type: 'string' },
    { id: 'hire_date', label: 'Fecha de Contratación', required: false, type: 'date' },
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
    kind: 'role'
    value: string
    rowIndexes: number[]
}

const HR = () => <div className="border-t my-4" />

export default function UserImportPage() {
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

    const [createRoles, setCreateRoles] = useState<string[]>([])
    const [skipRowIndexes, setSkipRowIndexes] = useState<number[]>([])
    const [resolutionHints, setResolutionHints] = useState<ResolutionHint[]>([])

    // Check for file in sessionStorage on mount
    useEffect(() => {
        const storedFileName = sessionStorage.getItem('import:fileName')
        const storedFileData = sessionStorage.getItem('import:fileData')
        const importType = sessionStorage.getItem('import:type')

        if (storedFileName && storedFileData && importType === 'users') {
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
                sessionStorage.removeItem('import:type')
            } catch (err) {
                console.error('Error loading file from sessionStorage:', err)
                navigate('/usuarios')
            }
        } else {
            navigate('/usuarios')
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

            // Auto-detect common field names
            if (lowerCol.includes('nombre') || lowerCol === 'name') autoField = 'name'
            else if (lowerCol.includes('email') || lowerCol.includes('correo')) autoField = 'email'
            else if (lowerCol.includes('password') || lowerCol.includes('contraseña') || lowerCol.includes('contrasena')) autoField = 'password'
            else if (lowerCol.includes('rol') || lowerCol === 'role') autoField = 'role'
            else if (lowerCol.includes('empleado') || lowerCol.includes('employee')) autoField = 'is_employee'
            else if (lowerCol.includes('telefono') || lowerCol.includes('phone') || lowerCol.includes('tel')) autoField = 'phone'
            else if (lowerCol.includes('direccion') || lowerCol.includes('address')) autoField = 'address'
            else if (lowerCol.includes('fecha') || lowerCol.includes('date') || lowerCol.includes('contratacion')) autoField = 'hire_date'

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
                setCreateRoles([])
                setSkipRowIndexes([])
                setResolutionHints([])
            } catch (err) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo leer el archivo' })
            }
        }
        reader.readAsArrayBuffer(selectedFile)
    }

    const executeValidate = async (overrides?: {
        createRoles?: string[]
        skipRowIndexes?: number[]
    }) => {
        if (!workbook || !selectedSheet) return

        const rolesOpt = overrides?.createRoles ?? createRoles
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
            const response = await fetch(`${getApiBaseUrl()}/auth/users/validate-import-mapped`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rows: mappedData,
                    importOptions: {
                        createRoles: rolesOpt,
                        skipRowIndexes: skips,
                    },
                }),
            })

            if (!response.ok) {
                const text = await response.text()
                let msg = 'Error al validar usuarios'
                try {
                    const j = JSON.parse(text) as { message?: string }
                    msg = j.message || msg
                } catch {
                    msg = text || `Error ${response.status}`
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
                        const lower = error.toLowerCase()
                        if (lower.includes('nombre')) {
                            fieldErrors.name = [...(fieldErrors.name || []), error]
                        } else if (lower.includes('email') || lower.includes('correo')) {
                            fieldErrors.email = [...(fieldErrors.email || []), error]
                        } else if (lower.includes('password') || lower.includes('contraseña') || lower.includes('contrasena')) {
                            fieldErrors.password = [...(fieldErrors.password || []), error]
                        } else if (lower.includes('rol')) {
                            fieldErrors.role = [...(fieldErrors.role || []), error]
                        } else if (lower.includes('empleado') || lower.includes('es_empleado')) {
                            fieldErrors.is_employee = [...(fieldErrors.is_employee || []), error]
                        } else if (
                            lower.includes('fecha de contratación') ||
                            lower.includes('fecha de contratacion') ||
                            lower.includes('hire_date')
                        ) {
                            fieldErrors.hire_date = [...(fieldErrors.hire_date || []), error]
                        } else {
                            fieldErrors._general = [...(fieldErrors._general || []), error]
                        }
                    })
                    return { rowIndex: row.rowIndex, errors: row.errors, fieldErrors }
                })
                setValidationErrors(processed)
                setValidRowCount(result.totals?.valid ?? 0)
                const hintCount = hints.length
                toast({
                    title: 'Hay errores en el archivo',
                    description: hintCount > 0
                        ? `${result.totals?.invalid ?? result.invalidRows.length} fila(s) con error. Use «Comentarios» o los botones globales.`
                        : `${result.invalidRows.length} fila(s) con errores.`,
                    variant: 'destructive',
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
            const msg = err instanceof Error ? err.message : 'Error al validar usuarios'
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

    const approveCreateRole = (h: ResolutionHint) => {
        const next = Array.from(new Set([...createRoles, h.value]))
        setCreateRoles(next)
        void executeValidate({ createRoles: next, skipRowIndexes })
    }

    const omitRowsForHint = (h: ResolutionHint) => {
        const nextSkip = Array.from(new Set([...skipRowIndexes, ...h.rowIndexes]))
        setSkipRowIndexes(nextSkip)
        void executeValidate({ createRoles, skipRowIndexes: nextSkip })
    }

    const approveAllUnknownRoles = () => {
        const vals = resolutionHints.filter(r => r.kind === 'role').map(r => r.value)
        const next = Array.from(new Set([...createRoles, ...vals]))
        setCreateRoles(next)
        void executeValidate({ createRoles: next, skipRowIndexes })
    }

    const omitAllRowsAffectedByUnknownRoles = () => {
        const allRows = Array.from(new Set(resolutionHints.flatMap(h => h.rowIndexes)))
        const nextSkip = Array.from(new Set([...skipRowIndexes, ...allRows]))
        setSkipRowIndexes(nextSkip)
        void executeValidate({ createRoles, skipRowIndexes: nextSkip })
    }

    const handleImport = async () => {
        if (!workbook || !selectedSheet) return

        setStep('importing')
        setImportProgress(10)

        try {
            const sheet = workbook.Sheets[selectedSheet]
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                header: useFirstRowAsHeader ? undefined : 1,
                defval: '',
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

                if (index % 10 === 0) {
                    const progress = 10 + Math.round(((index + 1) / total) * 50)
                    setImportProgress(progress)
                }
            })

            const token = getAuthToken()
            const response = await fetch(`${getApiBaseUrl()}/auth/users/bulk-import-mapped`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rows: mappedData,
                    importOptions: {
                        createRoles,
                        skipRowIndexes,
                    },
                }),
            })

            setImportProgress(80)
            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.message || 'Error en importación')
            }

            setImportProgress(100)
            setImportResult(result)
            setStep('success')
            toast({ title: '¡Importación exitosa!', description: `Se importaron ${result.created} usuarios` })
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
            case 'name':
                return [
                    'Requerido. Debe tener al menos 2 caracteres y no exceder 150.',
                    'Usa el nombre completo del usuario tal como aparecerá en reportes.',
                ]
            case 'email':
                return [
                    'Requerido y con formato de email válido.',
                    'No puede repetirse en otros usuarios (ni en el archivo ni en el sistema).',
                ]
            case 'password':
                return [
                    'Requerido y debe tener al menos 6 caracteres.',
                    'Evita contraseñas triviales como "123456".',
                ]
            case 'role':
                return [
                    'Requerido. Si el nombre no está en el sistema, «Probar» fallará hasta «Crear» u «Omitir filas».',
                    'Al crear un rol desde aquí queda sin permisos: asígnelos después en administración si hace falta.',
                ]
            case 'is_employee':
                return [
                    'Opcional. Acepta valores como "Sí/No", "true/false", "1/0".',
                    'Cualquier otro valor será marcado como error.',
                ]
            case 'phone':
                return [
                    'Opcional. Máximo 50 caracteres.',
                    'Incluye código de país si aplica, usando solo dígitos, espacios y símbolos como + o -.',
                ]
            case 'address':
                return [
                    'Opcional. Útil para datos de contacto del empleado.',
                ]
            case 'hire_date':
                return [
                    'Opcional. Usa formato YYYY-MM-DD o una fecha válida.',
                    'La fecha debe estar en un rango razonable (1900-2100).',
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
                            Se importaron {importResult.created} usuarios.
                            {importResult.skipped && importResult.skipped > 0 && ` ${importResult.skipped} fueron omitidos.`}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => navigate('/usuarios')}>Ir a Usuarios</Button>
                            <Button
                                onClick={() => {
                                    setStep('mapping')
                                    setImportResult(null)
                                    setHasTestedOnce(false)
                                    setValidationErrors([])
                                    setCreateRoles([])
                                    setSkipRowIndexes([])
                                    setResolutionHints([])
                                }}
                            >
                                Importar Más
                            </Button>
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
                            <Button variant="outline" onClick={() => navigate('/usuarios')}>Cancelar</Button>
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
                        <h3 className="text-xl font-semibold mb-2">Importando usuarios...</h3>
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
                            <Button variant="ghost" size="icon" onClick={() => navigate('/usuarios')}>
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
                                <Button variant="ghost" size="sm" onClick={() => navigate('/usuarios')}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Usuarios / Importar un archivo
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
                                    <p className="text-xs font-medium text-muted-foreground">Roles</p>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                        Si «Probar» detecta un rol inexistente, puede crearlo (quedará sin permisos hasta que los asigne) u omitir las filas del Excel.
                                    </p>
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
                                            ¿Qué hacer con roles que no existen en el sistema?
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Aplique a todos los valores detectados, o use los botones por columna en «Comentarios».
                                        </p>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                                                onClick={approveAllUnknownRoles}
                                                disabled={isTesting}
                                            >
                                                Crear todos los roles nuevos
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={omitAllRowsAffectedByUnknownRoles}
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
                                                                    <Badge variant="destructive" className="text-xs font-medium">
                                                                        {errorCount} error(es)
                                                                    </Badge>
                                                                )}

                                                                {hasTestedOnce && mapping.systemField && getFieldErrors(mapping.systemField).length > 0 && (
                                                                    <div className="space-y-1">
                                                                        {getFieldErrors(mapping.systemField).slice(0, 2).map((err, i) => (
                                                                            <p key={i} className="text-xs text-destructive">{err}</p>
                                                                        ))}
                                                                        {getFieldErrors(mapping.systemField).length > 2 && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                + {getFieldErrors(mapping.systemField).length - 2} error(es) más
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {hasTestedOnce &&
                                                                    mapping.systemField === 'role' &&
                                                                    resolutionHints.filter(h => h.kind === 'role').length > 0 && (
                                                                        <div className="mt-2 space-y-2 rounded-md border border-orange-100 bg-orange-50/50 p-2">
                                                                            <p className="text-[11px] font-medium text-orange-900">
                                                                                Roles no encontrados:
                                                                            </p>
                                                                            {resolutionHints.filter(h => h.kind === 'role').map(h => (
                                                                                <div
                                                                                    key={`${h.value}-${h.rowIndexes.join(',')}`}
                                                                                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
                                                                                >
                                                                                    <span className="text-xs break-words">
                                                                                        «{h.value}»{' '}
                                                                                        <span className="text-muted-foreground">
                                                                                            (filas {h.rowIndexes.join(', ')})
                                                                                        </span>
                                                                                    </span>
                                                                                    <div className="flex shrink-0 gap-1.5">
                                                                                        <Button
                                                                                            type="button"
                                                                                            size="sm"
                                                                                            className="h-7 text-xs px-2 bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                                                                                            onClick={() => approveCreateRole(h)}
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

                                                                {hasTestedOnce && mapping.systemField && errorCount === 0 && (
                                                                    <p className="text-xs text-green-700">Sin errores</p>
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
                                    <div
                                        className={
                                            'mt-4 p-3 rounded-md ' +
                                            (validationErrors.length > 0 ? 'bg-destructive/10' : 'bg-green-50')
                                        }
                                    >
                                        {validationErrors.length > 0 ? (
                                            <p className="text-sm text-destructive flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4" />
                                                {validationErrors.length} filas con errores. Resuelva el rol en «Comentarios» o con los botones globales.
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
