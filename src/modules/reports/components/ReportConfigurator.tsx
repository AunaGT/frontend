import { useQuery } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { fetchWarehouses } from '@/services/warehouseService'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { REPORT_CATALOG } from '../reportCatalog'
import type { PreparedReport, ReportFilters, ReportId, ReportSelection } from '../reportModel'

function Choice({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
}
export function ReportConfigurator({ id, filters, onChange, report, selection, onSelectionChange }: { id: ReportId; filters: ReportFilters; onChange: (filters: ReportFilters) => void; report: PreparedReport | null; selection: ReportSelection; onSelectionChange: (selection: ReportSelection) => void }) {
  const { company, branches } = useTenant(), { hasPermission } = useAuthPermissions()
  const definition = REPORT_CATALOG.find(r => r.id === id)!
  const warehouses = useQuery({ queryKey: ['report-warehouses', company?.id, filters.branchId], queryFn: () => fetchWarehouses(filters.branchId), enabled: !!company && !!definition.locations })
  const locations = (warehouses.data || []).filter(w => !filters.warehouseId || w.id === filters.warehouseId).flatMap(w => w.locations.map(l => ({ value: l.id, label: `${w.name} · ${l.code}${l.name ? ` · ${l.name}` : ''}` })))
  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch })
  return <div className="report-config-grid">
    <section className="report-panel" aria-labelledby="report-scope-title">
      <h2 id="report-scope-title">Filtros del reporte</h2><div className="report-field-grid">
        {id==='products' && <Choice id="report-catalog-type" label="Catálogo" value={filters.catalogType || 'goods'} options={[{value:'goods',label:'Bienes'},{value:'services',label:'Servicios'}]} onChange={value=>set({catalogType:value as 'goods' | 'services'})} />}
        <Choice id="report-branch" label="Sucursal" value={filters.branchId} options={[...(hasPermission('branches.view_all') ? [{ value: 'all', label: 'Todas las sucursales visibles' }] : []), ...branches.map(b => ({ value: b.id, label: b.name }))]} onChange={branchId => set({ branchId, warehouseId: undefined, locationId: undefined })} />
        {definition.period ? <><Choice id="report-period" label="Período" value={filters.period} options={[['week', 'Esta semana'], ['month', 'Mes'], ['quarter', 'Trimestre'], ['semester', 'Semestre'], ['year', 'Año'], ['all', 'Todo el histórico']].map(([value, label]) => ({ value, label }))} onChange={period => set({ period: period as ReportFilters['period'] })} />
          {!['week', 'all'].includes(filters.period) && <div className="space-y-2"><Label htmlFor="report-year">Año</Label><Input id="report-year" type="number" min={1900} max={9998} value={filters.year ?? ''} onChange={e => set({ year: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>}
          {filters.period === 'month' && <Choice id="report-month" label="Mes" value={String(filters.month)} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Intl.DateTimeFormat('es-GT', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 1))) }))} onChange={month => set({ month: Number(month) })} />}
          {filters.period === 'quarter' && <Choice id="report-quarter" label="Trimestre" value={String(filters.quarter)} options={[1, 2, 3, 4].map(n => ({ value: String(n), label: `Trimestre ${n}` }))} onChange={quarter => set({ quarter: Number(quarter) })} />}
          {filters.period === 'semester' && <Choice id="report-semester" label="Semestre" value={String(filters.semester)} options={[1, 2].map(n => ({ value: String(n), label: `Semestre ${n}` }))} onChange={semester => set({ semester: Number(semester) })} />}
        </> : <p className="report-help">Situación actual al preparar los datos. No aplica un período histórico.</p>}
        {definition.locations && <><Choice id="report-warehouse" label="Almacén" value={filters.warehouseId || 'all'} options={[{ value: 'all', label: 'Todos los almacenes' }, ...(warehouses.data || []).map(w => ({ value: w.id, label: `${w.branch?.name ? `${w.branch.name} · ` : ''}${w.name}` }))]} onChange={warehouseId => set({ warehouseId: warehouseId === 'all' ? undefined : warehouseId, locationId: undefined })} />
          <Choice id="report-location" label="Ubicación" value={filters.locationId || 'all'} options={[{ value: 'all', label: 'Todas las ubicaciones' }, ...locations]} onChange={locationId => set({ locationId: locationId === 'all' ? undefined : locationId })} />
          {warehouses.isLoading && <p role="status">Cargando almacenes…</p>}{warehouses.isError && <p role="alert">No se pudieron cargar los almacenes. Puedes preparar el alcance completo.</p>}</>}
      </div>
    </section>
    <section className="report-panel" aria-labelledby="report-sections-title"><h2 id="report-sections-title">Secciones y columnas</h2>
      {!report ? <p className="report-help">Prepara los datos para elegir las secciones y columnas disponibles para este alcance. La vista previa y las descargas usarán la misma selección.</p> : <div className="report-column-options">{report.sections.map(section => {
        const checked = selection.sections.includes(section.id)
        return <fieldset key={section.id}><legend><Checkbox id={`section-${section.id}`} checked={checked} onCheckedChange={value => onSelectionChange({ ...selection, sections: value ? [...selection.sections, section.id] : selection.sections.filter(s => s !== section.id) })} /><Label htmlFor={`section-${section.id}`}>{section.title}</Label><span className="text-xs text-muted-foreground">{section.rows.length} filas</span></legend>
          <div className="report-column-grid">{section.columns.map(column => { const columns = selection.columns[section.id] || section.columns.map(c => c.id); return <div key={column.id} className="flex items-center gap-2"><Checkbox id={`column-${section.id}-${column.id}`} checked={columns.includes(column.id)} disabled={!checked} onCheckedChange={value => onSelectionChange({ ...selection, columns: { ...selection.columns, [section.id]: value ? [...columns, column.id] : columns.filter(c => c !== column.id) } })} /><Label htmlFor={`column-${section.id}-${column.id}`}>{column.label}</Label></div> })}</div>
        </fieldset>
      })}</div>}
    </section>
  </div>
}
