import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Check, FileDown, FileText, Loader2, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { fetchPublicQuote, respondToPublicQuote } from '@/services/quoteService'
import { formatMoney, formatDateTime } from '@/utils/formatters'
import { CompanyLogo } from '@/components/branding/CompanyLogo'
import { applyDocumentBranding } from '@/utils/documentBranding'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { QuoteLines, QuoteStatusBadge, QuoteSummary } from './QuotePresentation'
import { generateQuotePDF } from './documents/generateQuotePDF'
import { canRespondToQuote } from './quoteViewModel.mjs'

export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const query = useQuery({ queryKey: ['public-quote', token], queryFn: () => fetchPublicQuote(token!), enabled: Boolean(token), retry: false })
  const data = query.data
  const response = useMutation({ mutationFn: (status: 'ACCEPTED' | 'REJECTED') => respondToPublicQuote(token!, status), onSuccess: () => { setDecision(null); queryClient.invalidateQueries({ queryKey: ['public-quote', token] }) }, onError: () => { queryClient.invalidateQueries({ queryKey: ['public-quote', token] }) } })
  useEffect(() => { if (data) applyDocumentBranding({ companyName: data.company_name, companyLogoUrl: data.company_logo_url, pageTitle: data.reference ? `Cotización ${data.reference}` : 'Cotización' }) }, [data])
  if (query.isLoading) return <main className="min-h-screen bg-brand-surface p-4 dark:bg-brand-navy sm:p-8"><div className="mx-auto max-w-[1560px] space-y-5"><h1 className="text-xl font-semibold">Cotización</h1><LoadingState variant="detail" message="Cargando cotización…" /></div></main>
  if (!data || query.isError) return <main className="flex min-h-screen items-center justify-center bg-brand-surface p-6 dark:bg-brand-navy"><Card className="w-full max-w-md"><CardHeader><CardTitle>Cotización no disponible</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>El enlace puede ser incorrecto o la cotización ya no está disponible. Consulta con tu asesor.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></CardContent></Card></main>
  const locale = data.locale || 'es-GT'
  const currencyCode = data.currency_code || 'GTQ'
  const money = (n: number) => formatMoney(n, locale, currencyCode)
  const canRespond = canRespondToQuote(data)
  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const logoDataUrl = await resolvePdfLogoDataUrl(data.company_logo_url).catch(() => undefined)
      generateQuotePDF({ id: data.reference || '', reference: data.reference, created_at: data.created_at, customer: data.customer, customer_nit: data.customer_nit, is_final_consumer: data.is_final_consumer, valid_until: data.valid_until, payment_condition: data.payment_condition, credit_days: data.credit_days, total: data.total, notes: data.notes, lines: data.lines.map((line, i) => ({ id: String(i), product_id: '', sort_order: i, ...line, product: { id: '', name: line.product_name || 'Producto', barcode: line.barcode } })) }, { companyName: data.company_name, logoDataUrl, locale, currencyCode })
    } finally { setPdfBusy(false) }
  }
  return <main className="quotes-page min-h-screen bg-brand-surface text-foreground dark:bg-brand-navy">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-[1560px] items-center justify-between gap-4 px-4 py-5 sm:px-8"><div className="flex items-center gap-4"><CompanyLogo src={data.company_logo_url} alt={`Logo de ${data.company_name}`} size="lg" fallback={data.company_name.slice(0, 1)} /><strong className="text-lg">{data.company_name}</strong></div><span className="hidden text-sm text-muted-foreground sm:block">Cotización para tu negocio</span></div></header>
    <div className="mx-auto max-w-[1560px] space-y-5 p-4 sm:p-8">
      {query.isFetching && <LoadingIndicator message="Actualizando cotización…" />}
      <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Cotización pública</p><h1>Tu proyecto, nuestra solución</h1><p className="auna-module-description">Gracias por confiar en {data.company_name}. Aquí encontrarás el detalle de tu cotización.</p></div><div className="flex items-center gap-3"><FileText className="h-7 w-7 text-brand-orange" /><div><strong>{data.reference || 'Cotización'}</strong><p className="text-sm text-muted-foreground">Emitida el {formatDateTime(data.created_at, { timeZone: data.timezone }, locale)}</p></div></div></header>
      <section className="grid gap-5 rounded-2xl border bg-card p-5 md:grid-cols-3"><div className="flex gap-3"><User className="h-6 w-6 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Cliente</p><strong>{data.customer || 'Consumidor final'}</strong><p className="text-sm text-muted-foreground">NIT: {data.is_final_consumer ? 'CF' : data.customer_nit || 'No registrado'}</p></div></div><div className="flex gap-3"><CalendarDays className="h-6 w-6 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Vigencia de la cotización</p><strong>{data.valid_until ? formatDateTime(data.valid_until, { timeZone: data.timezone }, locale) : 'Sin fecha límite'}</strong></div></div><div><QuoteStatusBadge status={data.status} /><p className="mt-2 text-sm text-muted-foreground">{canRespond ? 'Esta cotización está disponible para tu respuesta.' : data.status === 'ACCEPTED' ? 'Tu aceptación fue registrada.' : data.status === 'REJECTED' ? 'Tu rechazo fue registrado.' : 'Esta cotización ya no admite respuestas.'}</p></div></section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="min-w-0"><QuoteLines lines={data.lines.map((line) => ({ ...line, name: line.product_name || 'Producto', code: line.barcode, image: line.image_url }))} money={money} /></div><aside className="space-y-5"><QuoteSummary subtotal={data.subtotal} discount={data.discount_total} total={data.total} money={money} /><Card><CardHeader><CardTitle className="text-lg">Condiciones comerciales</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p className="font-semibold text-foreground">{data.payment_condition === 'CREDIT' ? `A crédito · ${data.credit_days} días desde la venta` : 'Al contado'}</p><p className="whitespace-pre-wrap">{data.notes || 'Consulta con tu asesor cualquier duda sobre esta cotización.'}</p><Button variant="outline" className="w-full" disabled={pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Descargar PDF</Button></CardContent></Card></aside></div>
      {response.isError && <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{response.error.message}</p>}
      {canRespond && <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border bg-card p-5"><div><h2 className="text-lg font-semibold">¿Deseas aceptar esta cotización?</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Al aceptar confirmas tu interés. La aceptación no registra una venta ni un pago; tu asesor continuará con el pedido.</p></div><div className="flex flex-wrap gap-3"><Button className="h-12 bg-brand-orange px-6 text-white hover:bg-brand-orange/90" disabled={response.isPending} onClick={() => setDecision('ACCEPTED')}><Check className="mr-2 h-5 w-5" />Aceptar cotización</Button><Button variant="outline" className="h-12 border-brand-orange px-6 text-brand-orange" disabled={response.isPending} onClick={() => setDecision('REJECTED')}><X className="mr-2 h-5 w-5" />Rechazar cotización</Button></div></section>}
      <footer className="flex flex-wrap justify-between gap-3 border-t py-5 text-sm text-muted-foreground"><strong>{data.company_name}</strong><span>Documento informativo · Precios en {currencyCode}</span></footer>
    </div>
    <AlertDialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !response.isPending) setDecision(null) }}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>{decision === 'ACCEPTED' ? '¿Aceptar esta cotización?' : '¿Rechazar esta cotización?'}</AlertDialogTitle><AlertDialogDescription>Se registrará tu respuesta y no podrás cambiarla desde este enlace. Si tienes dudas, consulta primero con tu asesor.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={response.isPending}>Volver</AlertDialogCancel><AlertDialogAction disabled={response.isPending} onClick={(event) => { event.preventDefault(); if (decision) response.mutate(decision) }}>{response.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar respuesta</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>
}
