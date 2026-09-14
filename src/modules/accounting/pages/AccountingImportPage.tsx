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
 * AccountingImportPage - Importación con mapeo de columnas para contabilidad.
 * type = 'accounts' (catálogo de cuentas) | 'journal' (asientos por referencia).
 * Mismo flujo que CatalogImportPage: hoja → mapeo → probar → importar.
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  FileSpreadsheet, Upload, ArrowLeft, CheckCircle2, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const ACCOUNTING_PATH = '/contabilidad'

interface SystemField {
  id: string
  label: string
  required: boolean
  /** Palabras clave para automapeo de columnas y para asociar errores del backend. */
  keywords: string[]
  hints: string[]
}

const ACCOUNT_FIELDS: SystemField[] = [
  { id: 'code', label: 'Código', required: true, keywords: ['codigo', 'code'], hints: ['Requerido y único (por ejemplo "1201"). Las cuentas cuyo código ya existe se omiten.'] },
  { id: 'name', label: 'Nombre', required: true, keywords: ['nombre', 'name', 'cuenta'], hints: ['Requerido. Nombre de la cuenta (por ejemplo "Mobiliario y Equipo").'] },
  { id: 'type', label: 'Tipo', required: true, keywords: ['tipo', 'type'], hints: ['Requerido: Activo, Pasivo, Capital, Ingresos, Costos o Gastos.'] },
  { id: 'parent', label: 'Cuenta padre (código)', required: false, keywords: ['padre', 'parent'], hints: ['Opcional. Código de la cuenta agrupadora (debe existir o venir en el archivo).'] },
  { id: 'isGroup', label: 'Agrupadora (si/no)', required: false, keywords: ['agrupadora', 'grupo', 'group'], hints: ['Opcional. "si" para cuentas de agrupación que no reciben movimientos.'] },
]

const JOURNAL_FIELDS: SystemField[] = [
  { id: 'reference', label: 'Referencia', required: true, keywords: ['referencia', 'reference', 'numero', 'número'], hints: ['Requerida. Las filas con la misma referencia forman un solo asiento (debe cuadrar).'] },
  { id: 'date', label: 'Fecha', required: true, keywords: ['fecha', 'date'], hints: ['Requerida. Formato dd/mm/aaaa o aaaa-mm-dd; misma fecha en todas las líneas del asiento.'] },
  { id: 'description', label: 'Descripción', required: false, keywords: ['descripcion', 'descripción', 'concepto', 'detalle'], hints: ['Opcional. Se usa como glosa del asiento y de cada línea.'] },
  { id: 'accountCode', label: 'Cuenta (código)', required: true, keywords: ['cuenta', 'account'], hints: ['Requerida. Código del catálogo; no puede ser agrupadora ni estar inactiva.'] },
  { id: 'debit', label: 'Debe', required: true, keywords: ['debe', 'debito', 'débito', 'debit'], hints: ['Monto del débito. Cada línea lleva debe o haber, no ambos.'] },
  { id: 'credit', label: 'Haber', required: true, keywords: ['haber', 'credito', 'crédito', 'credit'], hints: ['Monto del crédito. El asiento debe cuadrar por referencia.'] },
]

interface ColumnMapping {
  excelColumn: string
  systemField: string | null
  sampleData: string[]
}

type ImportStep = 'mapping' | 'importing' | 'success' | 'error'

interface ValidationError {
  rowIndex: number
  errors: string[]
}

