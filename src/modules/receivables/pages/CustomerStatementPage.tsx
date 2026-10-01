/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Estado de cuenta de un cliente: ventas al crédito, cobros y saldo.
 *
 * Por defecto el cobro se aplica a las facturas más viejas primero y no hay que
 * elegir nada; el reparto manual está detrás de un switch porque es la
 * excepción («este cheque es de la factura tal»), no lo de todos los días.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CalendarClock, FileDown, Loader2, Plus, Printer, Scissors, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePaymentMethods } from '@/hooks/usePaymentMethods'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { fetchCashSessionCurrent } from '@/services/cashSessionsService'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import {
  fetchCustomerStatement, fetchCompleteCustomerStatement, createCustomerPayment, deleteCustomerPayment,
  createCustomerAdjustment, applyCustomerCredit, updateSaleDueDate, fetchPaymentReceipt,
  SALE_PAYMENT_STATUS_LABELS, PAYMENT_KIND_LABELS,
  type PaymentApplication,
} from '../api/receivablesService'
import { Pagination } from '@/components/shared/Pagination'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { SavedCustomerMany2One } from '@/modules/sales/components/SavedCustomerMany2One'
import { useTenant } from '@/context/useTenant'
import { ReceivableMetrics, ReceivableStatus } from './ReceivablesPresentation'
import { downloadReceivablesCsv, matchesStatementRow, statementMovements, statementDate } from './statementViewModel.mjs'

const EPS = 0.005

