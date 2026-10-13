import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, FileText, Search } from 'lucide-react'
import { useTenant } from '@/context/useTenant'
import { useModules } from '@/context/useModules'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ModuleTabsList, ModuleTabsTrigger } from '@/components/shared/ModuleTabs'
import { LoadingState } from '@/components/shared/LoadingState'
import { REPORT_CATALOG, REPORT_CATEGORIES, type ReportDefinition } from '../reportCatalog'
import { allReportColumns, projectReport, type ReportFilters, type ReportSelection } from '../reportModel'
import { usePreparedReport } from '../hooks/usePreparedReport'
import { ReportConfigurator } from '../components/ReportConfigurator'
import { ReportDataPreview } from '../components/ReportDataPreview'
import { ReportExportDialog } from '../components/ReportExportDialog'
import { useReportPdf } from '../hooks/useReportPdf'
import { downloadReportBlob } from '../documents/reportDownload'
import type { PreparedReport } from '../reportModel'
import '../reports.css'
function PdfPreview({ report, getPdf }: { report: PreparedReport; getPdf: () => Promise<Blob> }) {
  const [pdf, setPdf] = useState<Blob | null>(null), [error, setError] = useState<string | null>(null), [retry, setRetry] = useState(0)
  const [Viewer, setViewer] = useState<typeof import('../components/ReportDocumentPreview').ReportDocumentPreview | null>(null)
  useEffect(() => { let disposed = false; setPdf(null); setError(null); void Promise.all([getPdf(), import('../components/ReportDocumentPreview').catch(() => { throw new Error('No se pudo cargar el visor. Reintenta o utiliza Datos y exporta Excel/CSV.') })]).then(([blob, module]) => { if (!disposed) { setPdf(blob); setViewer(() => module.ReportDocumentPreview) } }).catch(cause => { if (!disposed) setError(cause.message) }); return () => { disposed = true } }, [getPdf, retry])
  return error ? <div role="alert" className="report-panel"><p>{error}</p><Button variant="outline" onClick={() => setRetry(v => v + 1)}>Reintentar PDF</Button><p className="report-help">La vista Datos y las exportaciones Excel/CSV siguen disponibles.</p></div> : pdf && Viewer ? <Viewer pdf={pdf} onDownload={() => downloadReportBlob(pdf, `${report.id}.pdf`)} /> : <LoadingState message="Preparando documento…" variant="page" />
}

