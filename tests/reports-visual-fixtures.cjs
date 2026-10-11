const fs = require('node:fs'), path = require('node:path')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { fixture } = require('./fixtures/reportFixtures.cjs')
const { buildSalesReport } = require('../../deposito-backend/src/modules/reports/models/commercial.js')
const originalFetch = global.fetch
global.fetch = async url => new Response(fs.readFileSync(path.resolve(__dirname, '../public', String(url).replace(/^\//, ''))))
async function main() {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts')
  const meta = fixture(); meta.branding.companyName = 'Comercial del Norte, S. A.'; meta.period.label = '1 al 30 de septiembre de 2026'; meta.generatedBy = 'Ana Morales'
  const periods = ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'].map((periodo, i) => ({ periodo, ventas: [95, 112, 104, 126, 134, 141][i], unidades: 200 + i * 37, revenue: [58430, 72560, 68120, 81240, 76500, 83863.4][i] }))
  const rows = ['Principal', 'Sucursal Centro', 'Sucursal Norte'].map((branch, i) => ({ branch, ventas: [27, 15, 9][i], unidades: [138, 95, 42][i], revenue: [44300, 24718.4, 14845][i] }))
  const sales = buildSalesReport({ totalRevenueGross: 85703.9, totalReturned: 1840.5, totalRevenue: 83863.4, totalCost: 52000, totalProfit: 31863.4, unidadesTotales: 275, tickets: 51, ticketPromedio: 1644.38,
    salesByBranch: rows, topProducts: ['Cemento Portland 50 kg', 'Varilla corrugada de 12 mm', 'Lámina galvanizada', 'Pintura látex blanca'].map((name, i) => ({ name, ventas: 24 - i * 3, revenue: 18500 - i * 2750 })),
    categories: [{ category: 'Construcción', revenue: 51240.9 }, { category: 'Ferretería', revenue: 23125 }, { category: 'Acabados', revenue: 11338 }],
    salesByMethod: [{ method: 'Efectivo', ventas: 21, unidades: 110, revenue: 30190.8 }, { method: 'Tarjeta', ventas: 24, unidades: 128, revenue: 41931.7 }, { method: 'Transferencia', ventas: 6, unidades: 37, revenue: 11740.9 }],
    salesByPeriod: periods, useDaily: false, salesByCashier: [{ cajero: 'Operador de prueba', ventas: 51, unidades: 275, revenue: 83863.4 }] }, meta)
  sales.notes.push('Datos sintéticos para validar la presentación; no corresponden a operaciones reales.')
  const output = path.resolve(__dirname, '../output/reports-qa'); fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'sales-redesign.pdf'), Buffer.from(await (await generateReportPdf(sales)).arrayBuffer()))
}
main().finally(() => { global.fetch = originalFetch })
