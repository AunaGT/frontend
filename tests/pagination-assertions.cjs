const assert = require('node:assert/strict')

// SSR markup has no scripts/comments with tags. Keep the check dependency-free.
exports.assertPaginationOutside = html => {
  const stack = []
  let count = 0
  for (const match of html.matchAll(/<(\/)?([a-z][\w-]*)\b([^>]*)>/gi)) {
    const [, closing, tag, attributes] = match
    if (closing) { stack.pop(); continue }
    const classes = attributes.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) ?? []
    if (classes.includes('auna-data-table-pagination') || classes.includes('alerts-table-footer') || classes.includes('auna-import-pagination') || tag.toLowerCase() === 'nav' && /aria-label="Paginación/.test(attributes)) {
      count++
      assert.ok(!stack.some(item => item.some(cls => ['auna-data-table-shell', 'auna-surface', 'users-panel', 'auna-panel', 'alerts-list-panel', 'auna-import-panel'].includes(cls))), 'Pagination must be outside the framed result, not inside its table/card/scroll container')
    }
    if (!['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tag.toLowerCase())) stack.push(classes)
  }
  assert.ok(count > 0, 'Fixture must exercise a visible pagination footer')
}
