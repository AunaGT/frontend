import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Info, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { normalizeExportName } from './exportOptions.mjs'
import './dataTransfer.css'

export type ExportFormat = 'pdf' | 'csv' | 'xlsx'
export const FORMAT_LABELS: Record<ExportFormat, string> = { pdf: 'PDF', csv: 'CSV', xlsx: 'Excel' }
export interface ExportColumn { id: string; label: string }
export interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  summary: string
  columns?: ExportColumn[]
  defaultColumns?: string[]
  presets?: { label: string; columns: string[] }[]
  children?: React.ReactNode
  extras?: React.ReactNode
  formats?: ExportFormat[]
  pending?: boolean
  fileName?: string
  secondaryAction?: { label: string; onClick: () => void }
  onExport: (opts: { format: ExportFormat; columns?: string[]; fileName?: string }) => void
}

export const ExportDialog = ({ open, onOpenChange, title, summary, columns, defaultColumns, presets, children, extras, formats = ['pdf', 'csv'], pending = false, fileName, secondaryAction, onExport }: ExportDialogProps) => {
  const [selected, setSelected] = useState<string[]>(defaultColumns ?? columns?.map(column => column.id) ?? [])
  const [search, setSearch] = useState('')
  const [activeFormat, setActiveFormat] = useState<ExportFormat>(formats[0])
  const [name, setName] = useState(fileName ?? '')
  useEffect(() => {
    if (!open) return
    setSelected(defaultColumns ?? columns?.map(column => column.id) ?? [])
    setSearch('')
    setActiveFormat(formats[0])
    setName(fileName ?? '')
  }, [open])
  const visibleColumns = columns?.filter(column => column.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? []
  const toggle = (id: string) => setSelected(previous => previous.includes(id) ? previous.filter(column => column !== id) : [...previous, id])
  const exportAs = (format: ExportFormat) => {
    const normalizedName = fileName === undefined ? undefined : normalizeExportName(name, format)
    if (fileName !== undefined && !normalizedName) return
    onExport({ format, columns: columns ? selected : undefined, fileName: normalizedName })
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent variant="auna" className="auna-export-dialog">
      <DialogHeader className="auna-export-heading">
        <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
        <DialogDescription>Selecciona el formato, las columnas y las opciones de exportación.</DialogDescription>
      </DialogHeader>
      <div className="auna-export-tabs" role="tablist" aria-label="Formato de exportación">
        {formats.map(format => <button key={format} type="button" role="tab" aria-selected={activeFormat === format} className={activeFormat === format ? 'is-active' : ''} onClick={() => setActiveFormat(format)}>{format === 'xlsx' ? <FileSpreadsheet size={18} /> : <FileText size={18} />}{FORMAT_LABELS[format]}</button>)}
      </div>
      <div className={`auna-export-grid ${columns?.length ? '' : 'auna-export-grid--simple'}`}>
        {columns && columns.length > 0 && <section className="auna-export-panel" aria-label="Columnas a exportar">
          <div className="auna-export-panel-title"><strong>Columnas</strong><span>{selected.length} de {columns.length} seleccionadas</span></div>
          <label className="auna-control-group auna-export-search"><Search size={16} /><input className="auna-control" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar columnas…" aria-label="Buscar columnas" /></label>
          <div className="auna-export-columns">{visibleColumns.map(column => <label key={column.id}><Checkbox checked={selected.includes(column.id)} onCheckedChange={() => toggle(column.id)} /><span>{column.label}</span></label>)}{visibleColumns.length === 0 && <p className="auna-export-note">No hay columnas que coincidan.</p>}</div>
          <label className="auna-export-select-all"><Checkbox checked={selected.length === columns.length} onCheckedChange={checked => setSelected(checked ? columns.map(column => column.id) : [])} />Seleccionar todas</label>
          {presets && <div className="auna-export-presets">{presets.map(preset => <Button key={preset.label} type="button" size="sm" variant="outline" onClick={() => setSelected(preset.columns)}>{preset.label}</Button>)}</div>}
        </section>}
        <section className="auna-export-panel" aria-label="Opciones de exportación">
          <div className="auna-export-panel-title"><strong>Opciones de exportación</strong></div>
          {fileName !== undefined && <label className="auna-export-name">Nombre de archivo<div className="auna-control-group"><input className="auna-control" value={name} onChange={event => setName(event.target.value)} aria-label="Nombre de archivo" /><span>.{activeFormat}</span></div></label>}
          {children && <div className="auna-export-options">{children}</div>}
          {extras && <div className="auna-export-options">{extras}</div>}
          <div className="auna-export-info"><Info size={18} /><div><strong>Información de exportación</strong><p>{summary}</p>{columns && <p>{selected.length} columnas seleccionadas</p>}</div></div>
        </section>
      </div>
      <div className="auna-export-status" role="status"><strong>{pending ? 'Preparando datos…' : 'Listo para exportar'}</strong><div className={pending ? 'auna-export-progress is-pending' : 'auna-export-progress'} /><span>{pending ? 'La descarga comenzará al finalizar.' : 'Elige un formato para descargar el archivo.'}</span></div>
      <footer data-slot="dialog-footer" className="auna-export-footer">
        {secondaryAction && <Button type="button" variant="ghost" onClick={secondaryAction.onClick} disabled={pending}>{secondaryAction.label}</Button>}
        <Button type="button" variant="outline" className="auna-export-cancel" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
        {formats.map(format => <Button key={format} type="button" variant={format === activeFormat ? 'default' : 'outline'} disabled={pending || Boolean(columns?.length && !selected.length) || Boolean(fileName !== undefined && !normalizeExportName(name, format))} onClick={() => exportAs(format)}><Download size={16} className="mr-2" />Exportar {FORMAT_LABELS[format]}</Button>)}
      </footer>
    </DialogContent>
  </Dialog>
}

export default ExportDialog
