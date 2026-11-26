import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, TableLoadingRows } from '@/components/shared/LoadingState'
import { fetchNoticeCapabilities, listNotices, type NoticeScope, type NoticeStatus } from '@/services/cashNoticesService'
import { CashClosureTabs } from './components/CashClosureTabs'
import { civilDate, formatCurrency, formatZonedDateTime } from './types'
export { civilDate }

export const CASH_NOTICES_PATH = '/cierre-caja/cobros-digitales'
const PAGE_SIZE = 20
// Un aviso es lo que el cliente informó; solo lo confirmado es un cobro. La etiqueta nunca dice «pagado».
export const NOTICE_STATUS: Record<NoticeStatus, { label: string; variant: 'secondary' | 'default' | 'outline' }> = {
  PENDING: { label: 'Por confirmar', variant: 'secondary' }, CONFIRMED: { label: 'Confirmado', variant: 'default' }, REJECTED: { label: 'Rechazado', variant: 'outline' },
}

export default function CashNoticesPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  return <NoticesList key={JSON.stringify([company?.id, branch?.id, user?.id])} />
}

function NoticesList() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, timezone } = useSystemSettings(), navigate = useNavigate()
  const scope: NoticeScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const [status, setStatus] = useState<'' | NoticeStatus>('PENDING'), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const query = useDeferredValue(search.trim()), key = [scope.companyId, scope.branchId, scope.actorId]
  usePageTrail([{ label: 'Cobros digitales' }])
  const capabilities = useQuery({ queryKey: ['cash-notice-capabilities', ...key], queryFn: ({ signal }) => fetchNoticeCapabilities(scope, signal), enabled: ready })
  const caps = capabilities.data
  const list = useQuery({ queryKey: ['cash-notices', ...key, status, query, page], queryFn: ({ signal }) => listNotices({ page, pageSize: PAGE_SIZE, status: status || undefined, search: query }, scope, signal), enabled: ready && !!caps?.available })
  const data = list.data, items = data?.items || []
  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Cobros digitales</h1>
    <CashClosureTabs value="notices" />
    {capabilities.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : !caps?.available ? <Card className="auna-surface"><CardContent className="p-4 text-sm"><p className="font-medium">Los avisos de pago aún no están disponibles.</p><p className="mt-1 text-muted-foreground">Falta aplicar la actualización verificada. Los cobros de cartera siguen funcionando como antes.</p></CardContent></Card>
      : <>
        <MetricStrip label="Resumen de avisos" loading={list.isLoading} items={[{ label: 'Por confirmar', value: data?.summary.pending ?? '—' }, { label: 'En esta vista', value: data?.totalItems ?? '—' }]} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1 sm:w-auto"><Label htmlFor="notice-status">Estado</Label>
            <Select value={status || 'all'} onValueChange={v => { setStatus(v === 'all' ? '' : v as NoticeStatus); setPage(1) }}>
              <SelectTrigger id="notice-status" className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{(Object.keys(NOTICE_STATUS) as NoticeStatus[]).map(s => <SelectItem key={s} value={s}>{NOTICE_STATUS[s].label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="min-w-[12rem] flex-1 space-y-1 sm:max-w-sm"><Label htmlFor="notice-search">Buscar</Label>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input id="notice-search" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Cliente o referencia" /></div></div>
          {caps.canCreate && <Button className="ml-auto" onClick={() => navigate(`${CASH_NOTICES_PATH}/nuevo`)}><Plus className="h-4 w-4" aria-hidden />Registrar aviso</Button>}
        </div>
        <Card className="auna-data-table-shell auna-surface"><CardContent className="p-0">
          {!list.isLoading && !items.length ? <CollectionEmptyState title="Sin avisos en esta vista" description="Cuando un cliente informe un pago digital, regístralo aquí para que un encargado lo confirme con el banco." />
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="hidden md:table-cell">Medio · referencia</TableHead><TableHead className="hidden sm:table-cell">Registrado</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>
              {list.isLoading && <TableLoadingRows columns={5} message="Cargando avisos…" />}
              {items.map(n => <TableRow key={n.id} className="cursor-pointer" onClick={() => navigate(`${CASH_NOTICES_PATH}/${n.id}`)}>
                <TableCell><button type="button" className="text-left font-medium underline-offset-2 hover:underline" onClick={e => { e.stopPropagation(); navigate(`${CASH_NOTICES_PATH}/${n.id}`) }}>{n.customer_name}</button></TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(n.amount, n.currency_code, locale)}</TableCell>
                <TableCell className="hidden text-sm md:table-cell">{n.payment_method_name}{n.reported_reference ? ` · ${n.reported_reference}` : ''}</TableCell>
                <TableCell className="hidden text-sm sm:table-cell">{formatZonedDateTime(n.created_at, timezone, locale)} · {n.created_by_name}</TableCell>
                <TableCell><Badge className="whitespace-nowrap" variant={NOTICE_STATUS[n.status].variant}>{NOTICE_STATUS[n.status].label}</Badge></TableCell>
              </TableRow>)}
            </TableBody></Table></div>}
        </CardContent></Card>
        {!!data && data.totalItems > 0 && <div className="auna-pagination-outside"><Pagination currentPage={data.page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.totalItems} pageSize={data.pageSize} count={items.length} itemLabel="avisos" loading={list.isFetching} /></div>}
      </>}
  </div>
}
