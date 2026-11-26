import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { ClosureReview, ReviewAction, ReviewResult } from '@/services/cashReviewService'
import { formatCurrency, formatDateTime, toNumber } from '../types'

const RESULT: Record<ReviewResult, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  CLEAN: { label: 'Sin diferencia', variant: 'outline' }, WITHIN: { label: 'Dentro de tolerancia', variant: 'secondary' }, REVIEW: { label: 'Requiere revisión', variant: 'destructive' },
}
const ACTION: Record<ReviewAction['action'], string> = { RECOUNT_REQUESTED: 'Reconteo solicitado', DIFFERENCES_ACCEPTED: 'Diferencias aceptadas', FINALIZED: 'Finalizado' }
const SOURCE = { DEFAULT: 'predeterminada', COMPANY: 'de la empresa', BRANCH: 'de la sucursal' }

type Props = { review: ClosureReview; currencyCode: string; busy: boolean; onFinalize: (reason?: string) => Promise<unknown>; onRecount: (reason: string) => Promise<unknown> }

// Revisión del arqueo con política: clasificación por medio (signo y texto, no solo color), acciones y declaraciones anteriores.
export function ReviewPanel({ review, currencyCode, busy, onFinalize, onRecount }: Props) {
  const { locale } = useSystemSettings()
  const [reason, setReason] = useState(''), [error, setError] = useState<string | null>(null)
  const money = (value: string) => { const n = toNumber(value); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n), currencyCode, locale)}` }
  const needsReason = review.review_result === 'REVIEW', policy = review.policy_snapshot, open = review.can.finalize || review.can.recount
  function finalize(event: FormEvent) {
    event.preventDefault()
    if (needsReason && !reason.trim()) { setError('Explica por qué aceptas las diferencias fuera de tolerancia.'); document.getElementById('review-reason')?.focus(); return }
    setError(null); void onFinalize(reason.trim() || undefined)
  }
  function recount() {
    if (!reason.trim()) { setError('Indica qué debe contarse de nuevo.'); document.getElementById('review-reason')?.focus(); return }
    setError(null); void onRecount(reason.trim())
  }
  return <section aria-labelledby="review-title" className="auna-surface cash-closure-panel space-y-4 rounded-lg border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 id="review-title" className="cash-closure-panel-heading"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />Revisión del arqueo</h2>
      <Badge variant={RESULT[review.review_result].variant}>{RESULT[review.review_result].label}</Badge>
    </div>
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Tolerancia efectivo</dt><dd className="tabular-nums">{formatCurrency(policy.cash_threshold, currencyCode, locale)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Tolerancia digital</dt><dd className="tabular-nums">{formatCurrency(policy.digital_threshold, currencyCode, locale)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Política</dt><dd>{SOURCE[policy.source]}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Conteo</dt><dd>{policy.blind_count ? 'Conteo ciego' : 'Con importes esperados'}</dd></div>
    </dl>
    <ul className="divide-y text-sm sm:hidden" aria-label="Clasificación por medio">{review.review_classification.lines.map(line => <li key={line.payment_method_id + line.kind} className="space-y-1 py-2">
      <div className="flex items-center justify-between gap-2"><span className="font-medium">{line.name}</span><Badge variant={RESULT[line.status].variant}>{RESULT[line.status].label}</Badge></div>
      <dl className="grid grid-cols-3 gap-2 tabular-nums">
        <div><dt className="text-xs text-muted-foreground">Esperado</dt><dd>{formatCurrency(line.expected, currencyCode, locale)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Contado</dt><dd>{formatCurrency(line.actual, currencyCode, locale)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Diferencia</dt><dd className="font-medium">{money(line.difference)}</dd></div>
      </dl>
    </li>)}</ul>
    <div className="hidden overflow-x-auto sm:block" role="region" aria-label="Clasificación por medio" tabIndex={0}>
      <table className="w-full text-sm">
        <caption className="sr-only">Diferencia de cada medio contra su tolerancia</caption>
        <thead><tr><th scope="col" className="text-left">Medio</th><th scope="col" className="cash-closure-money">Esperado</th><th scope="col" className="cash-closure-money">Contado</th><th scope="col" className="cash-closure-money">Diferencia</th><th scope="col" className="text-left">Resultado</th></tr></thead>
        <tbody>{review.review_classification.lines.map(line => <tr key={line.payment_method_id + line.kind}>
          <th scope="row" className="!bg-transparent text-left font-medium !text-foreground">{line.name}{line.name !== 'Efectivo' && <span className="block text-xs font-normal text-muted-foreground">{line.kind === 'CASH' ? 'Efectivo' : 'Digital'}</span>}</th>
          <td className="cash-closure-money">{formatCurrency(line.expected, currencyCode, locale)}</td>
          <td className="cash-closure-money">{formatCurrency(line.actual, currencyCode, locale)}</td>
          <td className="cash-closure-money font-medium">{money(line.difference)}</td>
          <td><Badge variant={RESULT[line.status].variant}>{RESULT[line.status].label}</Badge></td>
        </tr>)}</tbody>
      </table>
    </div>
    {review.reviews.length > 0 && <ul className="space-y-1 text-sm">{review.reviews.map(r => <li key={r.action}>
      <span className="font-medium">{ACTION[r.action]}</span> · {r.actor_name} · {formatDateTime(r.created_at)}{r.self_review && <Badge variant="outline" className="ml-2">Autorrevisión</Badge>}
      {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
    </li>)}</ul>}
    {open && <form onSubmit={finalize} noValidate className="space-y-3 border-t pt-3">
      {review.self && <p className="text-xs text-muted-foreground">Revisas tu propio arqueo con la excepción del dueño; quedará marcado como autorrevisión.</p>}
      <div className="space-y-1">
        <Label htmlFor="review-reason">{needsReason ? 'Motivo para aceptar las diferencias' : 'Motivo (obligatorio para pedir reconteo)'}</Label>
        <Textarea id="review-reason" rows={2} maxLength={1000} value={reason} disabled={busy} aria-required={needsReason} aria-invalid={!!error} aria-describedby={error ? 'review-error' : undefined} onChange={e => setReason(e.target.value)} />
        {error && <p id="review-error" role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {review.can.finalize && <Button type="submit" disabled={busy}>{needsReason ? 'Aceptar diferencias y finalizar' : 'Finalizar'}</Button>}
        {review.can.recount && <Button type="button" variant="outline" disabled={busy} onClick={recount}>Pedir reconteo</Button>}
      </div>
    </form>}
    {review.history.length > 0 && <details className="border-t pt-3 text-sm">
      <summary className="cursor-pointer font-medium">Declaraciones anteriores ({review.history.length})</summary>
      <ul className="mt-2 space-y-2">{review.history.map(h => <li key={h.id} className="rounded-md border p-2">
        <p>Arqueo #{h.closure_number} · {formatDateTime(h.created_at)} · contado {formatCurrency(h.actual_total, currencyCode, locale)} · diferencia {money(h.difference)} · {RESULT[h.review_result].label}</p>
        {h.reviews?.map(r => <p key={r.action} className="text-muted-foreground">{ACTION[r.action]} por {r.actor_name}{r.reason ? `: ${r.reason}` : ''}</p>)}
      </li>)}</ul>
    </details>}
  </section>
}
