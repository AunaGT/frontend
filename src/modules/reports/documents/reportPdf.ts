import { formatReportCell, type PreparedReport } from '../reportModel'

let fonts: Promise<string[]> | null = null
function loadFonts() {
  if (!fonts) fonts = Promise.all(['Regular', 'Bold'].map(async weight => {
    const response = await fetch(`/fonts/reports/NotoSans-${weight}.ttf`)
    if (!response.ok) throw new Error('No se pudo cargar la fuente del reporte. Intenta de nuevo.')
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    return btoa(binary)
  })).catch(error => { fonts = null; throw error })
  return fonts
}

export async function generateReportPdf(report: PreparedReport): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, fontData] = await Promise.all([import('jspdf'), import('jspdf-autotable'), loadFonts()])
  const landscape = Math.max(...report.sections.map(s => s.columns.length)) > 7
  const doc = new jsPDF({ format: 'a4', orientation: landscape ? 'landscape' : 'portrait', compress: true })
  doc.addFileToVFS('NotoSans-Regular.ttf', fontData[0]); doc.addFont('NotoSans-Regular.ttf', 'Report', 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', fontData[1]); doc.addFont('NotoSans-Bold.ttf', 'Report', 'bold'); doc.setFont('Report', 'normal')
  const cmap = (doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } }).metadata.cmap.unicode.codeMap
  const printable = JSON.stringify({ title: report.title, company: report.branding.companyName, scope: report.scope, period: report.period, summary: report.summary, sections: report.sections, charts: report.charts, notes: report.notes })
  if ([...printable].some(char => char.codePointAt(0)! > 31 && !cmap[char.codePointAt(0)!])) throw new Error('El reporte contiene caracteres no compatibles con la fuente PDF. Usa Excel o CSV para conservarlos.')

  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 13, usable = width - 2 * margin
  const navy: [number, number, number] = [12, 32, 58], orange: [number, number, number] = [255, 111, 0], muted: [number, number, number] = [99, 117, 139], border: [number, number, number] = [216, 225, 235]
  const palette: [number, number, number][] = [navy, orange, [68, 116, 159], [139, 162, 185], [193, 205, 217], [13, 148, 136]]
  const emission = formatReportCell(report.generatedAt, { type: 'datetime' }, report)
  const scope = [report.scope.label, report.scope.warehouse?.name, report.scope.location?.name].filter(Boolean).join(' · ')
  const text = (value: string, x: number, y: number, size = 9, bold = false, color = navy) => { doc.setFont('Report', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); doc.text(value, x, y) }
  const wrap = (value: string, maxWidth: number, size: number, bold = false): string[] => { doc.setFont('Report', bold ? 'bold' : 'normal'); doc.setFontSize(size); return doc.splitTextToSize(value, maxWidth) }
  const brand = (y: number, small = false) => {
    let nameY = y
    if (report.branding.logoDataUrl) {
      try {
        const image = doc.getImageProperties(report.branding.logoDataUrl), scale = Math.min((small ? 18 : 32) / image.width, (small ? 8 : 16) / image.height)
        const logoWidth = image.width * scale, logoHeight = image.height * scale, logoTop = y - (small ? 6 : 13)
        doc.addImage(report.branding.logoDataUrl, image.fileType, (width - logoWidth) / 2, logoTop, logoWidth, logoHeight)
        nameY = logoTop + logoHeight + (small ? 5 : 7)
      } catch { /* Missing or invalid logos leave the centered company name. */ }
    }
    const size = small ? 10 : landscape ? 14 : 18, lineHeight = small ? 5 : 8, lines = wrap(report.branding.companyName, usable, size, true)
    doc.setFont('Report', 'bold'); doc.setFontSize(size); doc.setTextColor(...navy)
    lines.forEach((line, i) => doc.text(line, width / 2, nameY + i * lineHeight, { align: 'center' }))
    return nameY + (lines.length - 1) * lineHeight
  }
  const continuationCompanyLines = wrap(report.branding.companyName, usable, 10, true).length
  const continuationTitleLines = wrap(report.title, usable, 10, true)
  const continuationScopeLines = wrap(`${report.period.label} · ${scope}`, usable, 8)
  const continuationTop = 14 + (report.branding.logoDataUrl ? 7 : 0) + (continuationCompanyLines - 1) * 5 + 9 + continuationTitleLines.length * 4 + continuationScopeLines.length * 3.5 + 9
  const continuedHeader = () => {
    const bottom = brand(14, true)
    continuationTitleLines.forEach((line, i) => text(line, margin, bottom + 8 + i * 4, 10, true))
    continuationScopeLines.forEach((line, i) => text(line, margin, bottom + 9 + continuationTitleLines.length * 4 + i * 3.5, 8, false, muted))
    doc.setDrawColor(...orange); doc.setLineWidth(.6); doc.line(margin, continuationTop - 7, width - margin, continuationTop - 7)
  }
  let y = 0
  const newPage = () => { doc.addPage(); continuedHeader(); y = continuationTop }
  const ensure = (space: number) => { if (y + space > height - 20) newPage() }
  const heading = (title: string) => { ensure(16); text(title, margin, y, 11, true); y += 7 }

  const brandBottom = brand(landscape ? 15 : 21), headerRule = Math.max(landscape ? 21 : 29, brandBottom + 4)
  doc.setDrawColor(...orange); doc.setLineWidth(.8); doc.line(margin, headerRule, width - margin, headerRule)
  const titleLines = wrap(report.title, usable, landscape ? 18 : 21, true)
  titleLines.forEach((line, i) => text(line, margin, headerRule + (landscape ? 10 : 13) + i * 9, landscape ? 18 : 21, true))
  y = headerRule + (landscape ? 16 : 20) + (titleLines.length - 1) * 9
  const meta = [['Empresa', report.branding.companyName], ['Período', report.period.label], ['Sucursal', scope], ['Moneda', report.currency], ['Fecha de emisión', emission], ['Preparado por', report.generatedBy || 'Usuario autorizado']]
  const colWidth = (usable - 8) / 2
  for (let row = 0; row < 3; row++) {
    const entries = [meta[row], meta[row + 3]]
    const lines = entries.map(([, value]) => wrap(value, colWidth - 35, 8.5))
    entries.forEach(([label], i) => { const x = margin + i * (colWidth + 8); text(label, x, y, 8.5, true); lines[i].forEach((line, n) => text(line, x + 35, y + n * 4, 8.5)) })
    y += Math.max(...lines.map(l => l.length)) * 4 + (landscape ? 1 : 2)
  }
  y += 5; heading('Resumen')
  const metricColumns = report.summary.length >= 7 ? 4 : report.summary.length > 4 ? 3 : Math.max(1, report.summary.length), gap = 3, metricWidth = (usable - gap * (metricColumns - 1)) / metricColumns
  for (let offset = 0; offset < report.summary.length; offset += metricColumns) {
    ensure(29)
    report.summary.slice(offset, offset + metricColumns).forEach((metric, index) => {
      const x = margin + index * (metricWidth + gap), labelLines = wrap(metric.label, metricWidth - 8, 8)
      const value = formatReportCell(metric.value, metric, report)
      doc.setDrawColor(...border); doc.setFillColor(250, 252, 254); doc.setLineWidth(.2); doc.roundedRect(x, y, metricWidth, landscape ? 20 : 24, 1, 1, 'FD')
      doc.setFillColor(...orange); doc.rect(x + 4, y + 4, 1, 4, 'F')
      labelLines.forEach((line, i) => text(line, x + 8, y + 7 + i * 3.5, 8, false, muted))
      let size = 15
      while (size > 10 && wrap(value, metricWidth - 8, size, true).length > 1) size--
      text(value, x + 4, y + (landscape ? 16 : 19), size, true)
    })
    y += landscape ? 24 : 28
  }
  y += 4

  for (const chart of report.charts.filter(c => c.points.length)) {
    for (let offset = 0; offset < chart.points.length; offset += 6) {
      const points = chart.points.slice(offset, offset + 6)
      const isDonut = chart.kind === 'donut' && chart.points.length <= 6 && points.every(p => p.value >= 0) && points.some(p => p.value > 0) && points.every(p => wrap(p.label, usable - 99, 8.5).length <= 3)
      const labelLines = points.map(p => wrap(p.label, (usable - 27) / points.length - 2, 8))
      const boxHeight = isDonut ? 62 : 48 + Math.max(...labelLines.map(lines => lines.length)) * 3.5
      if (boxHeight + 20 > height - 62) throw new Error('Las etiquetas de la gráfica son demasiado largas para una página PDF. Exporta Excel/CSV o reduce las secciones seleccionadas.')
      ensure(boxHeight + 12); heading(`${chart.title}${offset ? ' (continuación)' : ''}`)
      const top = y, chartLeft = margin + 21, chartRight = width - margin - 6, plotWidth = chartRight - chartLeft, plotHeight = 36
      const valueLabel = (value: number) => formatReportCell(value, { type: chart.valueType }, report)
      if (isDonut) {
        const total = points.reduce((sum, p) => sum + p.value, 0), cx = margin + 32, cy = top + 24, outer = 21, inner = 13
        let angle = -Math.PI / 2
        points.forEach((point, i) => {
          const end = angle + point.value / total * Math.PI * 2, count = Math.max(2, Math.ceil((end - angle) * 16)), vertices: [number, number][] = []
          for (let step = 0; step <= count; step++) { const a = angle + (end - angle) * step / count; vertices.push([cx + Math.cos(a) * outer, cy + Math.sin(a) * outer]) }
          for (let step = count; step >= 0; step--) { const a = angle + (end - angle) * step / count; vertices.push([cx + Math.cos(a) * inner, cy + Math.sin(a) * inner]) }
          doc.setFillColor(...palette[i % palette.length]); doc.lines(vertices.slice(1).map((p, n) => [p[0] - vertices[n][0], p[1] - vertices[n][1]]), vertices[0][0], vertices[0][1], [1, 1], 'F', true)
          angle = end
          const legendX = margin + 65, legendY = top + 5 + i * 9
          doc.rect(legendX, legendY - 2, 2.5, 2.5, 'F'); wrap(point.label, usable - 99, 8.5).forEach((line, n) => text(line, legendX + 5, legendY + n * 3, 8.5)); text(valueLabel(point.value), chartRight - Math.min(35, doc.getTextWidth(valueLabel(point.value))), legendY, 8.5, true)
        })
        text('Total', cx - 5, cy - 1, 8, false, muted)
        const totalText = valueLabel(total), totalLines = wrap(totalText, inner * 1.8, 9, true)
        totalLines.forEach((line, i) => { doc.setFont('Report', 'bold'); doc.setFontSize(9); text(line, cx - doc.getTextWidth(line) / 2, cy + 4 + i * 4, 9, true) })
      } else {
        const min = Math.min(0, ...points.map(p => p.value)), max = Math.max(1, ...points.map(p => p.value)), range = max - min, py = (value: number) => top + plotHeight - (value - min) / range * plotHeight
        for (let tick = 0; tick <= 4; tick++) { const value = min + range * tick / 4, tickY = py(value); doc.setDrawColor(...border); doc.setLineWidth(.15); doc.line(chartLeft, tickY, chartRight, tickY); text(new Intl.NumberFormat('es-GT', { notation: 'compact', maximumFractionDigits: 1 }).format(value), margin, tickY + 1, 8, false, muted) }
        const dx = plotWidth / points.length, baseline = py(0)
        points.forEach((point, i) => {
          const x = chartLeft + dx * (i + .5), valueY = py(point.value)
          if (chart.kind === 'line') { if (i) { doc.setDrawColor(...orange); doc.setLineWidth(.7); doc.line(chartLeft + dx * (i - .5), py(points[i - 1].value), x, valueY) } doc.setFillColor(...orange); doc.circle(x, valueY, 1, 'F') }
          else { doc.setFillColor(...(i === points.length - 1 ? orange : navy)); doc.rect(x - dx * .28, Math.min(valueY, baseline), dx * .56, Math.max(.2, Math.abs(baseline - valueY)), 'F') }
          const valueText = valueLabel(point.value), valueLines = wrap(valueText, dx - 1, 8)
          valueLines.forEach((line, n) => { doc.setFontSize(8); text(line, x - doc.getTextWidth(line) / 2, Math.max(top - 2, valueY - 3) - (valueLines.length - n - 1) * 3, 8) })
          labelLines[i].forEach((line, n) => { doc.setFont('Report', 'normal'); doc.setFontSize(8); text(line, x - doc.getTextWidth(line) / 2, top + plotHeight + 5 + n * 3.5, 8, false, muted) })
        })
      }
      y = top + boxHeight
    }
  }

  for (const section of report.sections) {
    ensure(27); heading(section.title)
    const body = section.rows.length ? section.rows.map(row => section.columns.map(column => formatReportCell(row[column.id], column, report))) : [[{ content: 'Sin registros para este alcance.', colSpan: section.columns.length }]]
    autoTable(doc, { startY: y, margin: { left: margin, right: margin, top: continuationTop, bottom: 20 }, theme: 'grid', head: [section.columns.map(c => c.label)], body,
      foot: section.totals && Object.keys(section.totals).length ? [section.columns.map((c, index) => Object.prototype.hasOwnProperty.call(section.totals!, c.id) ? formatReportCell(section.totals![c.id], c, report) : index === 0 ? 'Total del reporte' : '')] : undefined,
      showFoot: 'lastPage', styles: { font: 'Report', fontSize: 8, cellPadding: 2.1, overflow: 'linebreak', textColor: navy, lineColor: border, lineWidth: .1 },
      headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold', lineColor: navy }, footStyles: { fillColor: [232, 238, 245], textColor: navy, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 252] }, columnStyles: Object.fromEntries(section.columns.map((c, i) => [i, { halign: c.align }])),
      willDrawPage: data => { if (data.pageNumber > 1) continuedHeader() },
    })
    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }
  if (report.notes.length) { ensure(13); heading('Notas'); for (const note of report.notes) { for (const line of wrap(note, usable, 8)) { ensure(5); text(line, margin, y, 8, false, muted); y += 4 } y += 2 } }
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setDrawColor(...border); doc.setLineWidth(.2); doc.line(margin, height - 16, width - margin, height - 16); text(`${report.currency} · ${report.timezone}`, margin, height - 10, 8, false, muted); doc.setFontSize(8); const label = `Página ${i} de ${pages}`; text(label, width - margin - doc.getTextWidth(label), height - 10, 8, false, muted) }
  return doc.output('blob')
}
