/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Upload, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const DEFAULT_MAX = 5 * 1024 * 1024

export interface ImageUploadDropzoneProps {
  onFileSelect: (file: File) => void
  /** Validación fallida (tipo, tamaño, etc.) */
  onReject?: (message: string) => void
  disabled?: boolean
  isUploading?: boolean
  accept?: string
  maxSizeBytes?: number
  fileLabel?: string
  formatsLabel?: string
  validateFile?: (file: File) => string | null
  helperText?: ReactNode
  className?: string
  /** Nombre del archivo elegido + botón quitar (solo creación / estado local) */
  selectionLabel?: string | null
  onClearSelection?: () => void
}

export function ImageUploadDropzone({
  onFileSelect,
  onReject,
  disabled = false,
  isUploading = false,
  accept = 'image/*',
  maxSizeBytes = DEFAULT_MAX,
  fileLabel = 'imagen',
  formatsLabel = 'PNG, JPG, WebP',
  validateFile,
  helperText,
  className,
  selectionLabel,
  onClearSelection,
}: ImageUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const mb = Math.max(1, Math.round(maxSizeBytes / (1024 * 1024)))

  const validateAndSelect = useCallback(
    (file: File | undefined) => {
      if (!file) return
      const problem = validateFile?.(file)
      if (problem || (!validateFile && !file.type.startsWith('image/'))) {
        onReject?.(problem || 'Solo se permiten archivos de imagen.')
        return
      }
      if (file.size > maxSizeBytes) {
        onReject?.(`El archivo no debe superar ${mb} MB.`)
        return
      }
      onFileSelect(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [maxSizeBytes, mb, onFileSelect, onReject, validateFile]
  )

  const openPicker = useCallback(() => {
    if (disabled || isUploading) return
    inputRef.current?.click()
  }, [disabled, isUploading])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled || isUploading) return
      const file = e.dataTransfer.files?.[0]
      validateAndSelect(file)
    },
    [disabled, isUploading, validateAndSelect]
  )

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      validateAndSelect(file)
    },
    [validateAndSelect]
  )

  const blocked = disabled || isUploading

  return (
    <div className={cn('w-full space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={onInputChange}
        disabled={blocked}
        aria-label={`Seleccionar ${fileLabel}`}
      />

      <div
        role="button"
        tabIndex={blocked ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (blocked) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!blocked) setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!blocked) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
        }}
        onDrop={onDrop}
        className={cn(
          'group relative flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center outline-none transition-all',
          'focus-visible:ring-2 focus-visible:ring-liquor-amber/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isDragging && 'scale-[1.01] border-liquor-amber bg-liquor-amber/10 shadow-sm',
          !isDragging && 'border-muted-foreground/20 bg-background/50 hover:border-liquor-amber/45 hover:bg-muted/30',
          blocked && 'cursor-not-allowed opacity-60 hover:border-muted-foreground/20 hover:bg-background/50'
        )}
      >
        {isUploading ? (
          <Loader2 className="h-9 w-9 animate-spin text-liquor-amber" aria-hidden />
        ) : (
          <Upload
            className={cn(
              'h-9 w-9 transition-colors',
              isDragging ? 'text-liquor-amber' : 'text-muted-foreground group-hover:text-liquor-amber'
            )}
            aria-hidden
          />
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {isUploading ? `Subiendo ${fileLabel}…` : isDragging ? 'Suelta para cargar' : `Arrastra ${fileLabel === 'imagen' ? 'una' : 'un'} ${fileLabel} o haz clic aquí`}
          </p>
          <p className="text-xs text-muted-foreground">{formatsLabel} · máx. {mb} MB</p>
        </div>
        <span className="pointer-events-none mt-0.5 inline-flex items-center rounded-full bg-liquor-amber/15 px-3.5 py-1 text-xs font-semibold text-liquor-amber ring-1 ring-liquor-amber/25">
          Elegir archivo
        </span>
      </div>

      {selectionLabel ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-foreground" title={selectionLabel}>
            {selectionLabel}
          </span>
          {onClearSelection && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onClearSelection()
                if (inputRef.current) inputRef.current.value = ''
              }}
              aria-label={`Quitar ${fileLabel} seleccionado`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : null}

      {helperText ? <p className="text-xs text-muted-foreground text-center leading-relaxed">{helperText}</p> : null}
    </div>
  )
}
