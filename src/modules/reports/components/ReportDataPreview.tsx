import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip } from 'recharts'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { formatReportCell, type PreparedReport, type ReportSection } from '../reportModel'
const COLORS = ['#f97316', '#2563eb', '#0d9488', '#9333ea', '#64748b']
function SectionTable({ section, report }: { section: ReportSection; report: PreparedReport }) {
  const [page, setPage] = useState(1), pages = Math.max(1, Math.ceil(section.rows.length / 25)), currentPage = Math.min(page, pages)
  const rows = section.rows.slice((currentPage - 1) * 25, currentPage * 25)
  return <section className="space-y-3" aria-label={section.title}><h2 className="font-semibold">{section.title} <span className="text-sm font-normal text-muted-foreground">({section.rows.length})</span></h2>
    <div className="auna-data-table-shell report-table-scroll" tabIndex={0} role="region" aria-label={`Tabla ${section.title}`}><table className="report-table"><thead><tr>{section.columns.map(c => <th scope="col" key={c.id} style={{ textAlign: c.align }}>{c.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{section.columns.map(c => <td key={c.id} style={{ textAlign: c.align }}>{formatReportCell(row[c.id], c, report)}</td>)}</tr>) : <tr><td colSpan={section.columns.length} className="text-muted-foreground">Sin registros para este alcance.</td></tr>}</tbody>
      {section.totals && Object.keys(section.totals).length > 0 && <tfoot><tr>{section.columns.map((c, i) => <td key={c.id} style={{ textAlign: c.align }}>{Object.prototype.hasOwnProperty.call(section.totals!, c.id) ? formatReportCell(section.totals![c.id], c, report) : i === 0 ? 'Total del reporte' : ''}</td>)}</tr></tfoot>}
    </table></div>
    <Pagination currentPage={currentPage} totalPages={pages} onPageChange={setPage} totalItems={section.rows.length} pageSize={25} count={rows.length} itemLabel={`filas de ${section.title}`} />
  </section>
}
export function ReportDataPreview({ report }: { report: PreparedReport }) {
  return <div className="space-y-5"><MetricStrip label="Resumen del reporte" items={report.summary.map(m => ({ label: m.label, value: formatReportCell(m.value, m, report) }))} />
    {!!report.charts.length && <div className="report-charts">{report.charts.map(chart => <section key={chart.id} className="report-panel" aria-label={chart.title}><h2>{chart.title}</h2>
      {chart.points.length ? <div className="h-52" aria-hidden="true"><ResponsiveContainer width="100%" height="100%">{chart.kind === 'donut' ? <PieChart><Pie data={chart.points} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="75%">{chart.points.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={value => formatReportCell(Number(value), { type: chart.valueType }, report)} /></PieChart> : chart.kind === 'line' ? <LineChart data={chart.points}><XAxis dataKey="label" /><YAxis /><Tooltip formatter={value => formatReportCell(Number(value), { type: chart.valueType }, report)} /><Line dataKey="value" stroke={COLORS[0]} isAnimationActive={false} /></LineChart> : <BarChart data={chart.points}><XAxis dataKey="label" /><YAxis /><Tooltip formatter={value => formatReportCell(Number(value), { type: chart.valueType }, report)} /><Bar dataKey="value" fill={COLORS[0]} isAnimationActive={false} /></BarChart>}</ResponsiveContainer></div> : <p className="report-help">Sin datos para graficar.</p>}
      <details><summary className="cursor-pointer text-sm text-muted-foreground">Ver datos de la gráfica</summary><ul className="mt-2 space-y-1 text-sm">{chart.points.map((point, i) => <li key={i}>{point.label}: {formatReportCell(point.value, { type: chart.valueType }, report)}</li>)}</ul></details>
    </section>)}</div>}
    {report.sections.map(section => <SectionTable key={section.id} section={section} report={report} />)}
    {!!report.notes.length && <aside aria-label="Notas del reporte" className="report-notes">{report.notes.map((note, i) => <p key={i}>{note}</p>)}</aside>}
  </div>
}
