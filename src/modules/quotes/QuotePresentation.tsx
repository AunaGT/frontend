import { useState } from 'react'
import './quoteLines.css'
import { Package, ReceiptText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { num, quoteStatusLabel, type QuoteStatus } from '@/services/quoteService'
import { serviceConditionText, type PublicServiceConditions } from '@/services/serviceConditions'

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const color = status === 'ACCEPTED' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : status === 'SENT' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
      : status === 'DRAFT' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${color}`}><span className="h-2 w-2 rounded-full bg-current" />{quoteStatusLabel(status)}</span>
}

export function QuoteProductImage({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  return src && !failed ? <img src={src} alt={name} onError={() => setFailed(true)} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border object-cover" />
    : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" aria-hidden="true" /></span>
}

export function QuoteSummary({ subtotal, discount, total, money }: { subtotal?: number | string | null; discount?: number | string | null; total: number | string; money: (value: number) => string }) {
  return <Card className="auna-surface"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ReceiptText className="h-5 w-5 text-brand-orange" />Resumen de cotización</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Subtotal</span><output className="auna-field-value-inline">{money(num(subtotal ?? total))}</output></div>
    {num(discount) > 0 && <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Descuento total</span><output className="auna-field-value-inline text-emerald-600 dark:text-emerald-300">− {money(num(discount))}</output></div>}
    <div className="flex flex-wrap justify-between gap-3 border-t pt-4 text-xl font-bold"><span>Total</span><output className="auna-field-value-inline text-brand-orange">{money(num(total))}</output></div>
    <p className="border-t pt-3 text-sm leading-relaxed text-muted-foreground">Los importes corresponden a esta cotización. La disponibilidad del horario se confirma al agendar. Esta cotización no es una factura.</p>
  </CardContent></Card>
}

type DisplayLine = { name: string; code?: string | null; image?: string | null; qty: string | number;unit_label?:string | null; unit_price: number | string; line_total: number | string;service_schedule_snapshot?:PublicServiceConditions|null;item_kind?:string }
export function QuoteLines({ lines, money, compact = false }: { lines: DisplayLine[]; money: (value: number) => string; compact?: boolean }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(lines.length / 10))
  const current = Math.min(page, pages)
  const shown = lines.slice((current - 1) * 10, current * 10)
  const conditions=(line:DisplayLine)=><QuoteServiceConditions snapshot={line.service_schedule_snapshot} missing={!compact&&line.item_kind==='SERVICE'}/>
  const table = <Table className={'auna-data-table min-w-[650px]'}><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader><TableBody>{shown.map((line, i) => <TableRow key={`${line.code}-${i}`}><TableCell>{(current - 1) * 10 + i + 1}</TableCell><TableCell><div className="flex items-center gap-3"><QuoteProductImage src={line.image} name={line.name} /><div className="min-w-0"><strong>{line.name}</strong><p className="text-xs text-muted-foreground">{line.code || 'Sin código'}</p>{conditions(line)}</div></div></TableCell><TableCell className="text-right">{line.qty} {line.unit_label}</TableCell><TableCell className="whitespace-nowrap text-right">{money(num(line.unit_price))}</TableCell><TableCell className="whitespace-nowrap text-right font-medium">{money(num(line.line_total))}</TableCell></TableRow>)}</TableBody></Table>
  return <><section className={compact ? 'auna-data-table-shell public-quote-products' : 'auna-data-table-shell'}>
    {compact ? <header className="public-quote-section-heading"><Package aria-hidden="true" /><h2>Partidas de la cotización</h2><span className="ml-auto shrink-0 text-xs text-muted-foreground">{lines.length} partidas</span></header> : <div className="px-5 py-4 text-lg font-semibold">Partidas ({lines.length})</div>}
    {compact ? !lines.length ? <EmptyState icon={Package} title="No hay partidas registradas" description="Consulta con tu asesor el detalle de esta cotización." /> : <>
      <div className="public-quote-products-scroll hidden sm:block" tabIndex={0} role="region" aria-label="Lista de partidas">{table}</div>
      <ul className="auna-section-list public-quote-mobile-products sm:hidden" tabIndex={0} aria-label="Partidas de la cotización">
        {shown.map((line, index) => <li key={`${line.code}-${index}`} className="auna-section-row">
          <div className="flex items-start gap-3"><QuoteProductImage src={line.image} name={line.name} /><div className="min-w-0 flex-1"><strong className="block break-words font-medium">{line.name}</strong><p className="text-xs text-muted-foreground">{line.code || 'Sin código'}</p>{conditions(line)}</div></div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-sm"><span className="text-muted-foreground">{line.qty} {line.unit_label} × {money(num(line.unit_price))}</span><strong className="tabular-nums">{money(num(line.line_total))}</strong></div>
        </li>)}
      </ul>
    </> : <div className="quote-lines-scroll" tabIndex={0} role="region" aria-label="Partidas de la cotización">{table}</div>}
  </section>
  {(!compact || pages > 1) && <div className="auna-pagination-outside"><Pagination currentPage={current} totalPages={pages} onPageChange={setPage} totalItems={lines.length} count={shown.length} itemLabel="partidas" /></div>}</>
}

export function QuoteServiceConditions({snapshot,missing=false}:{snapshot?:PublicServiceConditions|null;missing?:boolean}){
  if(!snapshot) return missing?<p className="mt-1 text-xs text-muted-foreground">Condiciones de programación no registradas</p>:null
  return <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer py-1 font-medium">Condiciones del servicio · {snapshot.durationMinutes} min</summary><p className="mt-1 whitespace-pre-line leading-relaxed">{serviceConditionText(snapshot)}</p></details>
}
