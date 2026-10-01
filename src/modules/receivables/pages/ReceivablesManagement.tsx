import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, Eye, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/shared/Pagination'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { SavedCustomerMany2One } from '@/modules/sales/components/SavedCustomerMany2One'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useToast } from '@/hooks/use-toast'
import { formatMoney } from '@/utils/formatters'
import { fetchReceivables, fetchAging, fetchReceivableInvoices, AGING_BUCKETS } from '../api/receivablesService'
import { ReceivableMetrics, ReceivableStatus } from './ReceivablesPresentation'
import { downloadReceivablesCsv } from './statementViewModel.mjs'

const tabs = [{ value: 'ALL', label: 'Facturas abiertas' }, { value: 'OVERDUE', label: 'Facturas vencidas' }, { value: 'UPCOMING', label: 'Próximas (30 días)' }, { value: 'CUSTOMERS', label: 'Por cliente' }, { value: 'AGING', label: 'Antigüedad' }]
const invoiceColumns = ['Factura', 'Cliente', 'Fecha de emisión', 'Vencimiento', 'Días de atraso', 'Monto', 'Saldo pendiente', 'Estado']
const customerColumns = ['Cliente', 'Saldo', 'Vencido', 'Saldo a favor', 'Saldo neto', 'Facturas', 'Vencimiento', 'Límite']
const agingColumns = ['Cliente', ...AGING_BUCKETS.map(bucket => bucket.label), 'Total']

