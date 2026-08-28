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
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CalendarClock, FileDown, Loader2, Plus, Printer, Scissors, Trash2, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  fetchCustomerStatement, createCustomerPayment, deleteCustomerPayment,
  createCustomerAdjustment, applyCustomerCredit, updateSaleDueDate, fetchPaymentReceipt,
  SALE_PAYMENT_STATUS_LABELS, PAYMENT_KIND_LABELS,
  type PaymentApplication,
} from '@/services/receivablesService'
import { generateStatementPDF, generateReceiptPDF } from './generateReceivablesPDF'

const EPS = 0.005

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

/** yyyy-mm-dd para los <input type="date">. */
const isoDay = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

export const CustomerStatementPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const { companyName, companyLogoUrl, currencyCode, locale } = useSystemSettings()
  const puedeCobrar = hasPermission('receivables.manage')
  const puedeAjustar = hasPermission('receivables.adjust')

  const [cobroAbierto, setCobroAbierto] = useState(false)
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

  const [prorroga, setProrroga] = useState<{ id: string; ref: string; due: string } | null>(null)

  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' })
    return (v: number) => fmt.format(Number(v) || 0)
  }, [locale, currencyCode])

  const { data, isLoading } = useQuery({
    queryKey: ['receivables', 'statement', id],
    queryFn: () => fetchCustomerStatement(id!),
    enabled: Boolean(id),
  })

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

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['receivables'] })
  }

  const cerrarCobro = () => {
    setCobroAbierto(false)
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
    onSuccess: (res) => {
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
      refrescar()
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
    const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
    generateStatementPDF(data, { companyName, logoDataUrl, currencyCode, locale })
  }

  const imprimirRecibo = async (paymentId: string) => {
    try {
      const recibo = await fetchPaymentReceipt(paymentId)
      const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
      generateReceiptPDF(recibo, { companyName, logoDataUrl, currencyCode, locale })
    } catch (e) {
      toast({
        title: 'No se pudo generar el recibo',
        description: (e as Error).message,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }
  if (!data) {
    return <div className='container mx-auto p-6 text-muted-foreground'>Cliente no encontrado.</div>
  }

  const { customer, resumen, ventas, cobros } = data
  const ajusteNum = Number(ajusteMonto)
  const ajusteInvalido =
    !Number.isFinite(ajusteNum) || ajusteNum <= 0 || ajusteNum > resumen.saldo + EPS || !ajusteMotivo.trim()

  return (
    <div className='container mx-auto space-y-4 p-4 sm:p-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' onClick={() => navigate('/cartera')} className='mt-0.5'>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <h1 className='text-2xl font-semibold'>{customer.name}</h1>
            <p className='text-sm text-muted-foreground'>
              {[customer.contact, customer.tax_id && `NIT ${customer.tax_id}`, customer.phone]
                .filter(Boolean)
                .join(' · ') || 'Estado de cuenta'}
            </p>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' onClick={descargarEstado}>
            <FileDown className='mr-1.5 h-4 w-4' />
            Estado de cuenta
          </Button>
          {puedeAjustar && resumen.saldo > 0 && (
            <Button variant='outline' onClick={() => setAjusteAbierto(true)}>
              <Scissors className='mr-1.5 h-4 w-4' />
              Ajustar
            </Button>
          )}
          {puedeCobrar && resumen.saldo > 0 && (
            <Button onClick={() => setCobroAbierto(true)}>
              <Plus className='mr-1.5 h-4 w-4' />
              Registrar cobro
            </Button>
          )}
        </div>
      </div>

      {resumen.credito_disponible > EPS && (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-teal-500/40 bg-teal-500/5 px-4 py-3'>
          <p className='text-sm'>
            Este cliente tiene{' '}
            <span className='font-semibold'>{money(resumen.credito_disponible)}</span> a favor sin
            aplicar a ninguna factura.
          </p>
          {puedeCobrar && resumen.saldo > EPS && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => aplicarSaldoFavor.mutate()}
              disabled={aplicarSaldoFavor.isPending}
            >
              {aplicarSaldoFavor.isPending && <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />}
              Aplicar a las facturas abiertas
            </Button>
          )}
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>{money(resumen.saldo)}</p>
            <p className='text-xs text-muted-foreground'>
              {resumen.facturas_abiertas} factura(s) abierta(s)
              {resumen.credito_disponible > EPS && ` · neto ${money(resumen.saldo_neto)}`}
            </p>
          </CardContent>
        </Card>
        <Card className={resumen.vencido ? 'border-destructive/40' : undefined}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Vencido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${resumen.vencido ? 'text-destructive' : ''}`}>
              {money(resumen.vencido)}
            </p>
            <p className='text-xs text-muted-foreground'>{resumen.facturas_vencidas} vencida(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Disponible</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.credit_limit == null ? (
              <Badge variant='outline' className='font-normal'>Sin límite</Badge>
            ) : (
              <>
                <p className='text-2xl font-semibold'>{money(resumen.disponible ?? 0)}</p>
                <p className='text-xs text-muted-foreground'>de {money(customer.credit_limit)}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Ventas al crédito</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[42rem] text-sm'>
              <thead className='bg-muted/50 text-xs uppercase text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 text-left font-medium'>Factura</th>
                  <th className='px-4 py-2 text-left font-medium'>Fecha</th>
                  <th className='px-4 py-2 text-left font-medium'>Vence</th>
                  <th className='px-4 py-2 text-right font-medium'>Total</th>
                  <th className='px-4 py-2 text-right font-medium'>Abonado</th>
                  <th className='px-4 py-2 text-right font-medium'>Saldo</th>
                  <th className='px-4 py-2 text-left font-medium'>Estado</th>
                  {puedeCobrar && <th className='w-10' />}
                </tr>
              </thead>
              <tbody>
                {ventas.length === 0 && (
                  <tr>
                    <td colSpan={puedeCobrar ? 8 : 7} className='px-4 py-8 text-center text-muted-foreground'>
                      Este cliente no tiene ventas al crédito
                    </td>
                  </tr>
                )}
                {ventas.map((v) => (
                  <tr key={v.id} className='border-t'>
                    <td className='px-4 py-2 font-mono text-xs'>{v.reference || v.id.slice(0, 8)}</td>
                    <td className='px-4 py-2 text-muted-foreground'>{fecha(v.date)}</td>
                    <td className='px-4 py-2'>
                      <span className={v.vencida ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                        {fecha(v.due_date)}
                      </span>
                      {v.vencida && (
                        <span className='ml-1 text-xs text-destructive'>({v.dias_vencida}d)</span>
                      )}
                    </td>
                    <td className='px-4 py-2 text-right tabular-nums'>{money(v.total)}</td>
                    <td className='px-4 py-2 text-right tabular-nums text-muted-foreground'>
                      {money(v.abonado)}
                    </td>
                    <td className='px-4 py-2 text-right font-medium tabular-nums'>{money(v.saldo)}</td>
                    <td className='px-4 py-2'>
                      <Badge
                        variant={
                          v.payment_status === 'PAID'
                            ? 'outline'
                            : v.vencida
                              ? 'destructive'
                              : 'secondary'
                        }
                        className='font-normal'
                      >
                        {SALE_PAYMENT_STATUS_LABELS[v.payment_status]}
                      </Badge>
                    </td>
                    {puedeCobrar && (
                      <td className='px-2'>
                        {v.payment_status !== 'PAID' && (
                          <Button
                            variant='ghost'
                            size='icon'
                            title='Prorrogar vencimiento'
                            className='h-7 w-7 text-muted-foreground'
                            onClick={() =>
                              setProrroga({
                                id: v.id,
                                ref: v.reference || v.id.slice(0, 8),
                                due: isoDay(v.due_date),
                              })
                            }
                          >
                            <CalendarClock className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Wallet className='h-4 w-4 text-muted-foreground' />
            Cobros y ajustes
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[44rem] text-sm'>
              <thead className='bg-muted/50 text-xs uppercase text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 text-left font-medium'>Fecha</th>
                  <th className='px-4 py-2 text-left font-medium'>Tipo</th>
                  <th className='px-4 py-2 text-right font-medium'>Monto</th>
                  <th className='px-4 py-2 text-left font-medium'>Forma</th>
                  <th className='px-4 py-2 text-left font-medium'>Referencia</th>
                  <th className='px-4 py-2 text-left font-medium'>Aplicado a</th>
                  <th className='w-20' />
                </tr>
              </thead>
              <tbody>
                {cobros.length === 0 && (
                  <tr>
                    <td colSpan={7} className='px-4 py-8 text-center text-muted-foreground'>
                      Todavía no se le ha cobrado nada
                    </td>
                  </tr>
                )}
                {cobros.map((c) => (
                  <tr key={c.id} className='border-t'>
                    <td className='px-4 py-2 text-muted-foreground'>{fecha(c.paid_at)}</td>
                    <td className='px-4 py-2'>
                      {c.kind === 'PAYMENT' ? (
                        <span className='text-muted-foreground'>Cobro</span>
                      ) : (
                        <Badge variant='outline' className='font-normal'>
                          {PAYMENT_KIND_LABELS[c.kind]}
                        </Badge>
                      )}
                    </td>
                    <td className='px-4 py-2 text-right font-medium tabular-nums'>{money(c.amount)}</td>
                    <td className='px-4 py-2'>{c.payment_method?.name || '—'}</td>
                    <td className='px-4 py-2 text-muted-foreground'>{c.reference || '—'}</td>
                    <td className='px-4 py-2 text-xs text-muted-foreground'>
                      {c.aplicaciones.map((a) => a.reference || a.sale_id?.slice(0, 8)).join(', ') || '—'}
                      {c.no_aplicado > EPS && (
                        <span className='ml-1 text-teal-600'>
                          (+{money(c.no_aplicado)} a favor)
                        </span>
                      )}
                    </td>
                    <td className='px-2'>
                      <div className='flex justify-end'>
                        <Button
                          variant='ghost'
                          size='icon'
                          title='Imprimir recibo'
                          className='h-7 w-7 text-muted-foreground'
                          onClick={() => imprimirRecibo(c.id)}
                        >
                          <Printer className='h-3.5 w-3.5' />
                        </Button>
                        {puedeCobrar && (
                          <Button
                            variant='ghost'
                            size='icon'
                            title='Eliminar'
                            className='h-7 w-7 text-muted-foreground hover:text-destructive'
                            onClick={() => setPorBorrar(c.id)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={cobroAbierto} onOpenChange={(o) => (o ? setCobroAbierto(true) : cerrarCobro())}>
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              Se aplica a las facturas más antiguas primero. Saldo actual: {money(resumen.saldo)}.
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

            {abiertas.length > 1 && (
              <div className='flex items-center justify-between rounded-md border px-3 py-2'>
                <div>
                  <Label htmlFor='manual' className='cursor-pointer'>Elegir facturas</Label>
                  <p className='text-xs text-muted-foreground'>
                    Por defecto se paga de la más vieja a la más nueva.
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
            <Button variant='outline' onClick={cerrarCobro}>Cancelar</Button>
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

      <Dialog open={ajusteAbierto} onOpenChange={setAjusteAbierto}>
        <DialogContent>
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
            <Button variant='outline' onClick={() => setAjusteAbierto(false)}>Cancelar</Button>
            <Button onClick={() => ajustar.mutate()} disabled={ajusteInvalido || ajustar.isPending}>
              {ajustar.isPending && <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(prorroga)} onOpenChange={(o) => !o && setProrroga(null)}>
        <DialogContent className='sm:max-w-sm'>
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
            <Button variant='outline' onClick={() => setProrroga(null)}>Cancelar</Button>
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

      <AlertDialog open={Boolean(porBorrar)} onOpenChange={(o) => !o && setPorBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Las facturas a las que se aplicó volverán a quedar pendientes. Si ya estaba
              contabilizado, el asiento no se revierte solo: hay que corregirlo a mano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => porBorrar && borrar.mutate(porBorrar)}
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
