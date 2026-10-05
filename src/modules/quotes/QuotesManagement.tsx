import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Eye, FileText, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Pagination } from '@/components/shared/Pagination'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { SavedCustomerMany2One } from '@/modules/sales/components/SavedCustomerMany2One'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney, formatDateTime } from '@/utils/formatters'
import { fetchQuotes, QUOTE_STATUS_LABELS, num } from '@/services/quoteService'
import { commercialDocSearchHint, isCommercialDocSearchReady } from './commercialDocumentSearchUtils'
import { QuoteStatusBadge } from './QuotePresentation'

export default function QuotesManagement() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode, timezone } = useSystemSettings()
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [customerId, setCustomerId] = useState('__none__')
  const [customerName, setCustomerName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  useEffect(() => { const timer = window.setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 350); return () => window.clearTimeout(timer) }, [search])
  const ready = !debounced || isCommercialDocSearchReady(debounced)
  const query = useQuery({ queryKey: ['quotes', page, pageSize, status, debounced, customerId, from, to], queryFn: () => fetchQuotes({ page, pageSize, status: status === 'ALL' ? undefined : status, search: debounced || undefined, customer_contact_id: customerId === '__none__' ? undefined : customerId, date_from: from || undefined, date_to: to || undefined }), enabled: ready && (!from || !to || from <= to) })
  const rows = ready && (!from || !to || from <= to) ? query.data?.items ?? [] : []
  const activeFilters = Number(Boolean(search.trim())) + Number(status !== 'ALL') + Number(customerId !== '__none__') + Number(Boolean(from)) + Number(Boolean(to))
  const reset = () => { setSearch(''); setStatus('ALL'); setCustomerId('__none__'); setCustomerName(''); setFrom(''); setTo(''); setPage(1) }
  return <div className="quotes-page mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
    <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Ventas</p><h1>Cotizaciones</h1><p className="auna-module-description">Gestiona y da seguimiento a todas tus cotizaciones.</p></div>{hasPermission('quotes.create') && <Button className="h-12 rounded-xl bg-brand-orange px-6 text-white hover:bg-brand-orange/90" onClick={() => navigate('/cotizaciones/nueva')}><Plus className="mr-2 h-4 w-4" />Nueva cotización</Button>}</header>
    <CompactFilterPanel title="Filtros de cotizaciones" summary="Cliente, estado y período" activeCount={activeFilters} onClear={reset} contentClassName="grid items-end gap-3 lg:grid-cols-[minmax(200px,2fr)_minmax(200px,1.5fr)_1fr_1fr_1fr]">
      <div className="space-y-2"><Label htmlFor="quote-search">Buscar</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="quote-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, folio o referencia…" /></div></div>
      <div className="space-y-2"><Label>Cliente</Label><SavedCustomerMany2One mode="filter" valueId={customerId} linkedDisplayName={customerName} onPick={(c) => { setCustomerId(c.id); setCustomerName(c.name); setPage(1) }} onClear={() => { setCustomerId('__none__'); setCustomerName(''); setPage(1) }} /></div>
      <div className="space-y-2"><Label>Estado</Label><Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los estados</SelectItem>{Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="quote-from">Fecha desde</Label><Input id="quote-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
      <div className="space-y-2"><Label htmlFor="quote-to">Fecha hasta</Label><Input id="quote-to" type="date" min={from} value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
    </CompactFilterPanel>
    {commercialDocSearchHint(search) && <p className="text-sm text-muted-foreground">{commercialDocSearchHint(search)}</p>}
    {from && to && from > to && <p role="alert" className="text-sm text-destructive">La fecha final debe ser posterior a la inicial.</p>}
    <section className="auna-data-table-shell"><Table className="min-w-[950px]"><TableHeader><TableRow>{['Folio', 'Cliente', 'Fecha', 'Total', 'Estado', 'Vencimiento', 'Acciones'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>
      {query.isLoading ? <TableRow><TableCell colSpan={7} className="text-center">Cargando cotizaciones…</TableCell></TableRow> : query.isError ? <TableRow><TableCell colSpan={7} className="text-center text-destructive">No se pudieron cargar las cotizaciones. <Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></TableCell></TableRow> : !rows.length ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay cotizaciones para estos filtros.</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}>
        <TableCell><button className="font-semibold text-brand-orange hover:underline" onClick={() => navigate(`/cotizaciones/${row.id}`)}>{row.reference || row.id.slice(0, 8)}</button></TableCell><TableCell>{row.customer || row.customerContact?.name || 'Consumidor final'}</TableCell><TableCell>{formatDateTime(new Date(row.created_at), { timeZone: timezone }, locale)}</TableCell><TableCell className="whitespace-nowrap font-medium">{formatMoney(num(row.total), locale, currencyCode)}</TableCell><TableCell><QuoteStatusBadge status={row.status} /></TableCell><TableCell>{row.valid_until ? formatDateTime(new Date(row.valid_until), { timeZone: timezone }, locale) : 'Sin fecha'}</TableCell>
        <TableCell><div className="flex gap-2"><Button size="icon" variant="outline" aria-label={`Ver ${row.reference || 'cotización'}`} onClick={() => navigate(`/cotizaciones/${row.id}`)}><Eye className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="Ver documento y descargar PDF" onClick={() => navigate(`/cotizaciones/${row.id}#documentos`)}><FileText className="h-4 w-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" aria-label="Más acciones"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => navigate(`/cotizaciones/${row.id}`)}>Ver detalles</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate(`/cotizaciones/${row.id}#enlace-publico`)}>Compartir cotización</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell>
      </TableRow>)}
    </TableBody></Table><Pagination currentPage={query.data?.page ?? page} totalPages={Math.max(1, query.data?.totalPages ?? 1)} totalItems={query.data?.totalItems ?? 0} pageSize={pageSize} count={rows.length} itemLabel="cotizaciones" loading={query.isFetching} onPageChange={setPage} /></section>
    <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground"><Label>Filas por página</Label><Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
  </div>
}
