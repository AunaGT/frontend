const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const settings = { '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) } }
const review = (extra = {}) => ({ id: 'c2', status: 'Pendiente', review_flow_version: 1, review_result: 'REVIEW', updated_at: '2026-10-31T10:00:00.000Z', supersedes_closure_id: 'c1', superseded_by_id: null, self: false,
  policy_snapshot: { source: 'BRANCH', revision: 2, cash_threshold: '5.00', digital_threshold: '0.00', blind_count: true },
  review_classification: { lines: [{ payment_method_id: 1, name: 'Efectivo', kind: 'CASH', expected: '100.00', actual: '97.00', difference: '-3.00', status: 'WITHIN' }, { payment_method_id: 2, name: 'Tarjeta', kind: 'DIGITAL', expected: '50.00', actual: '49.00', difference: '-1.00', status: 'REVIEW' }] },
  reviews: [], history: [{ id: 'c1', closure_number: 7, actual_total: '140.00', difference: '-10.00', review_result: 'REVIEW', review_classification: { lines: [] }, created_at: '2026-10-31T09:00:00.000Z', reviews: [{ action: 'RECOUNT_REQUESTED', reason: 'Contar de nuevo la tarjeta', actor_name: 'Encargada', created_at: '2026-10-31T09:10:00.000Z' }] }],
  can: { finalize: true, recount: true }, ...extra })
function panel(data) {
  const nodes = []
  const { ReviewPanel } = loadReportModule('../cash-closure/components/ReviewPanel.tsx', settings, nodes)
  const html = renderToStaticMarkup(React.createElement(ReviewPanel, { review: data, currencyCode: 'GTQ', busy: false, onFinalize: async () => {}, onRecount: async () => {} }))
  return { html, nodes }
}
test('the review panel classifies each method in sign and words, and asks for a reason before accepting differences', () => {
  const { html, nodes } = panel(review())
  assert.match(html, /−Q\s?3\.00/); assert.match(html, /−Q\s?1\.00/)
  for (const text of ['Requiere revisión', 'Dentro de tolerancia', 'Tolerancia efectivo', '5.00', 'Conteo ciego', 'Aceptar diferencias y finalizar', 'Pedir reconteo']) assert.ok(html.includes(text), text)
  assert.ok(nodes.some(n => n.props?.id === 'review-reason' && n.props['aria-required'] === true), 'the reason is required when differences exceed tolerance')
  assert.match(html, /<details/); assert.ok(html.includes('Contar de nuevo la tarjeta'), 'earlier declarations stay visible')
})
test('a clean closure finalizes without a reason and a reader without authority sees no actions', () => {
  assert.ok(panel(review({ review_result: 'CLEAN', history: [] })).html.includes('>Finalizar<'))
  const readOnly = panel(review({ can: { finalize: false, recount: false } })).html
  assert.equal(readOnly.includes('Pedir reconteo'), false); assert.equal(/type="submit"/.test(readOnly), false)
  const self = panel(review({ status: 'Aprobado', can: { finalize: false, recount: false }, reviews: [{ action: 'FINALIZED', reason: null, self_review: true, actor_name: 'Dueño', created_at: '2026-10-31T11:00:00.000Z' }] })).html
  assert.ok(self.includes('Autorrevisión'), 'a self-review is visible')
})
test('closure states read as the review flow names them', () => {
  const { closureStatusLabel } = loadReportModule('../cash-closure/types.ts')
  assert.equal(closureStatusLabel('Reconteo'), 'Reconteo solicitado'); assert.equal(closureStatusLabel('Sustituido'), 'Sustituido por reconteo'); assert.equal(closureStatusLabel('Pendiente'), 'Pendiente')
})
test('in blind count the counting form hides what is expected', () => {
  const { PaymentMethodsForm } = loadReportModule('../cash-closure/components/PaymentMethodsForm.tsx', settings)
  const rows = [{ breakdown_key: 'c', payment_method_id: 1, payment_method_name: 'Efectivo', settlement_kind: 'CASH', theoretical_amount: 0, theoretical_count: 0, actual_amount: 97, actual_count: null, difference: 0, notes: null }]
  const html = renderToStaticMarkup(React.createElement(PaymentMethodsForm, { blind: true, paymentBreakdown: rows, onUpdateAmount() {} }))
  assert.equal(html.includes('Esperado'), false); assert.equal(html.includes('Motivo de la diferencia'), false); assert.ok(html.includes('Efectivo contado en caja'))
})
test('the policy page sets both thresholds and blind count, and only the admin changes the owner exception', () => {
  const render = isAdmin => {
    const nodes = []
    const Page = loadReportModule('../cash-closure/CashPolicyPage.tsx', { ...settings,
      '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Central' } }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' } }) },
      '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/services/cashReviewService': {},
      '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ isLoading: false, data: queryKey[0] === 'cash-review-capabilities' ? { available: true, canManagePolicy: true, canReview: true, canDeclare: false, isAdmin }
        : { company: { cash_threshold: '5.00', digital_threshold: '0.00', blind_count: false, owner_self_review: false, revision: 1 }, branch: null, effective: { source: 'COMPANY', cash_threshold: '5.00', digital_threshold: '0.00', blind_count: false, owner_self_review: false, revision: 1 } } }), useQueryClient: () => ({ invalidateQueries() {} }) },
    }, nodes).default
    return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page))), nodes }
  }
  const manager = render(false)
  for (const text of ['Política de diferencias', 'Tolerancia en efectivo', 'Tolerancia en medios digitales', 'Conteo ciego', 'Dueño que opera solo']) assert.ok(manager.html.includes(text), text)
  assert.equal(manager.nodes.find(n => n.props?.id === 'policy-owner').props.disabled, true)
  assert.equal(render(true).nodes.find(n => n.props?.id === 'policy-owner').props.disabled, false)
  assert.equal(manager.html.includes('role="dialog"'), false); assert.match(manager.html, /max-w-\[960px\]/)
})

test('a turn in recount is pending work for its cashier and the POS offers to count it', () => {
  const React_ = React, { renderToStaticMarkup: render } = require('react-dom/server')
  const base = { id: 's', status: 'CLOSED', opened_by_id: 'qa', opened_at: '2026-10-09T08:00:00Z', closed_at: '2026-10-09T17:00:00Z' }
  let state, result
  const { useMineClosureGate } = loadReportModule('../cash-closure/hooks/useMineClosureGate.ts', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b' } }) },
    '@tanstack/react-query': { useQuery: () => state },
    '@/services/cashSessionsService': { fetchCashSessionCurrent() { throw new Error('No real requests allowed') }, sessionOpenedAtToLocalInput: value => value },
  })
  function Probe() { result = useMineClosureGate({ enabled: true, userId: 'qa', timezone: 'America/Guatemala' }); return null }
  const check = closableSession => { state = { isLoading: false, isPending: false, isFetching: false, refetch() {}, error: null, data: { ok: true, register: { id: 'r' }, session: null, closableSession } }; render(React_.createElement(Probe)); return result.gate }
  assert.equal(check({ ...base, cash_closure_id: 'c1', recount: true }).closableSessionId, 's')
  assert.equal(check({ ...base, cash_closure_id: 'c1' }).closableSessionId, null, 'a turn with a pending closure is not counted twice')
  const pos = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/modules/sales/NewSalePage.tsx'), 'utf8')
  assert.match(pos, /Contar efectivo/); assert.match(pos, /\/cierre-caja\/nuevo\?turno=/)
})
