// Offline layout regression: loads real styles, never the application or its database.
const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const root = path.resolve(__dirname, '../..')
process.chdir(root)
app.disableHardwareAcceleration()

async function run() {
  const styles = await postcss([tailwind({ config: path.join(root, 'tailwind.config.ts') })]).process(
    fs.readFileSync(path.join(root, 'src/index.css'), 'utf8'), { from: path.join(root, 'src/index.css') })
  const css = styles.css + ['components/shared/surfaces.css', 'components/shared/compactList.css',
    'modules/appointments/appointments.css', 'modules/config/pages/config.css',
    'modules/reports/reports.css', 'modules/sales/pos.css'].map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n')
  const window = new BrowserWindow({ show: false, width: 2560, height: 900, webPreferences: { sandbox: true, backgroundThrottling: false } })
  const cards = Array.from({ length: 11 }, (_, i) => `<article class="auna-record-card auna-surface rounded-xl border"><div class="auna-record-media"><img alt="" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80"><rect width="64" height="80" fill="silver"/></svg>')}"/></div><div class="auna-record-content"><strong>Producto ${i + 1}</strong><p>Código 7401001000096</p><p>Q 75.00 · 127 unidades</p></div></article>`).join('')
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
    <main class="auna-app-content">
      <section id="list" class="auna-page-fluid mx-auto max-w-[1560px] p-4 sm:p-8">
        <div class="compact-filter-search"><input aria-label="Buscar" style="width:100%"/></div>
        <div id="cards" class="auna-record-grid">${cards}</div>
        <div id="sparse" class="auna-record-grid">${cards.split('</article>')[0]}</article></div>
        <div class="auna-data-table-shell overflow-x-auto"><table style="width:100%;min-width:850px"><tr><td>Producto</td><td>Precio</td></tr></table></div>
      </section>
      <section id="detail" class="mx-auto max-w-[1560px] p-4 sm:p-8"><input style="width:100%" aria-label="Nombre"/></section>
      <section id="agenda" class="agenda-page auna-page-fluid"><div class="agenda-month"></div></section>
      <section id="editor" class="agenda-page"><div class="agenda-editor-grid"></div></section>
      <section id="config" class="config-page auna-page-fluid"><div class="config-center"><nav></nav><div class="config-center-content"><input aria-label="Empresa" style="width:100%"/></div></div></section>
      <section id="reports" class="reports-page auna-page-fluid"><div class="report-catalog-grid"><article class="report-catalog-entry">Ventas</article></div>
        <div class="report-config-grid"><section class="report-panel"><div class="report-field-grid"><input aria-label="Sucursal del reporte"/><input aria-label="Período"/></div></section><section class="report-panel">Secciones</section></div>
      </section>
      <section id="pos" class="pos-page auna-page-fluid"><div class="pos-workspace"><div class="pos-sale-column">Venta</div><div class="pos-catalog-column">Catálogo</div></div></section>
      <section id="cash" class="pos-page pos-cash-entry">Abrir caja</section>
    </main></body></html>`)}`)
  for (const dark of [false, true]) {
    await window.webContents.executeJavaScript(`document.documentElement.classList.toggle('dark',${dark})`)
    for (const width of [375, 768, 1366, 1920, 2560]) {
      await window.webContents.debugger.attach('1.3')
      await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      await window.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 30))')
      const actual = await window.webContents.executeJavaScript(`(() => {
        const width = id => document.getElementById(id).getBoundingClientRect().width;
        const cards = [...document.querySelectorAll('#cards > article')].map(el => { const r=el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width }; });
        const grid = getComputedStyle(document.getElementById('cards'));
        return { viewport:document.documentElement.clientWidth, page:width('list'), detail:width('detail'), agenda:width('agenda'), editor:width('editor'),
          config:width('config'), configForm:document.querySelector('.config-center-content').getBoundingClientRect().width,
          report:width('reports'), reportCard:document.querySelector('.report-catalog-entry').getBoundingClientRect().width,
          reportConfig:document.querySelector('.report-config-grid').getBoundingClientRect().width,
          pos:width('pos'), sale:document.querySelector('.pos-sale-column').getBoundingClientRect().width, cash:width('cash'),
          search:document.querySelector('.compact-filter-search').getBoundingClientRect().width,
          sparse:document.querySelector('#sparse > article').getBoundingClientRect().width,
          scroll:document.documentElement.scrollWidth, cards, gridWidth:width('cards'), columns:grid.gridTemplateColumns.split(' ').length };
      })()`)
      assert.ok(actual.viewport >= width - 20, 'renderer really resized to the requested viewport')
      assert.equal(actual.page, actual.viewport, `list uses available width at ${width}`)
      assert.equal(actual.agenda, actual.viewport, `calendar uses available width at ${width}`)
      assert.equal(actual.config, actual.viewport, `settings frame uses available width at ${width}`)
      assert.equal(actual.report, actual.viewport, `report workspace uses available width at ${width}`)
      assert.equal(actual.pos, actual.viewport, `POS uses available width at ${width}`)
      assert.ok(actual.detail <= 1560 && actual.editor <= 1536, 'detail and editor stay bounded')
      assert.ok(actual.configForm <= 1100 && actual.cash <= 1040, 'settings fields and cash opening stay bounded')
      assert.ok(actual.reportConfig <= 1496, 'report configuration stays bounded when a preview reload falls back to the form')
      assert.ok(actual.search <= 640, 'search does not stretch')
      assert.ok(actual.sparse <= 420 && actual.reportCard <= 420, 'sparse cards stay compact')
      assert.ok(actual.cards.every(card => card.width <= 420), 'record cards have a maximum usable width')
      assert.equal(actual.columns, Math.max(1, Math.floor((actual.gridWidth + 12) / 332)), 'CSS columns match card pagination')
      assert.ok(Math.abs(actual.cards[0].width - actual.cards.at(-1).width) < 1, 'last-row cards do not expand')
      assert.ok(actual.scroll <= actual.viewport, 'table overflow is local, not page-wide')
      if (width >= 1920) assert.ok(actual.sale <= 960, 'POS checkout fields stay bounded on wide displays')
      console.log(`PASS ${dark ? 'dark' : 'light'} ${width}px (${actual.columns} card columns)`)
      window.webContents.debugger.detach()
    }
  }
  window.destroy()
}
app.whenReady().then(run).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })
