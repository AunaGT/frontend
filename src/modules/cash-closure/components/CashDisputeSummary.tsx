import type {DisputeDocument} from '@/services/cashDisputeService'
import {formatCurrency} from '../types'
export function CashDisputeSummary({doc,locale}:{doc:Pick<DisputeDocument,'claimed'|'withdrawn'|'recovered'|'charged'|'customerCredit'|'disposed'|'unresolved'|'currencyCode'>;locale:string}){
  const money=(v:string)=>formatCurrency(v,doc.currencyCode,locale)
  return <section className="auna-surface min-w-0 space-y-3 rounded-lg border p-4" aria-label="Resumen de la disputa">
    <h2 className="text-sm font-semibold">Dinero y saldo del cliente</h2>
    <dl className="space-y-2 text-sm">{[['Reclamado',doc.claimed],['Retirado o retenido',doc.withdrawn],['Recuperado',doc.recovered],['Pendiente de resolver',doc.unresolved]].map(([label,amount])=><div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{money(amount)}</dd></div>)}</dl>
    <dl className="space-y-2 border-t pt-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt>Cargo al cliente</dt><dd className="font-semibold tabular-nums">{money(doc.charged)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Crédito por recuperación</dt><dd className="font-medium tabular-nums">{money(doc.customerCredit)}</dd></div></dl>
    <p className="text-xs text-muted-foreground">Abrir un reclamo no crea una deuda. Un cargo requiere una resolución aprobada.</p>
  </section>
}
