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
 * Diálogo de importación compartido: plantilla, archivo y QUÉ VA A PASAR con lo
 * que traiga. Deja el archivo en sessionStorage y lleva al asistente de mapeo de
 * columnas, que es donde se revisa fila por fila antes de escribir nada.
 *
 * Cada módulo declara su plantilla, su destino y su asistente; el resto —
 * arrastrar, validar la extensión, el peso, los estados — vive una sola vez.
 */
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { downloadFile } from '@/services/api'
import { ImportWizardSteps } from './ImportWizardSteps'

/** 10 MB: por encima de eso el navegador se traba al pasarlo a base64. */
const MAX_BYTES = 10 * 1024 * 1024

export interface ImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    /** Ruta de la plantilla en el backend y nombre con el que se guarda. */
    templatePath: string
    templateName: string
    /** A dónde va el asistente de mapeo con el archivo cargado. */
    wizardPath: string
    /** Marca el tipo de importación para el asistente. */
    importType: string
    /**
     * Qué va a pasar con lo que traiga el archivo: a qué sucursal, qué se crea y
     * qué se actualiza. Es lo que evita importar sobre la sucursal equivocada.
     */
    scopeNote?: React.ReactNode
}

export const ImportDialog = ({
    open,
    onOpenChange,
    title,
    description,
    templatePath,
    templateName,
    wizardPath,
    importType,
    scopeNote,
}: ImportDialogProps) => {
    const { toast } = useToast()
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const close = () => {
        setBusy(false)
        setIsDragging(false)
        setErrorMessage('')
        onOpenChange(false)
    }

    const downloadTemplate = async () => {
        try {
            await downloadFile(templatePath, templateName)
        } catch (e) {
            toast({
                title: 'No se pudo descargar la plantilla',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            })
        }
    }

    const takeFile = useCallback(
        async (file: File) => {
            if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
                toast({
                    title: 'Archivo no válido',
                    description: 'Solo se permiten archivos Excel (.xlsx, .xls) o CSV',
                    variant: 'destructive',
                })
                return
            }
            if (file.size > MAX_BYTES) {
                toast({
                    title: 'Archivo muy grande',
                    description: 'El límite son 10 MB. Partilo en varios archivos.',
                    variant: 'destructive',
                })
                return
            }
            setBusy(true)
            try {
                const buffer = await file.arrayBuffer()
                // btoa no acepta cadenas largas de una: se pasa por partes.
                const bytes = new Uint8Array(buffer)
                let binary = ''
                for (let i = 0; i < bytes.length; i += 8192) {
                    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
                }
                sessionStorage.setItem('import:fileName', file.name)
                sessionStorage.setItem('import:fileData', btoa(binary))
                sessionStorage.setItem('import:type', importType)
                onOpenChange(false)
                navigate(wizardPath)
            } catch (err) {
                setErrorMessage(err instanceof Error ? err.message : 'Error al procesar el archivo')
            } finally {
                setBusy(false)
            }
        },
        [importType, navigate, onOpenChange, toast]
    )

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
            <DialogContent className="auna-import-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <ImportWizardSteps current={1} />

                {busy ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="font-medium">Procesando archivo…</p>
                    </div>
                ) : errorMessage ? (
                    <div className="text-center py-8">
                        <p className="text-destructive mb-4">{errorMessage}</p>
                        <Button onClick={() => setErrorMessage('')}>Intentar de nuevo</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {scopeNote && (
                            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                                {scopeNote}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="font-medium">Plantilla de Excel</p>
                                    <p className="text-sm text-muted-foreground">
                                        Con las columnas que se esperan y sus nombres
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" onClick={() => void downloadTemplate()}>
                                <Download className="h-4 w-4 mr-2" />
                                Descargar
                            </Button>
                        </div>

                        <div
                            className={`relative border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer ${
                                isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                            onDrop={(e) => {
                                e.preventDefault()
                                setIsDragging(false)
                                const file = e.dataTransfer.files?.[0]
                                if (file) void takeFile(file)
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) void takeFile(file)
                                }}
                            />
                            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
                                <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">
                                    {isDragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo de Excel'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">o hacé clic para elegirlo</p>
                            </div>
                            <p className="text-xs text-muted-foreground">.xlsx, .xls o .csv, hasta 10 MB</p>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            En el siguiente paso se emparejan las columnas del archivo con los campos y
                            se prueba fila por fila. Nada se guarda hasta que lo confirmes.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

export default ImportDialog
