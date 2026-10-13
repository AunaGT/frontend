import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Check, FileDown, FileText, Loader2, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { fetchPublicQuote, num, respondToPublicQuote } from '@/services/quoteService'
import { formatMoney, formatDateTime } from '@/utils/formatters'
import { CompanyLogo } from '@/components/branding/CompanyLogo'
import { applyDocumentBranding } from '@/utils/documentBranding'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { QuoteLines, QuoteStatusBadge, QuoteSummary } from './QuotePresentation'
import { generateQuotePDF } from './documents/generateQuotePDF'
import { canRespondToQuote } from './quoteViewModel.mjs'
import './publicQuote.css'

export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['public-quote', token], queryFn: () => fetchPublicQuote(token!), enabled: Boolean(token), retry: false })
  const data = query.data
  const response = useMutation({
    mutationFn: (status: 'ACCEPTED' | 'REJECTED') => respondToPublicQuote(token!, status),
    onSuccess: () => { setDecision(null); queryClient.invalidateQueries({ queryKey: ['public-quote', token] }) },
    onError: () => { queryClient.invalidateQueries({ queryKey: ['public-quote', token] }) },
  })
  useEffect(() => {
    if (data) applyDocumentBranding({ companyName: data.company_name, companyLogoUrl: data.company_logo_url, pageTitle: data.reference ? 'Cotización ' + data.reference : 'Cotización' })
  }, [data])

  if (token && query.isLoading) return <main className="public-quote-page"><div className="public-quote-container"><h1 className="mb-5 text-xl font-semibold">Cotización</h1><LoadingState variant="detail" message="Cargando cotización…" /></div></main>
  if (!token || !data || query.isError) return <main className="public-quote-page public-quote-unavailable"><section className="auna-surface public-quote-section">
    <EmptyState icon={FileText} title="Cotización no disponible" description="El enlace puede ser incorrecto o la cotización ya no está disponible. Consulta con tu asesor." action={token && <Button variant="outline" onClick={() => { void query.refetch() }}>Reintentar</Button>} />
  </section></main>

  const locale = data.locale || 'es-GT'
  const currencyCode = data.currency_code || 'GTQ'
  const money = (n: number) => formatMoney(n, locale, currencyCode)
  const canRespond = canRespondToQuote(data)
  const statusMessage = canRespond ? 'Esta cotización está disponible para tu respuesta.'
    : data.status === 'ACCEPTED' ? 'Tu aceptación fue registrada.'
      : data.status === 'REJECTED' ? 'Tu rechazo fue registrado.'
        : data.status === 'CANCELLED' ? 'Esta cotización fue cancelada.'
          : data.status === 'EXPIRED' || (data.status === 'SENT' && !canRespond) ? 'La vigencia de esta cotización terminó.'
            : 'Esta cotización todavía no admite respuestas.'
  const creditTerm = num(data.credit_days) > 0 ? 'A crédito · ' + data.credit_days + ' días desde la venta' : 'A crédito · Plazo según lo acordado'
  const downloadPdf = async () => {
    if (pdfBusy) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      const logoDataUrl = await resolvePdfLogoDataUrl(data.company_logo_url).catch(() => undefined)
      generateQuotePDF({ id: data.reference || '', reference: data.reference, created_at: data.created_at, customer: data.customer, customer_nit: data.customer_nit, is_final_consumer: data.is_final_consumer, valid_until: data.valid_until, payment_condition: data.payment_condition, credit_days: data.credit_days, total: data.total, notes: data.notes, lines: data.lines.map((line, i) => ({ id: String(i), product_id: '', sort_order: i, ...line, product: { id: '', name: line.product_name || 'Producto', barcode: line.barcode } })) }, { companyName: data.company_name, logoDataUrl, locale, currencyCode })
    } catch {
      setPdfError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally { setPdfBusy(false) }
  }

  return <div className="public-quote-page">
    <header className="public-quote-brand">
      <div className="public-quote-container flex items-center gap-3">
        <CompanyLogo src={data.company_logo_url} alt={'Logo de ' + data.company_name} size="md" fallback={data.company_name.slice(0, 2) || 'A'} />
        <div className="min-w-0"><strong className="block break-words">{data.company_name}</strong><span className="text-xs text-muted-foreground">Cotización para tu negocio</span></div>
      </div>
    </header>
    <main className="public-quote-container">
      {query.isFetching && <LoadingIndicator message="Actualizando cotización…" />}
      <header className="public-quote-identity">
        <div className="flex flex-wrap items-center gap-3"><h1>Cotización {data.reference || ''}</h1><QuoteStatusBadge status={data.status === 'SENT' && !canRespond ? 'EXPIRED' : data.status} /></div>
        <p>Emitida el {formatDateTime(data.created_at, { timeZone: data.timezone }, locale)}</p>
      </header>

      <section className="auna-surface public-quote-info" aria-label="Información de la cotización">
        <div className="public-quote-info-item"><User aria-hidden="true" /><div className="min-w-0"><p className="public-quote-label">Cliente</p><strong className="break-words">{data.customer || 'Consumidor final'}</strong><p className="mt-1 text-sm text-muted-foreground">NIT: {data.is_final_consumer ? 'CF' : data.customer_nit || 'No registrado'}</p></div></div>
        <div className="public-quote-info-item"><CalendarDays aria-hidden="true" /><div className="min-w-0"><p className="public-quote-label">Vigencia de la cotización</p><strong>{data.valid_until ? formatDateTime(data.valid_until, { timeZone: data.timezone }, locale) : 'Sin fecha límite'}</strong></div></div>
        <div className="public-quote-info-item"><FileText aria-hidden="true" /><div className="min-w-0"><p className="public-quote-label">Respuesta del cliente</p><p className="text-sm" role="status">{statusMessage}</p></div></div>
      </section>

      <div className="public-quote-layout">
        <div className="min-w-0"><QuoteLines compact lines={data.lines.map(line => ({ ...line, name: line.product_name || 'Producto', code: line.barcode, image: line.image_url }))} money={money} /></div>
        <aside className="public-quote-sidebar" aria-label="Resumen y condiciones">
          <QuoteSummary subtotal={data.subtotal ?? num(data.total) + num(data.discount_total)} discount={data.discount_total} total={data.total} money={money} />
          <section className="auna-surface public-quote-section">
            <header className="public-quote-section-heading"><FileText aria-hidden="true" /><h2>Condiciones comerciales</h2></header>
            <div className="public-quote-section-body">
              <p className="text-sm font-medium">{data.payment_condition === 'CREDIT' ? creditTerm : 'Al contado'}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{data.notes || 'Consulta con tu asesor cualquier duda sobre esta cotización.'}</p>
              <Button variant="outline" className="mt-4 w-full" disabled={pdfBusy} onClick={downloadPdf}>
                {pdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />}Descargar PDF
              </Button>
              {pdfError && <p className="mt-2 text-sm text-destructive" role="alert">{pdfError}</p>}
            </div>
          </section>
        </aside>
      </div>

      {response.isError && !decision && <p role="alert" className="mt-4 text-sm text-destructive">{response.error.message}</p>}
      {canRespond && <section className="auna-surface public-quote-response" aria-label="Responder a la cotización">
        <div><h2 className="text-base font-semibold">¿Deseas aceptar esta cotización?</h2><p className="mt-1 text-sm text-muted-foreground">La aceptación no registra una venta ni un pago; tu asesor continuará con el pedido.</p></div>
        <div className="public-quote-response-actions">
          <Button disabled={response.isPending || query.isFetching} onClick={() => setDecision('ACCEPTED')}><Check className="mr-2 h-4 w-4" aria-hidden="true" />Aceptar cotización</Button>
          <Button variant="outline" disabled={response.isPending || query.isFetching} onClick={() => setDecision('REJECTED')}><X className="mr-2 h-4 w-4" aria-hidden="true" />Rechazar cotización</Button>
        </div>
      </section>}

      <footer className="public-quote-footer"><strong>{data.company_name}</strong><span>Documento informativo · Precios en {currencyCode}</span></footer>
    </main>

    <AlertDialog open={Boolean(decision)} onOpenChange={open => { if (!open && !response.isPending) setDecision(null) }}>
      <AlertDialogContent variant="auna">
        <AlertDialogHeader><AlertDialogTitle>{decision === 'ACCEPTED' ? '¿Aceptar esta cotización?' : '¿Rechazar esta cotización?'}</AlertDialogTitle><AlertDialogDescription>Se registrará tu respuesta y no podrás cambiarla desde este enlace. Si tienes dudas, consulta primero con tu asesor.</AlertDialogDescription></AlertDialogHeader>
        {response.isError && <p role="alert" className="text-sm text-destructive">{response.error.message}</p>}
        {!canRespond && <p role="alert" className="text-sm text-muted-foreground">Esta cotización ya no admite respuestas.</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={response.isPending}>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={response.isPending || query.isFetching || !canRespond} onClick={event => { event.preventDefault(); if (decision && canRespond && !response.isPending && !query.isFetching) response.mutate(decision) }}>
            {response.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Confirmar respuesta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