function ReportWorkspace({ definition, companyId, branchId, available, onBack }: { definition: ReportDefinition; companyId: string; branchId: string; available: ReportDefinition[]; onBack: () => void }) {
  const now = new Date(), [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<ReportFilters>({ branchId, period: 'month', year: now.getFullYear(), month: now.getMonth() + 1, quarter: Math.ceil((now.getMonth() + 1) / 3), semester: now.getMonth() < 6 ? 1 : 2 })
  const errorSummary = useRef<HTMLParagraphElement>(null)
  const prepared = usePreparedReport(companyId, definition.id, filters)
  const [selection, setSelection] = useState<ReportSelection | null>(null)
  useEffect(() => setSelection(null), [prepared.report])
  const selected = useMemo(() => selection || (prepared.report ? allReportColumns(prepared.report) : { sections: [], columns: {} }), [selection, prepared.report])
  const projection = useMemo(() => { try { return { report: prepared.report ? projectReport(prepared.report, selected) : null, error: null } } catch (error) { return { report: null, error: (error as Error).message } } }, [prepared.report, selected])
  const getPdf = useReportPdf(projection.report), [exportOpen, setExportOpen] = useState(false), [previewTab, setPreviewTab] = useState('datos')
  const tab = params.get('vista') === 'preview' && projection.report ? 'datos' : 'configurar'
  usePageTrail([{ label: 'Reportes', to: '/reportes' }, { label: definition.name }, { label: tab === 'configurar' ? 'Configurar' : 'Vista previa' }])
  const changeTab = (value: string) => setParams({ reporte: definition.id, vista: value === 'configurar' ? 'configurar' : 'preview' })
  const reset = () => { prepared.clear(); setSelection(null); setFilters({ branchId, period: 'month', year: now.getFullYear(), month: now.getMonth() + 1, quarter: Math.ceil((now.getMonth() + 1) / 3), semester: now.getMonth() < 6 ? 1 : 2 }); changeTab('configurar') }
  useEffect(() => { if (prepared.error || projection.error) errorSummary.current?.focus() }, [prepared.error, projection.error])
  return <div className="space-y-5"><div className="report-workspace-toolbar"><Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Catálogo</Button><div className="report-type-select"><Select value={definition.id} onValueChange={reporte => setParams({ reporte, vista: 'configurar' })}><SelectTrigger aria-label="Elegir reporte"><SelectValue /></SelectTrigger><SelectContent>{available.map(r => <SelectItem value={r.id} key={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div><div className="ml-auto flex flex-wrap gap-2"><Button variant="ghost" disabled={prepared.pending} onClick={reset}>Restablecer</Button><Button variant="outline" disabled={prepared.pending} onClick={() => prepared.prepare()}>{prepared.report ? 'Actualizar datos' : 'Preparar datos'}</Button><Button variant="outline" disabled={!projection.report} onClick={() => setExportOpen(true)}>Exportar</Button><Button disabled={!projection.report} onClick={() => changeTab('datos')}>Vista previa <ArrowRight className="h-4 w-4" /></Button></div></div>
    {projection.report && <ReportExportDialog key={`${projection.report.generatedAt}:${JSON.stringify(selected)}`} open={exportOpen} onOpenChange={setExportOpen} report={projection.report} getPdf={getPdf} />}
    <p className="report-help">{prepared.report ? `${prepared.report.scope.label} · ${prepared.report.period.label} · ${prepared.report.sections.reduce((n, s) => n + s.rows.length, 0)} filas preparadas` : definition.description}</p>
    {(prepared.error || projection.error) && <p ref={errorSummary} tabIndex={-1} role="alert" className="text-sm text-destructive">{prepared.error?.message || projection.error}</p>}{prepared.dirty && <p role="status" className="report-help">Los filtros cambiaron. Prepara los datos nuevamente.</p>}
    {prepared.pending ? <LoadingState message="Preparando reporte…" variant="table" /> : <Tabs value={tab} onValueChange={changeTab}><div className="overflow-x-auto"><ModuleTabsList aria-label="Pasos del reporte"><ModuleTabsTrigger value="configurar">Configuración</ModuleTabsTrigger><ModuleTabsTrigger value="datos" disabled={!projection.report}>Datos preparados</ModuleTabsTrigger></ModuleTabsList></div>
      <TabsContent value="configurar"><ReportConfigurator id={definition.id} filters={filters} onChange={setFilters} report={prepared.report} selection={selected} onSelectionChange={setSelection} /></TabsContent>
      <TabsContent value="datos">{projection.report && <Tabs value={previewTab} onValueChange={setPreviewTab}><ModuleTabsList aria-label="Formato de vista previa"><ModuleTabsTrigger value="datos">Datos</ModuleTabsTrigger><ModuleTabsTrigger value="documento">Documento PDF</ModuleTabsTrigger></ModuleTabsList><TabsContent value="datos"><ReportDataPreview report={projection.report} /></TabsContent><TabsContent value="documento"><PdfPreview report={projection.report} getPdf={getPdf} /></TabsContent></Tabs>}</TabsContent>
    </Tabs>}
  </div>
}
export default function ReportsManagement() {
  const { company, branch, isConsolidated } = useTenant(), modules = useModules(), permissions = useAuthPermissions()
  const [params, setParams] = useSearchParams(), [search, setSearch] = useState(''), [category, setCategory] = useState('Todos')
  usePageTrail(params.has('reporte') ? null : [{ label: 'Reportes' }])
  const visible = !modules.enabledModuleCodes || modules.isError || !permissions.permissionsReady ? [] : REPORT_CATALOG.filter(r => r.modules.every(code => modules.enabledModuleCodes!.has(code)) && permissions.hasPermission(...r.permissions))
  const definition = visible.find(r => r.id === params.get('reporte'))
  if (modules.isError) return <div role="alert" className="p-6">No se pudo cargar el catálogo de reportes. <Button variant="outline" onClick={() => modules.refetch()}>Reintentar</Button></div>
  if (modules.isLoading || !modules.enabledModuleCodes || !permissions.permissionsReady) return <LoadingState message="Cargando reportes…" variant="cards" />
  if (!company) return <p role="status" className="p-6">Selecciona una empresa para consultar sus reportes.</p>
  const branchId = isConsolidated ? 'all' : branch?.id || ''
  if (definition && branchId) return <main className="reports-page"><h1 className="sr-only">{definition.name}</h1><ReportWorkspace key={`${company.id}:${branchId}:${definition.id}`} definition={definition} companyId={company.id} branchId={branchId} available={visible} onBack={() => setParams({})} /></main>
  const filtered = visible.filter(r => (category === 'Todos' || r.category === category) && `${r.name} ${r.description}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
  return <main className="reports-page"><h1 className="sr-only">Reportes</h1>{params.has('reporte') && <p role="alert" className="text-sm text-destructive">Este reporte no está disponible para tus módulos o permisos.</p>}
    <div className="report-catalog-toolbar"><div className="max-w-xl flex-1 space-y-2"><Label htmlFor="report-search">Buscar reporte</Label><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="report-search" className="pl-10" placeholder="Buscar un reporte…" value={search} onChange={e => setSearch(e.target.value)} /></div></div><span className="text-sm text-muted-foreground">{visible.length} reportes disponibles</span></div>
    <Tabs value={category} onValueChange={setCategory}><div className="overflow-x-auto"><ModuleTabsList aria-label="Categorías de reportes">{REPORT_CATEGORIES.filter(c => c === 'Todos' || visible.some(r => r.category === c)).map(c => <ModuleTabsTrigger key={c} value={c}>{c}</ModuleTabsTrigger>)}</ModuleTabsList></div>
      <TabsContent value={category}><div className="report-catalog-grid">{filtered.map(report => <article key={report.id} className="report-catalog-entry"><FileText className="h-6 w-6 text-brand-orange" aria-hidden="true" /><div><span className="text-xs text-muted-foreground">{report.category}</span><h2 className="font-semibold">{report.name}</h2><p className="report-help mt-1">{report.description}</p></div><Button variant="outline" onClick={() => setParams({ reporte: report.id, vista: 'configurar' })}>Configurar <ArrowRight className="h-4 w-4" /></Button></article>)}</div>{!filtered.length && <p className="py-8 text-sm text-muted-foreground">No hay reportes disponibles con esta búsqueda y tus permisos actuales.</p>}</TabsContent>
    </Tabs>
  </main>
}
