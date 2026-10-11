function fixture(id = 'sales', count = 26) {
  return { id, title: 'Reporte QA', generatedAt: '2026-10-09T12:00:00Z', timezone: 'America/Guatemala', currency: 'GTQ', generatedBy: 'Operador QA',
    scope: { companyId: 'qa-company', label: 'Principal', branches: [{ id: 'qa-branch', name: 'Principal' }], warehouse: null, location: null },
    period: { mode: 'period', start: '2026-10-01T06:00:00Z', endExclusive: '2026-11-01T06:00:00Z', label: 'Octubre 2026' },
    branding: { companyName: 'Empresa QA', logoDataUrl: null },
    summary: [{ id: 'total', label: 'Total neto', value: count, type: 'money' }],
    sections: [{ id: 'detail', title: 'Detalle', columns: [
      { id: 'code', label: 'Código', type: 'text', align: 'left' }, { id: 'name', label: 'Descripción', type: 'text', align: 'left' },
      { id: 'net', label: 'Neto', type: 'money', align: 'right' }, { id: 'margin', label: 'Margen', type: 'percent', align: 'right' },
      { id: 'date', label: 'Fecha', type: 'datetime', align: 'left' },
    ], rows: Array.from({ length: count }, (_, i) => ({ code: String(i + 1).padStart(5, '0'), name: `QA-${String(i + 1).padStart(4, '0')} · café y piñón`, net: 1, margin: 28.5, date: '2026-10-01T01:00:00Z' })), totals: { net: count } }],
    charts: [{ id: 'detail-chart', sectionId: 'detail', title: 'Valores QA', kind: 'bar', valueType: 'money', points: [{ label: 'QA', value: count }] }], notes: ['Datos sintéticos sin información personal.'] }
}
// Captured from all thirteen actual backend builders; local snapshots keep frontend CI independent.
function makeReport(id, { rows = 6 } = {}) {
  const report = require('./preparedReports.json')[id]?.[rows]
  if (!report) throw new Error(`Falta fixture preparado ${id}/${rows}`)
  return JSON.parse(JSON.stringify(report))
}
module.exports = { fixture, makeReport }