export default function AccountingImportPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const importType = sessionStorage.getItem('import:accountingType') as 'accounts' | 'journal' | null
  const fields = importType === 'journal' ? JOURNAL_FIELDS : ACCOUNT_FIELDS
  const itemName = importType === 'journal' ? 'filas de asientos' : 'cuentas'
  const title = importType === 'journal' ? 'Asientos contables' : 'Catálogo de cuentas'
  const baseEndpoint = importType === 'journal'
    ? `${getApiBaseUrl()}/accounting/journal`
    : `${getApiBaseUrl()}/accounting/accounts`

  const [step, setStep] = useState<ImportStep>('mapping')
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState(true)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped?: number; message?: string } | null>(null)

  const [isTesting, setIsTesting] = useState(false)
  const [hasTestedOnce, setHasTestedOnce] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validRowCount, setValidRowCount] = useState(0)

  // Cargar archivo desde sessionStorage (lo deja AccountingImportDialog)
  useEffect(() => {
    const storedFileName = sessionStorage.getItem('import:fileName')
    const storedFileData = sessionStorage.getItem('import:fileData')
    if (storedFileName && storedFileData && importType) {
      try {
        const binaryString = atob(storedFileData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
        const wb = XLSX.read(bytes.buffer, { type: 'array' })
        setWorkbook(wb)
        setSheetNames(wb.SheetNames)
        setSelectedSheet(wb.SheetNames[0])
        setFile({ name: storedFileName } as File)
        sessionStorage.removeItem('import:fileName')
        sessionStorage.removeItem('import:fileData')
      } catch {
        navigate(ACCOUNTING_PATH)
      }
    } else {
      navigate(ACCOUNTING_PATH)
    }
  }, [navigate, importType])

  // Parsear hoja seleccionada y automapear columnas por palabras clave
  useEffect(() => {
    if (!workbook || !selectedSheet) return
    const sheet = workbook.Sheets[selectedSheet]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: useFirstRowAsHeader ? undefined : 1,
      defval: '',
    })
    if (data.length === 0) { setColumnMappings([]); return }

    const used = new Set<string>()
    const mappings: ColumnMapping[] = Object.keys(data[0]).map((col) => {
      const samples = data.slice(0, 3).map((row) => String(row[col] ?? ''))
      const lowerCol = col.toLowerCase().trim()
      const match = fields.find((f) => !used.has(f.id) && f.keywords.some((k) => lowerCol.includes(k)))
      if (match) used.add(match.id)
      return { excelColumn: col, systemField: match?.id ?? null, sampleData: samples }
    })
    setColumnMappings(mappings)
    setHasTestedOnce(false)
    setValidationErrors([])
    // fields es constante por tipo de importación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbook, selectedSheet, useFirstRowAsHeader])

  const requiredFieldsMapped = useMemo(() => {
    const mapped = columnMappings.map((m) => m.systemField).filter(Boolean)
    return fields.filter((f) => f.required).every((f) => mapped.includes(f.id))
  }, [columnMappings, fields])

  const handleMappingChange = (excelColumn: string, systemField: string | null) => {
    setColumnMappings((prev) => prev
      .map((m) => (m.systemField === systemField && systemField !== null ? { ...m, systemField: null } : m))
      .map((m) => (m.excelColumn === excelColumn ? { ...m, systemField } : m)))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target?.result, { type: 'array' })
        setWorkbook(wb)
        setSheetNames(wb.SheetNames)
        setSelectedSheet(wb.SheetNames[0])
        setFile(selectedFile)
        setHasTestedOnce(false)
        setValidationErrors([])
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo leer el archivo' })
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  const mappedItems = (): Record<string, unknown>[] => {
    if (!workbook || !selectedSheet) return []
    const sheet = workbook.Sheets[selectedSheet]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: useFirstRowAsHeader ? undefined : 1,
      defval: '',
    })
    return data.map((row) => {
      const mapped: Record<string, unknown> = {}
      columnMappings.forEach((m) => { if (m.systemField) mapped[m.systemField] = row[m.excelColumn] })
      return mapped
    })
  }

  const postJson = async (path: string, items: Record<string, unknown>[]) => {
    const response = await fetch(`${baseEndpoint}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth:token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    })
    const result = await response.json()
    return { ok: response.ok, result }
  }

  const handleTest = async () => {
    setIsTesting(true)
    try {
      const items = mappedItems()
      const { ok, result } = await postJson('/validate-import', items)
      if (!ok) throw new Error(result.message || 'Error al validar')
      setValidRowCount(result.totals.valid)
      setValidationErrors(result.invalidRows ?? [])
      if (result.totals.invalid > 0) {
        toast({ title: 'Validación completada', description: `${result.totals.invalid} filas con errores`, variant: 'destructive' })
      } else {
        toast({ title: '¡Validación exitosa!', description: `Las ${result.totals.total} filas son válidas.` })
      }
      setHasTestedOnce(true)
    } catch (err) {
      toast({ title: 'Error de validación', description: err instanceof Error ? err.message : 'Error al validar', variant: 'destructive' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleImport = async () => {
    setStep('importing')
    setImportProgress(30)
    try {
      const items = mappedItems()
      setImportProgress(60)
      const { ok, result } = await postJson('/bulk-import', items)
      if (!ok) throw new Error(result.message || 'Error en importación')
      setImportProgress(100)
      setImportResult(result)
      setStep('success')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error en importación')
      setStep('error')
    }
  }

  /** Errores de validación asociados a un campo del sistema (por palabra clave). */
  const fieldErrors = (systemField: string | null): string[] => {
    if (!systemField || !hasTestedOnce) return []
    const field = fields.find((f) => f.id === systemField)
    if (!field) return []
    const out: string[] = []
    validationErrors.forEach((ve) => {
      ve.errors.forEach((e) => {
        const lower = e.toLowerCase()
        if (field.keywords.some((k) => lower.startsWith(k) || lower.includes(`${k}:`)) && !out.includes(e)) {
          out.push(`Fila ${ve.rowIndex + 2}: ${e}`)
        }
      })
    })
    return out
  }

  if (step === 'success' && importResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">¡Importación Exitosa!</h3>
            <p className="text-muted-foreground mb-4">
              {importResult.message ?? `Se importaron ${importResult.created} registros.`}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(ACCOUNTING_PATH)}>Ir a Contabilidad</Button>
              <Button onClick={() => { setStep('mapping'); setImportResult(null); setHasTestedOnce(false); setValidationErrors([]) }}>
                Importar Más
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Error</h3>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(ACCOUNTING_PATH)}>Cancelar</Button>
              <Button onClick={() => setStep('mapping')}>Intentar de nuevo</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'importing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Importando {itemName}...</h3>
            <Progress value={importProgress} className="mt-4" />
            <p className="text-sm text-muted-foreground mt-2">{importProgress}%</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(ACCOUNTING_PATH)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="default" size="sm"
                  onClick={handleImport}
                  disabled={!requiredFieldsMapped || isTesting || !hasTestedOnce || validationErrors.length > 0}
                >
                  <Upload className="h-4 w-4 mr-2" />Importar
                </Button>
                <Button variant="outline" size="sm" onClick={handleTest} disabled={!requiredFieldsMapped || isTesting}>
                  {isTesting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Probando...</>) : 'Probar'}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <RefreshCw className="h-4 w-4 mr-2" />Cargar otro archivo
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                  </label>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(ACCOUNTING_PATH)}>Cancelar</Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{title} / Importar un archivo</div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
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
                    <SelectTrigger><SelectValue placeholder="Seleccionar hoja" /></SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="useHeader"
                    checked={useFirstRowAsHeader}
                    onCheckedChange={(checked) => setUseFirstRowAsHeader(checked as boolean)}
                  />
                  <Label htmlFor="useHeader" className="text-xs">Utilizar la primera fila como encabezado</Label>
                </div>

                <div className="border-t my-4" />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Estado del mapeo</p>
                  {fields.filter((f) => f.required).map((field) => {
                    const isMapped = columnMappings.some((m) => m.systemField === field.id)
                    return (
                      <div key={field.id} className="flex items-center gap-2 text-xs">
                        {isMapped
                          ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                          : <AlertCircle className="h-3 w-3 text-orange-500" />}
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

          <div className="col-span-9">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Mapeo de columnas</CardTitle>
                  <Badge variant="outline">
                    {columnMappings.filter((m) => m.systemField).length} / {columnMappings.length} columnas mapeadas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
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
                        const field = fields.find((f) => f.id === mapping.systemField)
                        const errs = fieldErrors(mapping.systemField)
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
                                <SelectTrigger className={errs.length > 0 ? 'border-destructive' : ''}>
                                  <SelectValue placeholder="No importar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no-mapear">No importar</SelectItem>
                                  {fields.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>{f.label} {f.required && '*'}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                {field?.required && <span className="text-xs text-muted-foreground">Requerido</span>}
                                {errs.length > 0 && (
                                  <div className="space-y-1">
                                    {errs.slice(0, 3).map((err, i) => (
                                      <p key={i} className="text-xs text-destructive">{err}</p>
                                    ))}
                                    {errs.length > 3 && (
                                      <p className="text-xs text-destructive">… y {errs.length - 3} más</p>
                                    )}
                                  </div>
                                )}
                                {field && field.hints.length > 0 && (
                                  <ul className="text-xs text-muted-foreground space-y-0.5">
                                    {field.hints.map((hint, idx) => <li key={idx}>• {hint}</li>)}
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

                {hasTestedOnce && (
                  <div className={cn('mt-4 p-3 rounded-md', validationErrors.length > 0 ? 'bg-destructive/10' : 'bg-green-50')}>
                    {validationErrors.length > 0 ? (
                      <div className="text-sm text-destructive space-y-1">
                        <p className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {validationErrors.length} filas con errores. Corrígelas antes de importar.
                        </p>
                        {validationErrors.slice(0, 5).map((ve) => (
                          <p key={ve.rowIndex} className="text-xs pl-6">Fila {ve.rowIndex + 2}: {ve.errors.join(' · ')}</p>
                        ))}
                        {validationErrors.length > 5 && (
                          <p className="text-xs pl-6">… y {validationErrors.length - 5} filas más</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-green-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        ¡Validación exitosa! {validRowCount} {itemName} listas para importar.
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
