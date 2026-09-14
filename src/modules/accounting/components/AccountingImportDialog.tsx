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
 * AccountingImportDialog - Importación masiva de contabilidad (cuentas o asientos).
 * Mismo flujo que catálogos: plantilla Excel + dropzone → página de mapeo.
 */
import { useState, useCallback, useRef } from 'react'
import { getApiBaseUrl } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const ACCOUNTING_IMPORT_PATH = '/contabilidad/importar'

interface AccountingImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'accounts' | 'journal'
}

export function AccountingImportDialog({ open, onOpenChange, type }: AccountingImportDialogProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsing, setParsing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleClose = useCallback(() => {
    setParsing(false)
    setIsDragging(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleDownloadTemplate = async () => {
    try {
      const endpoint = type === 'accounts'
        ? `${getApiBaseUrl()}/accounting/accounts/template`
        : `${getApiBaseUrl()}/accounting/journal/template`
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth:token')}` },
      })
      if (!response.ok) throw new Error('Error descargando plantilla')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'accounts' ? 'plantilla_cuentas.xlsx' : 'plantilla_asientos.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: 'Plantilla descargada', description: 'El archivo Excel se descargó correctamente' })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo descargar la plantilla' })
    }
  }

  const parseFile = useCallback(async (selectedFile: File) => {
    setParsing(true)
    try {
      const buffer = await selectedFile.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      sessionStorage.setItem('import:fileName', selectedFile.name)
      sessionStorage.setItem('import:fileData', btoa(binary))
      sessionStorage.setItem('import:accountingType', type)
      onOpenChange(false)
      navigate(ACCOUNTING_IMPORT_PATH)
    } catch (err) {
      setParsing(false)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al procesar el archivo',
      })
    }
  }, [navigate, onOpenChange, toast, type])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return
    if (dropped.name.match(/\.(xlsx|xls|csv)$/i)) void parseFile(dropped)
    else toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Solo se permiten archivos Excel (.xlsx, .xls) o CSV' })
  }, [parseFile, toast])

  const title = type === 'accounts' ? 'Importar Cuentas' : 'Importar Asientos'
  const description = type === 'accounts'
    ? 'Importa tu catálogo de cuentas masivamente desde un archivo Excel'
    : 'Importa asientos contables (agrupados por referencia) desde un archivo Excel'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />{title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {parsing ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="font-medium">Procesando archivo...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium">Plantilla de Excel</p>
                  <p className="text-sm text-muted-foreground">Descarga la plantilla con el formato correcto</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />Descargar
              </Button>
            </div>

            <div
              className={`relative border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void parseFile(f) }}
              />
              <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
                <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="text-center">
                <p className="font-medium">{isDragging ? 'Suelta el archivo aquí' : 'Arrastra y suelta tu archivo Excel'}</p>
                <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
              </div>
              <p className="text-xs text-muted-foreground">Formatos permitidos: .xlsx, .xls, .csv (máx. 10MB)</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AccountingImportDialog
