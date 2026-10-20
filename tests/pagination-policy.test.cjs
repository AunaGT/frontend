const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

test('shared pagination exposes standard sizes and a size change returns to page one', () => {
  const nodes = [], changes = [], pages = []
  const { Pagination } = loadReportModule('../../components/shared/Pagination.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(Pagination, { currentPage: 3, totalPages: 8, totalItems: 79, count: 10, pageSize: 10, itemLabel: 'productos', onPageChange: n => pages.push(n), onPageSizeChange: n => changes.push(n) }))
  const select = nodes.find(n => n.type === 'select' && n.props['aria-label'] === 'Productos por página')
  assert.ok(select, 'The shared footer exposes a labelled size selector')
  assert.deepEqual(React.Children.toArray(select.props.children).map(n => n.props.value), [10, 25, 50, 100])
  select.props.onChange({ target: { value: '25' } })
  assert.deepEqual(changes, [25]); assert.deepEqual(pages, [1])
  assert.match(html, /Mostrando 21 a 30 de 79 productos/)
})

test('the last page keeps its actual last record instead of padding or discarding it', () => {
  const { Pagination } = loadReportModule('../../components/shared/Pagination.tsx')
  const html = renderToStaticMarkup(React.createElement(Pagination, { currentPage: 2, totalPages: 2, totalItems: 11, count: 1, pageSize: 10, onPageChange() {} }))
  assert.match(html, /Mostrando 11 a 11 de 11 registros/)
})
