import { useEffect, useRef, useState } from 'react'
import { ExportDialog, type ExportFormat } from '@/components/shared/ExportDialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { downloadReportBlob } from '../documents/reportDownload'
import type { PreparedReport } from '../reportModel'
export function ReportExportDialog({ open, onOpenChange, report, getPdf }: { open: boolean; onOpenChange: (open: boolean) => void; report: PreparedReport; getPdf: () => Promise<Blob> }) {
  const [sectionId, setSectionId] = useState(report.sections[0].id), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null)
  const busy = useRef(false), current = useRef(report), alive = useRef(true)
  current.current = report
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const exportFile = async ({ format, fileName }: { format: ExportFormat; fileName?: string }) => {
    if (busy.current) return
    busy.current = true; setPending(true); setError(null)
    try {
      let blob: Blob
      if (format === 'pdf') blob = await getPdf()
      else {
        const module = await import('../documents/reportSpreadsheet')
        blob = format === 'xlsx' ? new Blob([await module.generateReportWorkbook(report)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) : new Blob([module.generateReportCsv(report, sectionId)], { type: 'text/csv;charset=utf-8' })
      }
      if (!alive.current || current.current !== report) return
      downloadReportBlob(blob, fileName || `${report.id}${format === 'csv' ? `-${sectionId}` : ''}.${format}`)
      onOpenChange(false)
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'No se pudo exportar. Intenta de nuevo.') }
    finally { busy.current = false; if (alive.current) setPending(false) }
  }
  return <ExportDialog open={open} onOpenChange={value => { if (!busy.current) onOpenChange(value) }} title={`Exportar ${report.title}`} formats={['pdf', 'xlsx', 'csv']} pending={pending} fileName={report.id}
    summary={`${report.scope.label}. ${report.period.label}. ${report.sections.length} secciones y ${report.sections.reduce((n, s) => n + s.rows.length, 0)} filas completas. PDF y Excel incluyen todas las secciones seleccionadas.`} onExport={exportFile}>
    <fieldset disabled={pending} className="space-y-3"><Label htmlFor="report-csv-section">Sección (solo para CSV)</Label><Select value={sectionId} onValueChange={setSectionId}><SelectTrigger id="report-csv-section"><SelectValue /></SelectTrigger><SelectContent>{report.sections.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent></Select>
      <p className="report-help">CSV es una tabla sin estilos. Para varias hojas o conservar tipos de datos, utiliza Excel.</p></fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </ExportDialog>
}
