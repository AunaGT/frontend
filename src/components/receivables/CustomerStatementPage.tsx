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
 * Estado de cuenta de un cliente: sus ventas al crédito, sus cobros y el saldo.
 * El cobro se registra por monto y el servidor lo aplica a las facturas más
 * viejas primero, así que aquí no se elige factura.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  fetchCustomerStatement, createCustomerPayment, deleteCustomerPayment,
  SALE_PAYMENT_STATUS_LABELS,
} from '@/services/receivablesService'

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const CustomerStatementPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const { currencyCode, locale } = useSystemSettings()
  const puedeCobrar = hasPermission('receivables.manage')

  const [cobroAbierto, setCobroAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<string>('')
  const [referencia, setReferencia] = useState('')
  const [porBorrar, setPorBorrar] = useState<string | null>(null)

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

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['receivables'] })
  }

  const cobrar = useMutation({
    mutationFn: () =>
      createCustomerPayment({
        customer_id: id!,
        amount: Number(monto),
        payment_method_id: Number(metodo),
        reference: referencia.trim() || undefined,
      }),
    onSuccess: (res) => {
      const n = res.aplicaciones.length
      toast({
        title: 'Cobro registrado',
        description: `${money(res.amount)} aplicado a ${n} factura${n === 1 ? '' : 's'}. Saldo: ${money(res.resumen.saldo)}`,
      })
      setCobroAbierto(false)
      setMonto('')
      setReferencia('')
      refrescar()
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo registrar el cobro', description: e.message, variant: 'destructive' }),
  })

  const borrar = useMutation({
    mutationFn: (paymentId: string) => deleteCustomerPayment(paymentId),
    onSuccess: (res) => {
      toast({
        title: 'Cobro eliminado',
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
  const montoNum = Number(monto)
  const montoInvalido = !Number.isFinite(montoNum) || montoNum <= 0 || montoNum > resumen.saldo + 0.005

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
        {puedeCobrar && resumen.saldo > 0 && (
          <Button onClick={() => setCobroAbierto(true)}>
            <Plus className='mr-1.5 h-4 w-4' />
            Registrar cobro
          </Button>
        )}
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>{money(resumen.saldo)}</p>
            <p className='text-xs text-muted-foreground'>{resumen.facturas_abiertas} factura(s) abierta(s)</p>
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
            <table className='w-full min-w-[40rem] text-sm'>
              <thead className='bg-muted/50 text-xs uppercase text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 text-left font-medium'>Factura</th>
                  <th className='px-4 py-2 text-left font-medium'>Fecha</th>
                  <th className='px-4 py-2 text-left font-medium'>Vence</th>
                  <th className='px-4 py-2 text-right font-medium'>Total</th>
                  <th className='px-4 py-2 text-right font-medium'>Abonado</th>
                  <th className='px-4 py-2 text-right font-medium'>Saldo</th>
                  <th className='px-4 py-2 text-left font-medium'>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventas.length === 0 && (
                  <tr>
                    <td colSpan={7} className='px-4 py-8 text-center text-muted-foreground'>
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
            Cobros
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[40rem] text-sm'>
              <thead className='bg-muted/50 text-xs uppercase text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 text-left font-medium'>Fecha</th>
                  <th className='px-4 py-2 text-right font-medium'>Monto</th>
                  <th className='px-4 py-2 text-left font-medium'>Forma</th>
                  <th className='px-4 py-2 text-left font-medium'>Referencia</th>
                  <th className='px-4 py-2 text-left font-medium'>Aplicado a</th>
                  {puedeCobrar && <th className='w-10' />}
                </tr>
              </thead>
              <tbody>
                {cobros.length === 0 && (
                  <tr>
                    <td colSpan={puedeCobrar ? 6 : 5} className='px-4 py-8 text-center text-muted-foreground'>
                      Todavía no se le ha cobrado nada
                    </td>
                  </tr>
                )}
                {cobros.map((c) => (
                  <tr key={c.id} className='border-t'>
                    <td className='px-4 py-2 text-muted-foreground'>{fecha(c.paid_at)}</td>
                    <td className='px-4 py-2 text-right font-medium tabular-nums'>{money(c.amount)}</td>
                    <td className='px-4 py-2'>{c.payment_method?.name || '—'}</td>
                    <td className='px-4 py-2 text-muted-foreground'>{c.reference || '—'}</td>
                    <td className='px-4 py-2 text-xs text-muted-foreground'>
                      {c.aplicaciones.map((a) => a.reference || a.sale_id?.slice(0, 8)).join(', ') || '—'}
                    </td>
                    {puedeCobrar && (
                      <td className='px-2'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7 text-muted-foreground hover:text-destructive'
                          onClick={() => setPorBorrar(c.id)}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={cobroAbierto} onOpenChange={setCobroAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              Se aplica automáticamente a las facturas más antiguas primero. Saldo actual:{' '}
              {money(resumen.saldo)}.
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
                max={resumen.saldo}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder='0.00'
              />
              {monto && montoInvalido && (
                <p className='mt-1 text-xs text-destructive'>
                  {montoNum > resumen.saldo
                    ? `No puede exceder el saldo (${money(resumen.saldo)})`
                    : 'Debe ser mayor a 0'}
                </p>
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
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCobroAbierto(false)}>Cancelar</Button>
            <Button
              onClick={() => cobrar.mutate()}
              disabled={montoInvalido || !metodo || cobrar.isPending}
            >
              {cobrar.isPending && <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(porBorrar)} onOpenChange={(o) => !o && setPorBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este cobro?</AlertDialogTitle>
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
