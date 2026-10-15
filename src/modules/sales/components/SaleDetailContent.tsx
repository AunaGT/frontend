import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CreditCard, FileText, Mail, MapPin, Package, Phone, ShieldCheck, Tag, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ContactImage } from '@/components/shared/ContactImage'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useModules } from '@/context/useModules'
import type { Sale, SaleStatus } from '@/types'
import { formatMoney, formatDateTime } from '@/utils'
import { formatQuantity, previewLineTotal } from '@/lib/commercialQuantity'
import './saleDetail.css'
import {saleCommercialState,salePaymentLabel,fiscalLabel} from '../commercialPresentation'

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const labels = { draft:'Borrador',pending: 'Revisar estado', paid: 'Revisar estado', completed: 'Confirmada', cancelled: 'Cancelada',legacy:'Revisar estado' }
  return <StatusBadge status={labels[status] ?? 'Desconocido'} variant={status === 'cancelled' ? 'destructive' : undefined} />
}

export function SaleDetailContent({ sale, locale, currencyCode }: { sale: Sale; locale?: string; currencyCode?: string }) {
  const fmt = (value: number) => formatMoney(value, locale, currencyCode)
  const date = (value: string) => formatDateTime(value, undefined, locale)
  const contact = sale.customerContact
  const { hasPermission } = useAuthPermissions()
  const { isEnabled } = useModules()
  const canOpenContact = Boolean(contact && isEnabled('contacts') && hasPermission('contacts.clients.view'))
  const dte = sale.sale_dtes?.[0]
  const commercialState=saleCommercialState(sale)
  const isDraft=commercialState==='DRAFT'
  const returns = sale.hasReturns ? sale.returnDetails ?? [] : []
  const total = sale.hasReturns ? sale.adjustedTotal ?? sale.total : sale.total
  const hasDiscount = Number(sale.discountTotal) > 0
  const customerName = sale.customer || (sale.isFinalConsumer ? 'Consumidor final' : 'Cliente sin nombre')
  const paidAmount = commercialState!=='CONFIRMED' ? null : sale.isCredit ? sale.creditPaid ?? 0 : sale.paymentStatus === 'PAID' || sale.status === 'completed' ? total : null
  const balance = commercialState!=='CONFIRMED' ? null : sale.isCredit ? sale.creditBalance ?? 0 : paidAmount == null ? null : 0
  const activities = [
    { key: 'sale', date: sale.date, label: isDraft?'Borrador preparado':'Venta registrada', detail: sale.createdByName ? `Por ${sale.createdByName}` : undefined },
    ...returns.map((ret, index) => ({ key: `return-${index}`, date: ret.date, label: `Devolución ${ret.status.toLowerCase()}`, detail: ret.reason })),
    ...(dte?.emission_date ? [{ key: 'dte', date: dte.emission_date, label: 'Documento tributario registrado', detail: dte.status }] : []),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

  return (
    <div className="sale-detail-layout">
      <div className="sale-detail-main">
        <section className="auna-surface rounded-xl border" aria-label="Información de la venta">
          <header className="sale-detail-heading"><FileText aria-hidden /><h2>Información de la venta</h2></header>
          <dl className="sale-detail-facts">
            <div><dt>Fecha</dt><dd>{date(sale.date)}</dd></div>
            <div><dt>Vencimiento</dt><dd>{sale.dueDate ? date(sale.dueDate) : '—'}</dd></div>
            <div><dt>Folio</dt><dd>{sale.reference ?? '—'}</dd></div>
            <div><dt>Estado</dt><dd><SaleStatusBadge status={sale.status} /></dd></div>
            <div><dt>Moneda</dt><dd>{currencyCode || 'GTQ'}</dd></div>
            <div><dt>Condición de pago</dt><dd>{isDraft?'Por definir al confirmar':sale.isCredit ? 'Crédito' : 'Contado'}</dd></div>
            <div><dt>Facturación</dt><dd>{fiscalLabel(sale.commercial?.fiscalState||(dte?'REVIEW_REQUIRED':'UNRECORDED'))}</dd></div>
            <div><dt>Sucursal</dt><dd>{sale.branchName || '—'}</dd></div>
            <div><dt>Registrada por</dt><dd>{sale.createdByName || '—'}</dd></div>
          </dl>
        </section>

        <section className="auna-surface rounded-xl border overflow-hidden" aria-label="Productos de la venta">
          <header className="sale-detail-heading"><Package aria-hidden /><h2>Productos</h2><span className="ml-auto text-sm text-muted-foreground">{sale.products.length} {sale.products.length === 1 ? 'artículo' : 'artículos'}</span></header>
          <div className="sale-detail-products">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Producto</TableHead><TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Descuento</TableHead><TableHead className="text-right">Subtotal</TableHead>
              </TableRow></TableHeader>
              <TableBody>{sale.products.map((product, index) => (
                <TableRow key={`${product.id}-${index}`}>
                  <TableCell><div className="flex items-center gap-3 min-w-40">
                    {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" width={44} height={44} className="h-11 w-11 shrink-0 rounded-lg border border-border bg-background object-contain" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Package className="h-5 w-5" aria-hidden /></span>}
                    <div><p className="font-medium">{product.name}</p>{product.barcode && <p className="text-xs text-muted-foreground">{product.barcode}</p>}</div>
                  </div></TableCell>
                  <TableCell className="text-right tabular-nums">{formatQuantity(String(product.qty), locale)}{product.unitLabel && <span className="ml-1 text-xs text-muted-foreground">{product.unitLabel}</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(product.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{product.lineTotal == null ? '—' : fmt(Math.max(0, Number(previewLineTotal(String(product.qty), String(product.price))) - product.lineTotal))}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(product.lineTotal ?? Number(previewLineTotal(String(product.qty), String(product.price))))}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
            {!sale.products.length && <p className="p-6 text-center text-sm text-muted-foreground">Esta venta no tiene productos disponibles para mostrar.</p>}
          </div>
          <div className="sale-detail-financial-footer">
            <p className="text-xs text-muted-foreground">{sale.hasReturns ? 'El total neto descuenta las devoluciones registradas.' : 'Importes registrados al realizar la venta.'}{hasDiscount && sale.products.some(product => product.lineTotal == null) ? ' El descuento de esta venta histórica está registrado a nivel del documento.' : ''}</p>
            <dl className="sale-detail-payment">
              <div><dt>Subtotal</dt><dd>{fmt(sale.subtotal ?? sale.total + (sale.discountTotal ?? 0))}</dd></div>
              {hasDiscount && <div><dt>Descuentos</dt><dd>-{fmt(sale.discountTotal ?? 0)}</dd></div>}
              {sale.hasReturns && <div><dt>Devoluciones</dt><dd>-{fmt(sale.totalReturned ?? 0)}</dd></div>}
              <div className="sale-detail-total"><dt>Total neto</dt><dd>{fmt(total)}</dd></div>
            </dl>
          </div>
        </section>

        {(sale.promotions?.length || returns.length || dte) ? <section className="auna-surface rounded-xl border" aria-label="Otros datos de la venta">
          <header className="sale-detail-heading"><FileText aria-hidden /><h2>Documentos y movimientos</h2></header>
          {sale.promotions?.length ? <div className="sale-detail-rows">
            <h3 className="sale-detail-subheading"><Tag aria-hidden />Promociones aplicadas</h3>
            {sale.promotions.map(promo => <div key={promo.id} className="sale-detail-row">
              <div><p className="font-medium">{promo.promotion?.name || 'Promoción'}</p>
                {promo.promotion?.type?.name && <Badge variant="secondary">{promo.promotion.type.name}</Badge>}
                {promo.code_used && <p className="text-xs text-muted-foreground">Código: {promo.code_used}</p>}
              </div><strong>-{fmt(promo.discount_applied)}</strong>
            </div>)}
          </div> : null}
          {returns.length ? <div className="sale-detail-rows">
            <h3 className="sale-detail-subheading">Devoluciones</h3>
            {returns.map((ret, i) => <div className="sale-detail-return" key={`${ret.date}-${i}`}>
              <div className="sale-detail-row"><div>
                <p className="font-medium">{date(ret.date)} · {ret.status}</p>
                {ret.reason && <p className="text-xs text-muted-foreground">{ret.reason}</p>}
              </div><strong>-{fmt(ret.totalRefund)}</strong></div>
              <ul className="pb-3 space-y-1 text-sm" aria-label="Productos devueltos">
                {ret.items.map((item, index) => <li key={index} className="flex justify-between gap-4">
                  <span>{item.productName} × {item.qty} {item.unitLabel}</span><span className="shrink-0 tabular-nums">{fmt(item.refund)}</span>
                </li>)}
              </ul>
            </div>)}
          </div> : null}
          {dte&&dte.status!=='PENDING_CONNECTOR' ? <div className="sale-detail-rows">
            <h3 className="sale-detail-subheading"><ShieldCheck aria-hidden />{dte.provider==='EXTERNAL'?'Factura externa registrada':'Documento tributario registrado'}</h3>
            {dte.provider==='EXTERNAL'&&<p className="pb-3 text-xs text-muted-foreground">Sin verificación automática. Este registro no certifica ni anula el documento.</p>}
            <dl className="sale-detail-facts sale-detail-facts-compact">
              {dte.authorization && <div><dt>Identificador fiscal</dt><dd className="font-mono break-all">{dte.authorization}</dd></div>}
              {(dte.series || dte.number) && <div><dt>Serie / número</dt><dd>{[dte.series, dte.number].filter(Boolean).join(' — ')}</dd></div>}
              {dte.status && <div><dt>Estado</dt><dd><Badge variant="secondary">{dte.status}</Badge></dd></div>}
              {dte.provider && <div><dt>Origen del documento</dt><dd>{dte.provider==='EXTERNAL'?'Registro externo':dte.provider}</dd></div>}
              {dte.emission_date && <div><dt>Fecha de emisión</dt><dd>{date(dte.emission_date)}</dd></div>}
            </dl>
            {(dte.xml_url || dte.pdf_url) && <div className="flex flex-wrap gap-2 pb-4">
              {dte.xml_url && <Button variant="outline" size="sm" asChild><a href={dte.xml_url} target="_blank" rel="noopener noreferrer">Ver XML</a></Button>}
              {dte.pdf_url && <Button variant="outline" size="sm" asChild><a href={dte.pdf_url} target="_blank" rel="noopener noreferrer">Ver PDF</a></Button>}
            </div>}
          </div> : null}
        </section> : null}
      </div>

      <aside className="sale-detail-sidebar" aria-label="Cliente y pago">
        <section className="auna-surface rounded-xl border" aria-label="Cliente de la venta">
          <header className="sale-detail-heading"><UserRound aria-hidden /><h2>Cliente</h2></header>
          <div className="sale-detail-customer">
            <ContactImage src={contact?.imageUrl} name={customerName} className="h-24 w-24 rounded-xl object-contain" />
            <div className="min-w-0 flex-1"><h3 className="font-semibold break-words">{customerName}</h3>
              <p className="text-sm text-muted-foreground">NIT: {sale.isFinalConsumer ? 'CF' : sale.customerNit || '—'}</p>
              {contact?.name && contact.name !== customerName && <p className="mt-1 text-xs text-muted-foreground">Ficha actual: {contact.name}</p>}
              <dl className="sale-detail-contact">
                {contact?.address && <div><dt><MapPin aria-hidden /><span className="sr-only">Dirección actual</span></dt><dd>{contact.address}</dd></div>}
                {contact?.phone && <div><dt><Phone aria-hidden /><span className="sr-only">Teléfono actual</span></dt><dd>{contact.phone}</dd></div>}
                {contact?.email && <div><dt><Mail aria-hidden /><span className="sr-only">Correo actual</span></dt><dd>{contact.email}</dd></div>}
              </dl>
            </div>
          </div>
          {canOpenContact && <div className="flex justify-end px-4 pb-4"><Button variant="outline" size="sm" asChild><Link to={`/contactos/${contact!.id}`}>Ver contacto<ArrowRight aria-hidden /></Link></Button></div>}
        </section>

        <section className="auna-surface rounded-xl border" aria-label="Resumen de pago">
          <header className="sale-detail-heading"><CreditCard aria-hidden /><h2>Resumen de pago</h2>{balance != null && sale.status !== 'cancelled' && <span className="ml-auto"><StatusBadge status={balance > 0 ? 'Pendiente' : 'Pagado'} /></span>}</header>
          <dl className="sale-detail-payment">
            <div><dt>Total de la venta</dt><dd>{fmt(total)}</dd></div>
            {paidAmount != null && <div><dt>{sale.isCredit ? 'Abonos registrados' : 'Monto pagado'}</dt><dd>{fmt(paidAmount)}</dd></div>}
            {balance != null && <div className="sale-detail-balance"><dt>Saldo pendiente</dt><dd>{fmt(balance)}</dd></div>}
            <div className="sale-detail-method"><dt>Método de pago</dt><dd>{salePaymentLabel(sale)}</dd></div>
            {Number(sale.amountReceived) > 0 && <div><dt>Recibido</dt><dd>{fmt(sale.amountReceived)}</dd></div>}
            {Number(sale.change) > 0 && <div><dt>Vuelto</dt><dd>{fmt(sale.change)}</dd></div>}
            {sale.isCredit && <div><dt>Condición</dt><dd>Venta a crédito</dd></div>}
          </dl>
          {isDraft&&<p className="px-4 pb-4 text-sm text-muted-foreground">Los anticipos se registran en la contratación. No se aplican a esta venta hasta confirmarla.</p>}
        </section>

        <section className="auna-surface rounded-xl border" aria-label="Actividad registrada">
          <header className="sale-detail-heading"><CalendarDays aria-hidden /><h2>Historial y actividad</h2></header>
          <ol className="sale-detail-activity">
            {activities.map(activity => <li key={activity.key}><span className="sale-detail-activity-dot" aria-hidden /><div><p>{activity.label}</p><time dateTime={activity.date}>{date(activity.date)}</time>{activity.detail && <p className="text-xs text-muted-foreground">{activity.detail}</p>}</div></li>)}
          </ol>
        </section>
      </aside>
    </div>
  )
}
