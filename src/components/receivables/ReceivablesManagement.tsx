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
 * Cartera: un renglón por cliente con saldo pendiente, y la pestaña de
 * antigüedad de saldos. De aquí se entra al estado de cuenta para cobrar.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight, Download, Loader2, Search, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {
  fetchReceivables, fetchAging, AGING_BUCKETS,
  type ReceivableRow, type AgingRow,
} from '@/services/receivablesService'

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?'

const CustomerAvatar = ({ name }: { name: string }) => (
  <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary'>
    {initials(name)}
  </span>
)

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

/** CSV con separador de punto y coma: es lo que Excel en español abre sin pelear. */
const descargarCsv = (nombre: string, filas: (string | number)[][]) => {
  const escapar = (v: string | number) => {
    const t = String(v ?? '')
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const csv = filas.map((f) => f.map(escapar).join(';')).join('\n')
  // El BOM hace que Excel reconozca UTF-8 y no destroce los acentos.
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export const ReceivablesManagement = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { currencyCode, locale } = useSystemSettings()

  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' })
    return (v: number) => fmt.format(Number(v) || 0)
  }, [locale, currencyCode])

  const cartera = useQuery({ queryKey: ['receivables'], queryFn: fetchReceivables })
  const aging = useQuery({ queryKey: ['receivables', 'aging'], queryFn: fetchAging })

  const filtrar = <T extends { customer_name: string }>(items: T[] | undefined) => {
    const term = search.trim().toLowerCase()
    if (!term) return items ?? []
    return (items ?? []).filter((i) => i.customer_name.toLowerCase().includes(term))
  }

  const filas = filtrar<ReceivableRow>(cartera.data?.items)
  const filasAging = filtrar<AgingRow>(aging.data?.items)

  const abrir = (customerId: string) => navigate(`/cartera/${customerId}`)

  const exportarSaldos = () =>
    descargarCsv('cartera.csv', [
      ['Cliente', 'Saldo', 'Vencido', 'Saldo a favor', 'Saldo neto', 'Facturas', 'Vence', 'Límite'],
      ...filas.map((r) => [
        r.customer_name, r.saldo, r.vencido, r.credito_disponible, r.saldo_neto,
        r.facturas, r.vence_primero ? r.vence_primero.slice(0, 10) : '',
        r.credit_limit == null ? 'Sin límite' : r.credit_limit,
      ]),
    ])

  const exportarAntiguedad = () =>
    descargarCsv('antiguedad-saldos.csv', [
      ['Cliente', ...AGING_BUCKETS.map((b) => b.label), 'Total'],
      ...filasAging.map((r) => [r.customer_name, ...AGING_BUCKETS.map((b) => r[b.key]), r.total]),
    ])

  return (
    <div className='container mx-auto space-y-4 p-4 sm:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='flex items-center gap-2 text-2xl font-semibold'>
            <Wallet className='h-6 w-6 text-muted-foreground' />
            Cartera
          </h1>
          <p className='text-sm text-muted-foreground'>Cuentas por cobrar de clientes</p>
        </div>
        <div className='relative w-full sm:w-72'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar cliente...'
            className='pl-9'
          />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total por cobrar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>{money(cartera.data?.total_por_cobrar ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className={cartera.data?.total_vencido ? 'border-destructive/40' : undefined}>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-1.5 text-sm font-medium text-muted-foreground'>
              {!!cartera.data?.total_vencido && <AlertTriangle className='h-4 w-4 text-destructive' />}
              Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${cartera.data?.total_vencido ? 'text-destructive' : ''}`}>
              {money(cartera.data?.total_vencido ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Saldo a favor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>{money(cartera.data?.total_credito ?? 0)}</p>
            <p className='text-xs text-muted-foreground'>Anticipos sin aplicar</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue='saldos'>
        <TabsList>
          <TabsTrigger value='saldos'>Saldos</TabsTrigger>
          <TabsTrigger value='antiguedad'>Antigüedad</TabsTrigger>
        </TabsList>

        <TabsContent value='saldos' className='mt-3 space-y-2'>
          <div className='flex justify-end'>
            <Button variant='outline' size='sm' onClick={exportarSaldos} disabled={filas.length === 0}>
              <Download className='mr-1.5 h-4 w-4' />
              Exportar CSV
            </Button>
          </div>
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full min-w-[46rem] text-sm'>
              <thead className='bg-muted/50 text-xs uppercase text-muted-foreground'>
                <tr>
                  <th className='px-3 py-2 text-left font-medium'>Cliente</th>
                  <th className='px-3 py-2 text-right font-medium'>Saldo</th>
                  <th className='px-3 py-2 text-right font-medium'>Vencido</th>
                  <th className='px-3 py-2 text-right font-medium'>A favor</th>
                  <th className='px-3 py-2 text-center font-medium'>Facturas</th>
                  <th className='px-3 py-2 text-left font-medium'>Vence</th>
                  <th className='px-3 py-2 text-right font-medium'>Límite</th>
                  <th className='w-8' />
                </tr>
              </thead>
              <tbody>
                {cartera.isLoading && (
                  <tr>
                    <td colSpan={8} className='px-3 py-10 text-center text-muted-foreground'>
                      <Loader2 className='mx-auto h-5 w-5 animate-spin' />
                    </td>
                  </tr>
                )}
                {!cartera.isLoading && filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className='px-3 py-10 text-center text-muted-foreground'>
                      {search ? 'Ningún cliente coincide' : 'No hay saldos pendientes'}
                    </td>
                  </tr>
                )}
                {filas.map((row) => (
                  <tr
                    key={row.customer_id}
                    onClick={() => abrir(row.customer_id)}
                    className='cursor-pointer border-t transition-colors hover:bg-muted/40'
                  >
                    <td className='px-3 py-2'>
                      <div className='flex items-center gap-2'>
                        <CustomerAvatar name={row.customer_name} />
                        <span className='font-medium'>{row.customer_name}</span>
                      </div>
                    </td>
                    <td className='px-3 py-2 text-right font-medium tabular-nums'>{money(row.saldo)}</td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {row.vencido > 0 ? (
                        <span className='font-medium text-destructive'>{money(row.vencido)}</span>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </td>
                    <td className='px-3 py-2 text-right tabular-nums'>
                      {row.credito_disponible > 0 ? (
                        <span className='font-medium text-teal-600'>{money(row.credito_disponible)}</span>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </td>
                    <td className='px-3 py-2 text-center text-muted-foreground'>{row.facturas}</td>
                    <td className='px-3 py-2 text-muted-foreground'>{fechaCorta(row.vence_primero)}</td>
                    <td className='px-3 py-2 text-right tabular-nums text-muted-foreground'>
                      {row.credit_limit == null ? (
                        <Badge variant='outline' className='font-normal'>Sin límite</Badge>
                      ) : (
                        money(row.credit_limit)
                      )}
                    </td>
                    <td className='px-2 text-muted-foreground'>
                      <ChevronRight className='h-4 w-4' />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value='antiguedad' className='mt-3 space-y-2'>
          <div className='flex justify-end'>
            <Button
              variant='outline'
              size='sm'
              onClick={exportarAntiguedad}
              disabled={filasAging.length === 0}
            >
              <Download className='mr-1.5 h-4 w-4' />
              Exportar CSV
            </Button>
          </div>
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full min-w-[46rem] text-sm'>
              <thead className='bg-muted/50 text-xs uppercase text-muted-foreground'>
                <tr>
                  <th className='px-3 py-2 text-left font-medium'>Cliente</th>
                  {AGING_BUCKETS.map((b) => (
                    <th key={b.key} className='px-3 py-2 text-right font-medium'>{b.label}</th>
                  ))}
                  <th className='px-3 py-2 text-right font-medium'>Total</th>
                </tr>
              </thead>
              <tbody>
                {aging.isLoading && (
                  <tr>
                    <td colSpan={AGING_BUCKETS.length + 2} className='px-3 py-10 text-center text-muted-foreground'>
                      <Loader2 className='mx-auto h-5 w-5 animate-spin' />
                    </td>
                  </tr>
                )}
                {!aging.isLoading && filasAging.length === 0 && (
                  <tr>
                    <td colSpan={AGING_BUCKETS.length + 2} className='px-3 py-10 text-center text-muted-foreground'>
                      No hay saldos pendientes
                    </td>
                  </tr>
                )}
                {filasAging.map((row) => (
                  <tr
                    key={row.customer_id}
                    onClick={() => abrir(row.customer_id)}
                    className='cursor-pointer border-t transition-colors hover:bg-muted/40'
                  >
                    <td className='px-3 py-2 font-medium'>{row.customer_name}</td>
                    {AGING_BUCKETS.map((b) => (
                      <td
                        key={b.key}
                        className={`px-3 py-2 text-right tabular-nums ${
                          b.key === 'd90_mas' && row[b.key] > 0 ? 'font-medium text-destructive' : ''
                        }`}
                      >
                        {row[b.key] > 0 ? money(row[b.key]) : <span className='text-muted-foreground'>—</span>}
                      </td>
                    ))}
                    <td className='px-3 py-2 text-right font-semibold tabular-nums'>{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              {filasAging.length > 0 && aging.data && (
                <tfoot className='border-t bg-muted/30 font-medium'>
                  <tr>
                    <td className='px-3 py-2'>Total</td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className='px-3 py-2 text-right tabular-nums'>
                        {money(aging.data.totales[b.key])}
                      </td>
                    ))}
                    <td className='px-3 py-2 text-right tabular-nums'>{money(aging.data.totales.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ReceivablesManagement
