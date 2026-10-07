import { useState } from 'react'
import { Package, ReceiptText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination } from '@/components/shared/Pagination'
import { num, quoteStatusLabel, type QuoteStatus } from '@/services/quoteService'

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
    <p className="border-t pt-3 text-sm leading-relaxed text-muted-foreground">Los precios y la disponibilidad se verifican al confirmar el pedido. Esta cotización no es una factura.</p>
  </CardContent></Card>
}

type DisplayLine = { name: string; code?: string | null; image?: string | null; qty: number; unit_price: number | string; line_total: number | string }
export function QuoteLines({ lines, money }: { lines: DisplayLine[]; money: (value: number) => string }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(lines.length / 10))
  const current = Math.min(page, pages)
  const shown = lines.slice((current - 1) * 10, current * 10)
  return <><section className="auna-data-table-shell"><div className="px-5 py-4 text-lg font-semibold">Partidas ({lines.length})</div><Table className="min-w-[650px]"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader><TableBody>{shown.map((line, i) => <TableRow key={`${line.code}-${i}`}><TableCell>{(current - 1) * 10 + i + 1}</TableCell><TableCell><div className="flex items-center gap-3"><QuoteProductImage src={line.image} name={line.name} /><div><strong>{line.name}</strong><p className="text-xs text-muted-foreground">{line.code || 'Sin código'}</p></div></div></TableCell><TableCell className="text-right">{line.qty}</TableCell><TableCell className="text-right">{money(num(line.unit_price))}</TableCell><TableCell className="text-right font-medium">{money(num(line.line_total))}</TableCell></TableRow>)}</TableBody></Table></section>
<div className="auna-pagination-outside"><Pagination currentPage={current} totalPages={pages} onPageChange={setPage} totalItems={lines.length} count={shown.length} itemLabel="partidas" /></div></>
}
