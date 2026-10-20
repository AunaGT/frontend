import {isUnitDocumentLine,remainingDocumentQuantity,compareUnitQuantities,formatUnitDecimal,documentUnitPrice} from '@/modules/inventory/units/public'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Building2, Check, Clock3, FileText, Mail, MapPin, Package, PackageCheck, Phone, Truck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CompanyLogo } from '@/components/branding/CompanyLogo'
import { EmptyState } from '@/components/shared/EmptyState'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { applyDocumentBranding } from '@/utils/documentBranding'
import { formatDateTime, formatMoney } from '@/utils/formatters'
import { fetchPublicOrder, num } from '@/services/orderService'
import { formatQuantity, remainingQuantity } from '@/lib/commercialQuantity'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { orderProgressStep, paginateOrderLines } from '../ordersViewModel'
import './publicOrder.css'

const locale = 'es-GT'
const currencyCode = 'GTQ'
const progressLabels = ['Creado', 'Confirmado', 'Preparación', 'Entrega', 'Completado']
const progressShortLabels = ['Creado', 'Conf.', 'Prepar.', 'Entrega', 'Completo']
const statusMessages = {
  DRAFT: 'Pendiente de confirmación',
  CONFIRMED: 'Estamos preparando tu pedido',
  PARTIALLY_FULFILLED: 'Tu pedido tiene entregas parciales',
  FULFILLED: 'Tu pedido fue completado',
  CANCELLED: 'Este pedido fue cancelado',
  EXPIRED: 'La vigencia de este pedido terminó',
}

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['public-order', token],
    queryFn: () => fetchPublicOrder(token!),
    enabled: Boolean(token),
    retry: false,
  })

  useEffect(() => {
    if (!data) return
    applyDocumentBranding({
      companyName: data.company_name,
      companyLogoUrl: data.company_logo_url,
      pageTitle: data.reference ? 'Pedido ' + data.reference : 'Pedido',
    })
  }, [data])

  if (!token) return <PublicState />
  if (isLoading) return <main className="public-order-page"><div className="public-order-container"><h1 className="mb-5 text-xl font-semibold">Seguimiento de pedido</h1><LoadingState variant="detail" message="Cargando seguimiento del pedido…" /></div></main>
  if (isError || !data) return <PublicState onRetry={() => { void refetch() }} />

  const fmt = (value: number | string | null | undefined) => formatMoney(num(value), locale, currencyCode)
  const step = orderProgressStep(data.status)
  const hasServices = data.lines.some(line => line.item_kind === 'SERVICE'||isUnitDocumentLine(line))
  const ordered = hasServices ? data.lines.length : data.lines.reduce((sum, line) => sum + num(line.qty), 0)
  const fulfilled = hasServices ? data.lines.filter(line => isUnitDocumentLine(line)?compareUnitQuantities(remainingDocumentQuantity(line),'0')===0:num(line.qty_fulfilled)>=num(line.qty)).length : data.lines.reduce((sum, line) => sum + num(line.qty_fulfilled), 0)
  const lines = paginateOrderLines(data.lines, page, 10)
  const creditTerm = num(data.credit_days) > 0 ? 'Crédito a ' + data.credit_days + ' días desde la venta' : 'Crédito · Plazo según lo acordado'
  const subtotal = data.subtotal ?? num(data.total) + num(data.discount_total)

  return <div className="public-order-page">
    <header className="public-order-brand">
      <div className="public-order-container flex items-center gap-3">
        <CompanyLogo src={data.company_logo_url} alt={data.company_name} fallback={data.company_name?.slice(0, 2) || 'A'} size="md" />
        <div className="min-w-0"><strong className="block break-words">{data.company_name}</strong><span className="text-xs text-muted-foreground">Seguimiento de pedido</span></div>
      </div>
    </header>
    <main className="public-order-container">
      {isFetching && <LoadingIndicator message="Actualizando pedido…" />}
      <header className="public-order-identity">
        <div className="flex flex-wrap items-center gap-3"><h1>Pedido {data.reference || ''}</h1><OrderStatusBadge status={data.status} /></div>
        <p>Creado {formatDateTime(data.created_at, undefined, locale)} · Actualizado {formatDateTime(data.updated_at, undefined, locale)}</p>
      </header>

      <div className="public-order-layout">
        <div className="public-order-main">
          <section className="auna-surface public-order-section" aria-label="Cumplimiento del pedido">
            <header className="public-order-section-heading"><Truck aria-hidden="true" /><h2>Cumplimiento del pedido</h2></header>
            <div className="public-order-section-body">
              <p className="text-sm font-medium">{statusMessages[data.status]}</p>
              {step > 0 && <ol className="public-order-progress" aria-label="Etapas del pedido">
                {progressLabels.map((label, index) => {
                  const current = step === index + 1
                  const complete = step > index + 1 || data.status === 'FULFILLED'
                  const Icon = complete ? Check : index === 3 ? Truck : index === 4 ? PackageCheck : Clock3
                  return <li key={label} aria-current={current ? 'step' : undefined} data-state={current ? 'current' : complete ? 'complete' : 'pending'}>
                    <span className="public-order-progress-marker"><Icon aria-hidden="true" /></span><span className="hidden sm:inline">{label}</span><span className="sm:hidden"><span className="sr-only">{label}</span><span aria-hidden="true">{progressShortLabels[index]}</span></span>
                  </li>
                })}
              </ol>}
              <MetricStrip className="public-order-quantities" label={hasServices ? 'Partidas del pedido' : 'Unidades del pedido'} items={[
                { label: 'Solicitado', value: ordered },
                { label: 'Entregado', value: fulfilled },
                { label: 'Pendiente', value: Math.max(0, ordered - fulfilled) },
              ]} />
            </div>
          </section>

          <div className="min-w-0">
            <section className="auna-surface public-order-section" aria-label="Productos del pedido">
              <header className="public-order-section-heading"><Package aria-hidden="true" /><h2>Productos</h2><span className="ml-auto text-xs text-muted-foreground">{data.lines.length} partidas</span></header>
              {!data.lines.length ? <CollectionEmptyState compact title="Tu pedido espera sus partidas" description="Los productos aparecerán aquí cuando la empresa los agregue al pedido." /> : <>
                <div className="auna-data-table-shell auna-table-embedded public-order-products-table hidden sm:block" tabIndex={0} role="region" aria-label="Lista de productos">
                  <Table className="auna-data-table min-w-[640px]">
                    <TableHeader><TableRow><TableHead>Producto / código</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Entregado</TableHead><TableHead className="text-right">P. unitario</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
                    <TableBody>{lines.items.map((line, index) => <TableRow key={index}>
                      <TableCell><strong className="block font-medium">{line.product_name || 'Producto'}</strong><span className="text-xs text-muted-foreground">{line.barcode || 'Sin código'}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{isUnitDocumentLine(line)?formatUnitDecimal(String(line.qty),locale):formatQuantity(String(line.qty), locale)} {line.unit_label}</TableCell><TableCell className="text-right tabular-nums">{isUnitDocumentLine(line)?`${line.base_fulfilled??'0'} ${line.unit_snapshot!.baseUnit.label}`:`${formatQuantity(String(line.qty_fulfilled),locale)} ${line.unit_label??''}`}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{isUnitDocumentLine(line)?`${currencyCode} ${documentUnitPrice(line,locale)}`:fmt(line.unit_price)}</TableCell><TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{fmt(line.line_total)}</TableCell>
                    </TableRow>)}</TableBody>
                  </Table>
                </div>
                <ul className="auna-section-list public-order-mobile-products sm:hidden" tabIndex={0} aria-label="Partidas del pedido">
                  {lines.items.map((line, index) => <li key={index} className="auna-section-row">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block font-medium">{line.product_name || 'Producto'}</strong><span className="text-xs text-muted-foreground">{line.barcode || 'Sin código'}</span></div><strong className="shrink-0 tabular-nums">{fmt(line.line_total)}</strong></div>
                    <dl className="public-order-mobile-quantities"><InfoRow label="Cantidad" value={`${isUnitDocumentLine(line)?formatUnitDecimal(String(line.qty),locale):formatQuantity(String(line.qty),locale)} ${line.unit_label||''}`} /><InfoRow label="Entregado" value={isUnitDocumentLine(line)?`${line.base_fulfilled??'0'} ${line.unit_snapshot!.baseUnit.label}`:`${formatQuantity(String(line.qty_fulfilled),locale)} ${line.unit_label||''}`} /><InfoRow label="Pendiente" value={isUnitDocumentLine(line)?`${remainingDocumentQuantity(line)} ${line.unit_snapshot!.baseUnit.label}`:`${formatQuantity(remainingQuantity(String(line.qty),String(line.qty_fulfilled)),locale)} ${line.unit_label||''}`} /></dl>
                    <p className="text-xs text-muted-foreground">Precio unitario: {isUnitDocumentLine(line)?`${currencyCode} ${documentUnitPrice(line,locale)}`:fmt(line.unit_price)}</p>
                  </li>)}
                </ul>
              </>}
            </section>
            {lines.totalPages > 1 && <div className="auna-pagination-outside"><Pagination currentPage={lines.page} totalPages={lines.totalPages} onPageChange={setPage} totalItems={lines.totalItems} pageSize={lines.pageSize} count={lines.items.length} itemLabel="partidas" /></div>}
          </div>

          {data.notes && <section className="auna-surface public-order-section">
            <header className="public-order-section-heading"><FileText aria-hidden="true" /><h2>Notas</h2></header>
            <p className="public-order-section-body whitespace-pre-wrap break-words text-sm">{data.notes}</p>
          </section>}
        </div>

        <aside className="public-order-sidebar" aria-label="Cliente y resumen del pedido">
          <section className="auna-surface public-order-section">
            <header className="public-order-section-heading"><UserRound aria-hidden="true" /><h2>Cliente</h2></header>
            <div className="public-order-section-body flex items-start gap-3">
              <Building2 className="h-10 w-10 shrink-0 rounded-lg bg-muted p-2 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <strong className="block break-words">{data.customer || data.customer_contact?.name || 'Cliente'}</strong>
                <p className="mt-1 text-sm text-muted-foreground">NIT: {data.is_final_consumer ? 'CF' : data.customer_nit || '—'}</p>
                <dl className="public-order-contact">
                  {data.customer_contact?.contact && <div><dt><UserRound aria-label="Contacto" /></dt><dd>{data.customer_contact.contact}</dd></div>}
                  {data.customer_contact?.address && <div><dt><MapPin aria-label="Dirección" /></dt><dd>{data.customer_contact.address}</dd></div>}
                  {data.customer_contact?.phone && <div><dt><Phone aria-label="Teléfono" /></dt><dd>{data.customer_contact.phone}</dd></div>}
                  {data.customer_contact?.email && <div><dt><Mail aria-label="Correo electrónico" /></dt><dd>{data.customer_contact.email}</dd></div>}
                </dl>
              </div>
            </div>
          </section>

          <section className="auna-surface public-order-section">
            <header className="public-order-section-heading"><FileText aria-hidden="true" /><h2>Resumen del pedido</h2><span className="ml-auto text-xs text-muted-foreground">{currencyCode}</span></header>
            <div className="public-order-section-body">
              <dl className="public-order-facts">
                <InfoRow label="Subtotal" value={fmt(subtotal)} />
                {num(data.discount_total) > 0 && <InfoRow label="Descuento" value={'−' + fmt(data.discount_total)} />}
                <div className="public-order-total"><dt>Total del pedido</dt><dd>{fmt(data.total)}</dd></div>
              </dl>
              <dl className="public-order-facts public-order-terms">
                <InfoRow label="Condición de pago" value={data.payment_condition === 'CREDIT' ? creditTerm : 'Al contado'} />
                <InfoRow label="Sucursal / origen" value={data.branch?.name || '—'} />
                <InfoRow label="Canal" value={data.sales_channel || '—'} />
                {data.valid_until && <InfoRow label="Vigencia" value={formatDateTime(data.valid_until, undefined, locale)} />}
              </dl>
            </div>
          </section>

          {data.sales.length > 0 && <section className="auna-surface public-order-section" aria-label="Ventas vinculadas">
            <header className="public-order-section-heading"><FileText aria-hidden="true" /><h2>Ventas vinculadas</h2></header>
            <ul className="auna-section-list public-order-sales">{data.sales.map((sale, index) => <li className="auna-section-row" key={index}>
              <div className="flex items-start justify-between gap-3"><strong className="font-medium">{sale.reference || 'Venta'}</strong>{sale.total != null && <span className="shrink-0 tabular-nums">{fmt(sale.total)}</span>}</div>
              {sale.date && <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(sale.date, undefined, locale)}</p>}
              {sale.status && <p className="mt-1 text-xs text-muted-foreground">{sale.status}</p>}
            </li>)}</ul>
          </section>}
        </aside>
      </div>
      <footer className="public-order-footer">Documento informativo · Precios en {currencyCode}</footer>
    </main>
  </div>
}

function PublicState({ onRetry }: { onRetry?: () => void }) {
  return <main className="public-order-page public-order-unavailable"><section className="auna-surface public-order-section">
    <EmptyState icon={Package} title="Pedido no disponible" description="No pudimos consultar este pedido. Revisa el enlace o consulta con la empresa." action={onRetry && <Button variant="outline" onClick={onRetry}>Reintentar</Button>} />
  </section></main>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