export const CustomerStatementPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { company, branch, isConsolidated } = useTenant()
  const companyId = company?.id
  const branchId = isConsolidated ? 'all' : branch?.id
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const { companyName, companyLogoUrl, currencyCode, locale, timezone } = useSystemSettings()
  const isoDay = (iso?: string | null) => statementDate(iso, timezone)
  const puedeCobrar = hasPermission('receivables.manage') && branchId !== 'all'
  const puedeAjustar = hasPermission('receivables.adjust') && branchId !== 'all'

  const [cobroAbierto, setCobroAbierto] = useState(puedeCobrar && params.get('cobrar') === '1')
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<string>('')
  const [referencia, setReferencia] = useState('')
  const [manual, setManual] = useState(false)
  const [reparto, setReparto] = useState<Record<string, string>>({})
  const [confirmaAnticipo, setConfirmaAnticipo] = useState(false)
  const [porBorrar, setPorBorrar] = useState<string | null>(null)

  const [ajusteAbierto, setAjusteAbierto] = useState(false)
  const [ajusteTipo, setAjusteTipo] = useState<'CREDIT_NOTE' | 'WRITE_OFF'>('CREDIT_NOTE')
  const [ajusteMonto, setAjusteMonto] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')

  const [tab, setTab] = useState('MOVEMENTS')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState('ALL')
  const [state, setState] = useState('ALL')
  const [filters, setFilters] = useState({ from: '', to: '', kind: 'ALL', state: 'ALL' })
  const [exportOpen, setExportOpen] = useState(false)
  const [pdfPending, setPdfPending] = useState(false)
  const [exportPending, setExportPending] = useState(false)
  const [receiptPending, setReceiptPending] = useState<string | null>(null)
  const [preparedInvoice, setPreparedInvoice] = useState('')
  const fecha = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale, { timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'
  useEffect(() => {
    setPage(1)
    setTab('MOVEMENTS')
    setCobroAbierto(puedeCobrar && params.get('cobrar') === '1')
    setMonto(''); setReparto({}); setReferencia(''); setManual(Boolean(params.get('factura'))); setConfirmaAnticipo(false); setPreparedInvoice('')
  }, [id, params, puedeCobrar])
  const [prorroga, setProrroga] = useState<{ id: string; ref: string; due: string } | null>(null)

  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' })
    return (v: number) => fmt.format(Number(v) || 0)
  }, [locale, currencyCode])

  const history = useInfiniteQuery({
    queryKey: ['receivables', 'statement', companyId, branchId, id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchCustomerStatement(id!, pageParam, 100),
    getNextPageParam: last => last.history?.hasNextPage ? last.history.page + 1 : undefined,
    enabled: Boolean(id),
  })
  const { isLoading, isError, refetch } = history
  const first = history.data?.pages[0]
  const data = first ? { ...first, ventas: history.data.pages.flatMap(part => part.ventas), cobros: history.data.pages.flatMap(part => part.cobros) } : undefined
  useEffect(() => {
    const invoiceId = params.get('factura')
    if (!invoiceId || preparedInvoice === invoiceId || !data || !cobroAbierto) return
    const invoice = data.ventas.find(sale => sale.id === invoiceId)
    if (invoice) {
      setManual(true)
      setMonto(String(invoice.saldo))
      setReparto({ [invoice.id]: String(invoice.saldo) })
      setPreparedInvoice(invoiceId)
    } else if (history.hasNextPage && !history.isFetchingNextPage) {
      void history.fetchNextPage()
    }
  }, [params, preparedInvoice, data, cobroAbierto, history.hasNextPage, history.isFetchingNextPage, history.fetchNextPage])

  const { data: metodos } = usePaymentMethods()
  // Cobrar «al crédito» no significa nada: es justo lo que cancela el crédito.
  const metodosCobro = (metodos ?? []).filter((m) => !m.is_credit)

  // El turno abierto del cajero. Sin esto el efectivo cobrado no queda atado a
  // ningún turno y el arqueo tiene que adivinarlo por usuario y hora.
  const { data: sesion } = useQuery({
    queryKey: ['cash-session', 'current'],
    queryFn: () => fetchCashSessionCurrent(),
    enabled: puedeCobrar,
    staleTime: 60_000,
  })
  const sesionAbierta =
    sesion?.ok && sesion.session?.status === 'OPEN' ? sesion.session.id : undefined

  const refrescar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['receivables'] }),
      queryClient.invalidateQueries({ queryKey: ['credit-check'] }),
      queryClient.invalidateQueries({ queryKey: ['order'] }),
      queryClient.invalidateQueries({ queryKey: ['sales'] }),
    ])
    await refetch()
  }

  const cerrarCobro = () => {
    setCobroAbierto(false)
    if (params.has('cobrar')) setParams({}, { replace: true })
    setMonto('')
    setReferencia('')
    setManual(false)
    setReparto({})
    setConfirmaAnticipo(false)
  }

  const abiertas = (data?.ventas ?? []).filter((v) => v.saldo > EPS)
  const montoNum = Number(monto)
  const saldo = data?.resumen.saldo ?? 0

  const repartoLista: PaymentApplication[] = abiertas
    .map((v) => ({ sale_id: v.id, amount: Number(reparto[v.id]) }))
    .filter((a) => Number.isFinite(a.amount) && a.amount > 0)
  const repartoTotal = repartoLista.reduce((s, a) => s + a.amount, 0)
  const repartoExcedeFactura = abiertas.some((v) => Number(reparto[v.id]) > v.saldo + EPS)
  const sobrante = manual
    ? Math.max(0, montoNum - repartoTotal)
    : Math.max(0, montoNum - saldo)

  const montoInvalido = !Number.isFinite(montoNum) || montoNum <= 0
  const repartoInvalido = manual && (repartoTotal > montoNum + EPS || repartoExcedeFactura || repartoTotal <= 0)
  const faltaConfirmar = sobrante > EPS && !confirmaAnticipo

  const cobrar = useMutation({
    mutationFn: () =>
      createCustomerPayment({
        customer_id: id!,
        amount: montoNum,
        payment_method_id: Number(metodo),
        reference: referencia.trim() || undefined,
        cash_register_session_id: sesionAbierta,
        applications: manual ? repartoLista : undefined,
        allow_advance: sobrante > EPS ? true : undefined,
      }),
    onSuccess: async (res) => {
      const n = res.aplicaciones.length
      const extra = (res.no_aplicado ?? 0) > EPS
        ? ` ${money(res.no_aplicado ?? 0)} quedaron como saldo a favor.`
        : ''
      toast({
        title: 'Cobro registrado',
        description:
          `${money(res.amount)} aplicado a ${n} factura${n === 1 ? '' : 's'}.${extra}` +
          ` Saldo: ${money(res.resumen.saldo)}`,
      })
      cerrarCobro()
      await refrescar()
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo registrar el cobro', description: e.message, variant: 'destructive' }),
  })

  const ajustar = useMutation({
    mutationFn: () =>
      createCustomerAdjustment({
        customer_id: id!,
        amount: Number(ajusteMonto),
        kind: ajusteTipo,
        notes: ajusteMotivo.trim(),
      }),
    onSuccess: (res) => {
      toast({
        title: PAYMENT_KIND_LABELS[ajusteTipo] + ' registrada',
        description: `Se bajaron ${money(res.amount)} de la deuda. Saldo: ${money(res.resumen.saldo)}`,
      })
      setAjusteAbierto(false)
      setAjusteMonto('')
      setAjusteMotivo('')
      refrescar()
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo registrar el ajuste', description: e.message, variant: 'destructive' }),
  })

  const aplicarSaldoFavor = useMutation({
    mutationFn: () => applyCustomerCredit(id!),
    onSuccess: (res) => {
      toast({
        title: 'Saldo a favor aplicado',
        description: `${money(res.aplicado)} imputados a ${res.ventas_afectadas} factura(s).`,
      })
      refrescar()
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo aplicar', description: e.message, variant: 'destructive' }),
  })

  const prorrogar = useMutation({
    mutationFn: (p: { id: string; due: string }) => updateSaleDueDate(p.id, p.due),
    onSuccess: () => {
      toast({ title: 'Vencimiento actualizado' })
      setProrroga(null)
      refrescar()
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo prorrogar', description: e.message, variant: 'destructive' }),
  })

  const borrar = useMutation({
    mutationFn: (paymentId: string) => deleteCustomerPayment(paymentId),
    onSuccess: (res) => {
      toast({
        title: 'Movimiento eliminado',
        description: res.had_journal_entry
          ? `Ojo: ya estaba contabilizado en el asiento ${res.journal_entry_number}. Corregilo con un asiento manual.`
          : `${res.ventas_afectadas} factura(s) volvieron a su estado anterior.`,
        variant: res.had_journal_entry ? 'destructive' : undefined,
      })
      setPorBorrar(null)
      refrescar()
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo eliminar', description: e.message, variant: 'destructive' }),
  })

  const descargarEstado = async () => {
    if (!data) return
    setPdfPending(true)
    try {
      const { generateStatementPDF } = await import('./generateReceivablesPDF')
      const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
      const complete = await fetchCompleteCustomerStatement(id!)
      generateStatementPDF(complete, { companyName, logoDataUrl, currencyCode, locale, timezone })
    } catch (error) { toast({ title: 'No se pudo generar el estado de cuenta', description: (error as Error).message, variant: 'destructive' }) }
    finally { setPdfPending(false) }
  }

  const imprimirRecibo = async (paymentId: string) => {
    setReceiptPending(paymentId)
    try {
      const { generateReceiptPDF } = await import('./generateReceivablesPDF')
      const recibo = await fetchPaymentReceipt(paymentId)
      const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
      generateReceiptPDF(recibo, { companyName, logoDataUrl, currencyCode, locale, timezone })
    } catch (e) {
      toast({
        title: 'No se pudo generar el recibo',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally { setReceiptPending(null) }
  }

  if (isLoading) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }
  if (!data) {
    return <div className="receivables-page mx-auto max-w-[1560px] p-8"><Button variant="ghost" onClick={() => navigate('/cartera')}>Volver a cartera</Button><p role="alert">{isError ? 'No se pudo cargar el estado de cuenta.' : 'Cliente no encontrado.'}</p>{isError && <Button variant="outline" onClick={() => refetch()}>Reintentar</Button>}</div>
  }

  const { customer, resumen, ventas } = data
  const ajusteNum = Number(ajusteMonto)
  const ajusteInvalido =
    !Number.isFinite(ajusteNum) || ajusteNum <= 0 || ajusteNum > resumen.saldo + EPS || !ajusteMotivo.trim()

  const movements = statementMovements(data)
  const filteredMovements = movements.filter(row => matchesStatementRow(row, filters, timezone))
  const filteredSales = ventas.filter(sale => matchesStatementRow({ date: sale.date, kind: 'SALE', sale }, filters, timezone) && (tab !== 'DUE' || sale.saldo > EPS))
  const totalRows = tab === 'MOVEMENTS' ? filteredMovements.length : filteredSales.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(page, totalPages)
  const visibleMovements = filteredMovements.slice((safePage - 1) * pageSize, safePage * pageSize)
  const visibleSales = filteredSales.slice((safePage - 1) * pageSize, safePage * pageSize)
  const oldOverdue = resumen.vencido_30_mas ?? 0
  const exportColumns = (tab === 'MOVEMENTS' ? ['Fecha', 'Documento', 'Tipo', 'Descripción', 'Cargo', 'Abono', 'Saldo', 'Estado'] : ['Factura', 'Fecha', 'Vencimiento', 'Total', 'Abonado', 'Saldo', 'Estado']).map((label, index) => ({ id: String(index), label }))
  const exportCsv = async (selected: string[], fileName?: string) => {
    setExportPending(true)
    try {
    const complete = await fetchCompleteCustomerStatement(id!)
    const filteredMovements = statementMovements(complete).filter(row => matchesStatementRow(row, filters, timezone))
    const filteredSales = complete.ventas.filter(sale => matchesStatementRow({ date: sale.date, kind: 'SALE', sale }, filters, timezone) && (tab !== 'DUE' || sale.saldo > EPS))
    const rows = tab === 'MOVEMENTS'
      ? filteredMovements.map(row => [fecha(row.date), row.reference, row.kind === 'SALE' ? 'Factura' : PAYMENT_KIND_LABELS[row.kind], row.payment?.notes || row.payment?.payment_method?.name || 'Venta al crédito', row.charge, row.credit, row.balance, row.sale ? SALE_PAYMENT_STATUS_LABELS[row.sale.payment_status] : 'Aplicado'])
      : filteredSales.map(sale => [sale.reference || sale.id.slice(0, 8), fecha(sale.date), fecha(sale.due_date), sale.total, sale.abonado, sale.saldo, SALE_PAYMENT_STATUS_LABELS[sale.payment_status]])
    const columns = exportColumns.filter(column => selected.includes(column.id))
    downloadReceivablesCsv(fileName || 'estado-de-cuenta.csv', [columns.map(column => column.label), ...rows.map(row => columns.map(column => row[Number(column.id)]))])
    setExportOpen(false)
    } catch (error) { toast({ title: 'No se pudo exportar el estado de cuenta', description: (error as Error).message, variant: 'destructive' }) }
    finally { setExportPending(false) }
  }

  return (
    <div className="receivables-page mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
      <Button variant="ghost" onClick={() => navigate('/cartera')} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" />Cuentas por cobrar</Button>
      <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Finanzas · Cartera</p><h1>Estado de cuenta</h1><p className="auna-module-description">Consulta el saldo, vencimientos y movimientos de {customer.name}.</p></div><div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pdfPending} onClick={descargarEstado}>{pdfPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Estado de cuenta PDF</Button>
        {puedeAjustar && resumen.saldo > 0 && <Button variant="outline" onClick={() => setAjusteAbierto(true)}><Scissors className="mr-2 h-4 w-4" />Ajustar deuda</Button>}
        {puedeCobrar && <Button className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => setCobroAbierto(true)}><Plus className="mr-2 h-4 w-4" />Registrar cobro</Button>}
      </div></header>
      <section className="space-y-5 rounded-2xl border bg-card p-5">
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr_1fr_1fr_auto]">
          <div className="space-y-2"><Label>Cliente</Label><SavedCustomerMany2One mode="filter" valueId={customer.id} linkedDisplayName={customer.name} onPick={c => navigate('/cartera/' + c.id)} onClear={() => navigate('/cartera')} /></div>
          <div className="space-y-2"><Label htmlFor="statement-from">Desde</Label><Input id="statement-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="statement-to">Hasta</Label><Input id="statement-to" type="date" min={from} value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="space-y-2"><Label>Documento</Label><Select value={kind} onValueChange={setKind}><SelectTrigger aria-label="Tipo de documento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos</SelectItem><SelectItem value="SALE">Facturas</SelectItem>{Object.entries(PAYMENT_KIND_LABELS).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Estado</Label><Select value={state} onValueChange={setState}><SelectTrigger aria-label="Estado de factura"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos</SelectItem><SelectItem value="OVERDUE">Vencidas</SelectItem>{Object.entries(SALE_PAYMENT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <Button className="bg-brand-orange text-white hover:bg-brand-orange/90" disabled={Boolean(from && to && from > to)} onClick={() => { setFilters({ from, to, kind, state }); setPage(1) }}>Consultar</Button>
        </div>
        {from && to && from > to && <p role="alert" className="text-sm text-destructive">La fecha final debe ser posterior a la inicial.</p>}
        <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]"><div><h2 className="font-bold">{customer.name}</h2><p className="mt-1 text-sm text-muted-foreground">{[customer.tax_id && 'NIT ' + customer.tax_id, customer.contact, customer.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>{customer.address && <p className="mt-1 text-sm text-muted-foreground">{customer.address}</p>}</div><div><p className="text-sm text-muted-foreground">Límite de crédito</p><strong>{customer.credit_limit == null ? 'Sin límite' : money(customer.credit_limit)}</strong><p className="text-xs text-muted-foreground">{resumen.disponible == null ? '' : 'Disponible: ' + money(resumen.disponible)}</p></div><div><p className="text-sm text-muted-foreground">Días de crédito</p><strong>{customer.payment_term?.net_days ?? 'Sin plazo definido'}</strong></div><div><p className="text-sm text-muted-foreground">Condición de pago</p><strong>{customer.payment_term?.name || 'Sin condición definida'}</strong></div></div>
      </section>
      <ReceivableMetrics balance={resumen.saldo} overdue={resumen.vencido} upcoming={Math.max(0, resumen.saldo - resumen.vencido)} oldOverdue={oldOverdue} />
      {resumen.credito_disponible > EPS && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"><p className="text-sm">Saldo a favor sin aplicar: <strong>{money(resumen.credito_disponible)}</strong>. Saldo neto: <strong>{money(resumen.saldo_neto)}</strong>.</p>{puedeCobrar && resumen.saldo > EPS && <Button variant="outline" disabled={aplicarSaldoFavor.isPending} onClick={() => aplicarSaldoFavor.mutate()}>{aplicarSaldoFavor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar a facturas abiertas</Button>}</div>}
      <section className="auna-data-table-shell">
        {history.hasNextPage && <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 text-sm text-muted-foreground"><p>Historial parcial: {ventas.length + data.cobros.length} de {(data.history?.total_sales ?? 0) + (data.history?.total_payments ?? 0)} movimientos. Carga el historial completo para ver el saldo acumulado y consultar todas las fechas.</p><Button variant="outline" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cargar más movimientos</Button></div>}
        {history.isFetchNextPageError && <p role="alert" className="p-4 text-sm text-destructive">No se pudieron cargar más movimientos. Reintenta con el botón anterior.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 pt-3"><div className="flex gap-1" role="tablist" aria-label="Estado de cuenta">{[{ value: 'MOVEMENTS', label: 'Movimientos' }, { value: 'DUE', label: 'Vencimientos' }, { value: 'DOCS', label: 'Documentos' }].map(item => <button key={item.value} role="tab" aria-selected={tab === item.value} onClick={() => { setTab(item.value); setPage(1) }} className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === item.value ? 'border-brand-orange text-brand-orange' : 'border-transparent text-muted-foreground'}`}>{item.label}</button>)}</div><Button variant="outline" className="mb-3" disabled={!totalRows && !history.hasNextPage} onClick={() => setExportOpen(true)}><FileDown className="mr-2 h-4 w-4" />Exportar</Button></div>
        <div className="overflow-x-auto"><table className="auna-data-table min-w-[1000px]"><thead><tr>{[...exportColumns.map(column => column.label), 'Acciones'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {!totalRows && <tr><td colSpan={exportColumns.length + 1} className="text-center text-muted-foreground">No hay movimientos para estos filtros.</td></tr>}
          {tab === 'MOVEMENTS' ? visibleMovements.map(row => <tr key={row.kind + row.id}><td>{fecha(row.date)}</td><td className="font-semibold text-brand-orange">{row.reference}</td><td>{row.kind === 'SALE' ? 'Factura' : PAYMENT_KIND_LABELS[row.kind]}</td><td><p className="max-w-60 truncate" title={row.payment?.notes || ''}>{row.payment?.notes || row.payment?.payment_method?.name || 'Venta al crédito'}</p>{row.payment?.aplicaciones.length > 0 && <p className="text-xs text-muted-foreground">{row.payment.aplicaciones.map(a => a.reference || a.sale_id?.slice(0, 8)).join(', ')}</p>}</td><td className="whitespace-nowrap tabular-nums">{money(row.charge)}</td><td className="whitespace-nowrap tabular-nums">{money(row.credit)}</td><td className="whitespace-nowrap font-semibold tabular-nums">{history.hasNextPage ? '—' : money(row.balance)}</td><td>{row.sale ? <ReceivableStatus sale={row.sale} /> : <span className="whitespace-nowrap rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">{row.payment.no_aplicado > EPS ? 'Saldo a favor' : 'Aplicado'}</span>}</td><td><div className="flex gap-2">{row.payment && <><Button variant="outline" size="icon" aria-label="Descargar recibo" disabled={Boolean(receiptPending)} onClick={() => imprimirRecibo(row.id)}>{receiptPending === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}</Button>{puedeCobrar && <Button variant="outline" size="icon" aria-label="Eliminar movimiento" onClick={() => setPorBorrar(row.id)}><Trash2 className="h-4 w-4" /></Button>}</>}{row.sale && puedeCobrar && row.sale.saldo > EPS && <Button variant="outline" size="icon" aria-label="Prorrogar vencimiento" onClick={() => setProrroga({ id: row.id, ref: row.reference, due: isoDay(row.sale.due_date) })}><CalendarClock className="h-4 w-4" /></Button>}</div></td></tr>) : visibleSales.map(sale => <tr key={sale.id}><td className="font-semibold text-brand-orange">{sale.reference || sale.id.slice(0, 8)}</td><td>{fecha(sale.date)}</td><td className={sale.vencida ? 'text-destructive' : ''}>{fecha(sale.due_date)}{sale.vencida && <span className="ml-2 text-xs">({sale.dias_vencida} días)</span>}</td><td>{money(sale.total)}</td><td>{money(sale.abonado)}</td><td className="font-semibold">{money(sale.saldo)}</td><td><ReceivableStatus sale={sale} /></td><td>{puedeCobrar && sale.saldo > EPS && <Button variant="outline" size="icon" aria-label="Prorrogar vencimiento" onClick={() => setProrroga({ id: sale.id, ref: sale.reference || sale.id.slice(0, 8), due: isoDay(sale.due_date) })}><CalendarClock className="h-4 w-4" /></Button>}</td></tr>)}
        </tbody></table></div>
        <Pagination currentPage={safePage} totalPages={totalPages} totalItems={totalRows} pageSize={pageSize} count={tab === 'MOVEMENTS' ? visibleMovements.length : visibleSales.length} itemLabel={tab === 'MOVEMENTS' ? 'movimientos' : 'documentos'} onPageChange={setPage} />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>Los cargos muestran el importe neto de devoluciones.</p><div className="flex items-center gap-3"><Label>Filas por página</Label><Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1) }}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50].map(n => <SelectItem value={String(n)} key={n}>{n}</SelectItem>)}</SelectContent></Select></div></div>
      <ExportDialog open={exportOpen} onOpenChange={open => { if (!exportPending) setExportOpen(open) }} title="Exportar estado de cuenta" columns={exportColumns} summary="Se exporta el historial completo con los filtros aplicados." pending={exportPending} formats={['csv']} fileName="estado-de-cuenta" onExport={options => void exportCsv(options.columns ?? [], options.fileName)} />
      <Dialog open={cobroAbierto} onOpenChange={(o) => { if (cobrar.isPending) return; if (o) setCobroAbierto(true); else cerrarCobro() }}>
        <DialogContent variant="auna" className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              {manual ? 'Se aplica únicamente a las facturas seleccionadas.' : 'Se aplica a las facturas más antiguas primero.'} Saldo actual: {money(resumen.saldo)}.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <div>
              <Label htmlFor='monto'>Monto</Label>
              <Input
                id='monto'
                type='number'
                step='0.01'
                min='0'
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder='0.00'
              />
              {monto && montoInvalido && (
                <p className='mt-1 text-xs text-destructive'>Debe ser mayor a 0</p>
              )}
            </div>
            <div>
              <Label htmlFor='metodo'>Forma de pago</Label>
              <Select value={metodo} onValueChange={setMetodo}>
                <SelectTrigger id='metodo'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {metodosCobro.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor='ref'>Referencia (opcional)</Label>
              <Input
                id='ref'
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder='No. de recibo, boleta...'
              />
            </div>

            {history.hasNextPage && <Button variant="outline" disabled={history.isFetchingNextPage || cobrar.isPending} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cargar facturas anteriores</Button>}
            {resumen.facturas_abiertas > 1 && (
              <div className='flex items-center justify-between rounded-md border px-3 py-2'>
                <div>
                  <Label htmlFor='manual' className='cursor-pointer'>Elegir facturas</Label>
                  <p className='text-xs text-muted-foreground'>
                    {manual ? 'Revisa los importes que deseas aplicar a cada factura.' : 'Por defecto se paga de la más vieja a la más nueva.'}
                  </p>
                </div>
                <Switch id='manual' checked={manual} onCheckedChange={setManual} />
              </div>
            )}

            {manual && (
              <div className='space-y-2 rounded-md border p-3'>
                {abiertas.map((v) => (
                  <div key={v.id} className='flex items-center gap-2'>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate font-mono text-xs'>{v.reference || v.id.slice(0, 8)}</p>
                      <p className='text-xs text-muted-foreground'>
                        saldo {money(v.saldo)} · vence {fecha(v.due_date)}
                      </p>
                    </div>
                    <Input
                      type='number'
                      step='0.01'
                      min='0'
                      max={v.saldo}
                      className='h-8 w-28'
                      placeholder='0.00'
                      value={reparto[v.id] ?? ''}
                      aria-label={`Aplicar a factura ${v.reference || v.id.slice(0, 8)}`}
                      onChange={(e) => setReparto((r) => ({ ...r, [v.id]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className='flex justify-between border-t pt-2 text-xs'>
                  <span className='text-muted-foreground'>Repartido</span>
                  <span
                    className={
                      repartoTotal > montoNum + EPS ? 'font-medium text-destructive' : 'font-medium'
                    }
                  >
                    {money(repartoTotal)} de {money(Number.isFinite(montoNum) ? montoNum : 0)}
                  </span>
                </div>
                {repartoExcedeFactura && (
                  <p className='text-xs text-destructive'>
                    Hay facturas con más de su saldo asignado.
                  </p>
                )}
              </div>
            )}

            {sobrante > EPS && (
              <div className='flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3'>
                <Checkbox
                  id='anticipo'
                  checked={confirmaAnticipo}
                  onCheckedChange={(c) => setConfirmaAnticipo(c === true)}
                  className='mt-0.5'
                />
                <Label htmlFor='anticipo' className='cursor-pointer text-sm font-normal'>
                  Sobran {money(sobrante)} de lo que este cliente debe. Confirmo que quedan como
                  saldo a favor (si fue un error, corregí el monto).
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' disabled={cobrar.isPending} onClick={cerrarCobro}>Cancelar</Button>
            <Button
              onClick={() => cobrar.mutate()}
              disabled={
                montoInvalido || !metodo || repartoInvalido || faltaConfirmar || cobrar.isPending
              }
            >
              {cobrar.isPending && <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ajusteAbierto} onOpenChange={open => { if (!ajustar.isPending) setAjusteAbierto(open) }}>
        <DialogContent variant="auna">
          <DialogHeader>
            <DialogTitle>Ajustar la deuda</DialogTitle>
            <DialogDescription>
              Baja el saldo sin que entre dinero. Se aplica a las facturas más antiguas primero.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <div>
              <Label htmlFor='ajuste-tipo'>Tipo</Label>
              <Select
                value={ajusteTipo}
                onValueChange={(v) => setAjusteTipo(v as 'CREDIT_NOTE' | 'WRITE_OFF')}
              >
                <SelectTrigger id='ajuste-tipo'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='CREDIT_NOTE'>Nota de crédito (descuento, error)</SelectItem>
                  <SelectItem value='WRITE_OFF'>Incobrable (se da por perdido)</SelectItem>
                </SelectContent>
              </Select>
              <p className='mt-1 text-xs text-muted-foreground'>
                {ajusteTipo === 'CREDIT_NOTE'
                  ? 'Va contra devoluciones sobre ventas y devuelve el IVA débito.'
                  : 'Va a gasto por cuentas incobrables. Requiere esa cuenta configurada en contabilidad.'}
              </p>
            </div>
            <div>
              <Label htmlFor='ajuste-monto'>Monto</Label>
              <Input
                id='ajuste-monto'
                type='number'
                step='0.01'
                min='0'
                max={resumen.saldo}
                value={ajusteMonto}
                onChange={(e) => setAjusteMonto(e.target.value)}
                placeholder='0.00'
              />
              {ajusteMonto && ajusteNum > resumen.saldo + EPS && (
                <p className='mt-1 text-xs text-destructive'>
                  No puede exceder el saldo ({money(resumen.saldo)})
                </p>
              )}
            </div>
            <div>
              <Label htmlFor='ajuste-motivo'>Motivo</Label>
              <Textarea
                id='ajuste-motivo'
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                placeholder='Por qué se baja esta deuda'
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' disabled={ajustar.isPending} onClick={() => setAjusteAbierto(false)}>Cancelar</Button>
            <Button onClick={() => ajustar.mutate()} disabled={ajusteInvalido || ajustar.isPending}>
              {ajustar.isPending && <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(prorroga)} onOpenChange={(o) => { if (!o && !prorrogar.isPending) setProrroga(null) }}>
        <DialogContent variant="auna" className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Prorrogar vencimiento</DialogTitle>
            <DialogDescription>Factura {prorroga?.ref}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor='nuevo-vencimiento'>Nueva fecha</Label>
            <Input
              id='nuevo-vencimiento'
              type='date'
              value={prorroga?.due ?? ''}
              onChange={(e) => setProrroga((p) => (p ? { ...p, due: e.target.value } : p))}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' disabled={prorrogar.isPending} onClick={() => setProrroga(null)}>Cancelar</Button>
            <Button
              onClick={() => prorroga && prorrogar.mutate({ id: prorroga.id, due: prorroga.due })}
              disabled={!prorroga?.due || prorrogar.isPending}
            >
              {prorrogar.isPending && <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(porBorrar)} onOpenChange={(o) => { if (!o && !borrar.isPending) setPorBorrar(null) }}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Las facturas a las que se aplicó volverán a quedar pendientes. Si ya estaba
              contabilizado, el asiento no se revierte solo: hay que corregirlo a mano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={borrar.isPending}
              onClick={e => { e.preventDefault(); if (porBorrar && !borrar.isPending) borrar.mutate(porBorrar) }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CustomerStatementPage