export default function ReceivablesManagement() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const { company, branch, isConsolidated } = useTenant()
  const companyId = company?.id
  const branchId = isConsolidated ? 'all' : branch?.id
  const { currencyCode, locale, timezone } = useSystemSettings()
  const { toast } = useToast()
  const [tab, setTab] = useState('ALL')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('__none__')
  const [customerName, setCustomerName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filter, setFilter] = useState({ search: '', customer_id: '', date_from: '', date_to: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPending, setExportPending] = useState(false)
  const [chooseCustomer, setChooseCustomer] = useState(false)
  const summary = useQuery({ queryKey: ['receivables', 'summary', companyId, branchId], queryFn: fetchReceivables })
  const aging = useQuery({ queryKey: ['receivables', 'aging', companyId, branchId], queryFn: fetchAging })
  const invoiceMode = !['CUSTOMERS', 'AGING'].includes(tab)
  const invoices = useQuery({ queryKey: ['receivables', 'invoices', companyId, branchId, tab, filter, page, pageSize], queryFn: () => fetchReceivableInvoices({ ...filter, state: tab, page, pageSize }), enabled: invoiceMode })
  const money = (amount: number) => formatMoney(amount, locale, currencyCode)
  const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale, { timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'
  const matches = (row: { customer_id: string; customer_name: string }) => (!filter.customer_id || row.customer_id === filter.customer_id) && row.customer_name.toLocaleLowerCase().includes(filter.search.toLocaleLowerCase())
  const customers = (summary.data?.items ?? []).filter(matches)
  const agingRows = (aging.data?.items ?? []).filter(matches)
  const total = invoiceMode ? invoices.data?.totalItems ?? 0 : tab === 'CUSTOMERS' ? customers.length : agingRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = invoiceMode ? invoices.data?.page ?? page : Math.min(page, totalPages)
  const rows = invoices.data?.items ?? []
  const query = invoiceMode ? invoices : tab === 'CUSTOMERS' ? summary : aging
  const open = (id: string, collect = false, invoiceId?: string) => navigate('/cartera/' + id + (collect ? '?cobrar=1' + (invoiceId ? '&factura=' + encodeURIComponent(invoiceId) : '') : ''))
  const apply = () => { if (from && to && from > to) return; setFilter({ search: search.trim(), customer_id: customerId === '__none__' ? '' : customerId, date_from: from, date_to: to }); setPage(1) }
  const reset = () => { setSearch(''); setCustomerId('__none__'); setCustomerName(''); setFrom(''); setTo(''); setFilter({ search: '', customer_id: '', date_from: '', date_to: '' }); setPage(1) }
  const headings = invoiceMode ? invoiceColumns : tab === 'CUSTOMERS' ? customerColumns : agingColumns
  const exportColumns = headings.map((label, index) => ({ id: String(index), label }))
  const customerData = tab === 'CUSTOMERS' ? customers.map(row => ({ id: row.customer_id, name: row.customer_name, cells: [row.customer_name, money(row.saldo), money(row.vencido), money(row.credito_disponible), money(row.saldo_neto), row.facturas, date(row.vence_primero), row.credit_limit == null ? 'Sin límite' : money(row.credit_limit)] })) : agingRows.map(row => ({ id: row.customer_id, name: row.customer_name, cells: [row.customer_name, ...AGING_BUCKETS.map(bucket => money(row[bucket.key])), money(row.total)] }))
  const pageCustomers = customerData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const exportData = async (selected: string[], fileName?: string) => {
    setExportPending(true)
    try {
      let data: (string | number)[][]
      if (invoiceMode) {
        const all = []
        let nextPage = 1
        let pages = 1
        do {
          const result = await fetchReceivableInvoices({ ...filter, state: tab, page: nextPage, pageSize: 100 })
          all.push(...result.items)
          pages = result.totalPages
          nextPage++
        } while (nextPage <= pages)
        data = all.map(row => [row.reference || row.id.slice(0, 8), row.customer_name, date(row.date), date(row.due_date), row.dias_vencida, row.total, row.saldo, row.vencida ? 'Vencida' : row.payment_status === 'PARTIAL' ? 'Abonada' : 'Por vencer'])
      } else if (tab === 'CUSTOMERS') data = customers.map(row => [row.customer_name, row.saldo, row.vencido, row.credito_disponible, row.saldo_neto, row.facturas, date(row.vence_primero), row.credit_limit ?? 'Sin límite'])
      else data = agingRows.map(row => [row.customer_name, ...AGING_BUCKETS.map(bucket => row[bucket.key]), row.total])
      const definitions = exportColumns.filter(column => selected.includes(column.id))
      downloadReceivablesCsv(fileName || 'cartera.csv', [definitions.map(column => column.label), ...data.map(row => definitions.map(column => row[Number(column.id)]))])
      setExportOpen(false)
    } catch (error) { toast({ title: 'No se pudo exportar', description: (error as Error).message, variant: 'destructive' }) }
    finally { setExportPending(false) }
  }

  return <div className="receivables-page mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
    <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Finanzas</p><h1>Cuentas por cobrar</h1><p className="auna-module-description">Gestiona los saldos, vencimientos y cobros de tus clientes.</p></div>{hasPermission('receivables.manage') && branchId !== 'all' && <Button className="h-12 rounded-xl bg-brand-orange px-6 text-white hover:bg-brand-orange/90" onClick={() => setChooseCustomer(true)}><Plus className="mr-2 h-4 w-4" />Registrar cobro</Button>}</header>
    {summary.data && aging.data ? <ReceivableMetrics balance={summary.data.total_por_cobrar} overdue={summary.data.total_vencido} upcoming={aging.data.totales.corriente} customers={summary.data.items.filter(row => row.saldo > .005).length} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={summary.isLoading || aging.isLoading} aria-label="Resumen de cartera no disponible">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>}
    {(summary.isError || aging.isError) && <p role="alert" className="text-sm text-destructive">No se pudo cargar el resumen completo. <Button variant="outline" onClick={() => { void summary.refetch(); void aging.refetch() }}>Reintentar</Button></p>}
    {(summary.data?.total_credito ?? 0) > 0 && <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">Saldo a favor de clientes: <strong className="text-emerald-600 dark:text-emerald-300">{money(summary.data!.total_credito)}</strong>. Puedes aplicarlo desde su estado de cuenta.</p>}
    <section className="rounded-2xl border bg-card p-4"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Filtros</h2><Button variant="ghost" onClick={reset}>Limpiar filtros</Button></div><div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1fr_1fr_auto]">
      <div className="space-y-2"><Label htmlFor="receivable-search">Buscar</Label><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="receivable-search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply() }} placeholder={invoiceMode ? 'Cliente, factura o referencia…' : 'Nombre del cliente…'} className="pl-9" /></div></div>
      <div className="space-y-2"><Label>Cliente</Label><SavedCustomerMany2One mode="filter" valueId={customerId} linkedDisplayName={customerName} onPick={c => { setCustomerId(c.id); setCustomerName(c.name) }} onClear={() => { setCustomerId('__none__'); setCustomerName('') }} /></div>
      <div className="space-y-2"><Label htmlFor="receivable-from">Emisión desde</Label><Input id="receivable-from" type="date" disabled={!invoiceMode} value={from} onChange={e => setFrom(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="receivable-to">Emisión hasta</Label><Input id="receivable-to" type="date" disabled={!invoiceMode} value={to} min={from} onChange={e => setTo(e.target.value)} /></div>
      <Button className="h-11 bg-brand-orange text-white hover:bg-brand-orange/90" disabled={Boolean(from && to && from > to)} onClick={apply}>Aplicar filtros</Button>
    </div>{from && to && from > to && <p role="alert" className="mt-2 text-sm text-destructive">La fecha final debe ser posterior a la inicial.</p>}</section>
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Vista de cartera">{tabs.map(item => <button key={item.value} role="tab" aria-selected={tab === item.value} onClick={() => { setTab(item.value); setPage(1) }} className={`shrink-0 rounded-t-xl px-4 py-3 text-sm font-medium ${tab === item.value ? 'bg-brand-orange text-white' : 'bg-muted text-muted-foreground'}`}>{item.label}</button>)}</div><Button variant="outline" onClick={() => setExportOpen(true)} disabled={!total || query.isError}><Download className="mr-2 h-4 w-4" />Exportar</Button></div>
    <section className="auna-data-table-shell" aria-label="Registros de cartera"><Table className="min-w-[980px]"><TableHeader><TableRow>{[...headings, 'Acciones'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {query.isLoading ? <TableRow><TableCell colSpan={headings.length + 1} className="text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Cargando cartera" /></TableCell></TableRow> : query.isError ? <TableRow><TableCell colSpan={headings.length + 1} className="text-center text-destructive">No se pudo cargar la cartera. <Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></TableCell></TableRow> : !total ? <TableRow><TableCell colSpan={headings.length + 1} className="text-center text-muted-foreground">No hay registros para estos filtros.</TableCell></TableRow> : invoiceMode ? rows.map(row => <TableRow key={row.id}>
        <TableCell><button className="font-semibold text-brand-orange hover:underline" onClick={() => open(row.customer_id)}>{row.reference || row.id.slice(0, 8)}</button></TableCell><TableCell>{row.customer_name}</TableCell><TableCell>{date(row.date)}</TableCell><TableCell>{date(row.due_date)}</TableCell><TableCell className={row.vencida ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{row.dias_vencida}</TableCell><TableCell className="whitespace-nowrap">{money(row.total)}</TableCell><TableCell className="whitespace-nowrap font-semibold">{money(row.saldo)}</TableCell><TableCell><ReceivableStatus sale={row} /></TableCell><TableCell><div className="flex gap-2">{hasPermission('receivables.manage') && branchId !== 'all' && <Button size="sm" className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => open(row.customer_id, true, row.id)}>Cobrar</Button>}<Button variant="outline" size="icon" aria-label={`Ver estado de cuenta de ${row.customer_name}`} onClick={() => open(row.customer_id)}><Eye className="h-4 w-4" /></Button></div></TableCell>
      </TableRow>) : pageCustomers.map(row => <TableRow key={row.id}>{row.cells.map((cell, i) => <TableCell key={i} className={i ? 'whitespace-nowrap tabular-nums' : 'font-semibold'}>{i ? cell : <button className="hover:text-brand-orange" onClick={() => open(row.id)}>{cell}</button>}</TableCell>)}<TableCell><Button variant="outline" size="icon" aria-label={`Ver estado de cuenta de ${row.name}`} onClick={() => open(row.id)}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>)}
    </TableBody></Table><Pagination currentPage={currentPage} totalPages={invoiceMode ? invoices.data?.totalPages ?? 1 : totalPages} totalItems={total} pageSize={pageSize} count={invoiceMode ? rows.length : pageCustomers.length} itemLabel={invoiceMode ? 'facturas' : 'clientes'} loading={query.isFetching} onPageChange={setPage} /></section>
    <div className="flex items-center justify-end gap-3"><Label>Filas por página</Label><Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1) }}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
    <ExportDialog open={exportOpen} onOpenChange={v => { if (!exportPending) setExportOpen(v) }} title="Exportar cartera" summary={`Se exportan todos los ${total} registros de la vista con los filtros aplicados.`} columns={exportColumns} formats={['csv']} fileName="cartera" pending={exportPending} onExport={options => void exportData(options.columns ?? [], options.fileName)} />
    <Dialog open={chooseCustomer} onOpenChange={setChooseCustomer}><DialogContent variant="auna"><DialogHeader><DialogTitle>Registrar cobro</DialogTitle><DialogDescription>Selecciona un cliente para consultar sus facturas y registrar el pago.</DialogDescription></DialogHeader><SavedCustomerMany2One mode="required" valueId="__none__" linkedDisplayName="" onPick={c => open(c.id, true)} onClear={() => {}} /></DialogContent></Dialog>
  </div>
}
