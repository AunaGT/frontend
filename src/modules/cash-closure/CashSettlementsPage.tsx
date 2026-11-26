import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings2 } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, TableLoadingRows } from '@/components/shared/LoadingState'
import { fetchPendingReceipts, fetchSettlementCapabilities, listSettlements, type SettlementScope } from '@/services/cashSettlementsService'
import { CashClosureTabs } from './components/CashClosureTabs'
import { CASH_BANK_METHODS_PATH, CASH_SETTLEMENTS_PATH } from './components/settlementParts'
import { civilDate, formatCurrency } from './types'

export default function CashSettlementsPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  return <SettlementsList key={JSON.stringify([company?.id, branch?.id, user?.id])} />
}

// Lo que los proveedores aún deben depositar por medio, y las liquidaciones ya registradas en la sucursal.
function SettlementsList() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, currencyCode } = useSystemSettings(), navigate = useNavigate()
  const scope: SettlementScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const key = [scope.companyId, scope.branchId, scope.actorId], [page, setPage] = useState(1)
  usePageTrail([{ label: 'Liquidaciones' }])
  const caps = useQuery({ queryKey: ['cash-settlement-capabilities', ...key], queryFn: ({ signal }) => fetchSettlementCapabilities(scope, signal), enabled: ready })
  const canSettle = !!caps.data?.available && !!caps.data.canSettle
  const pending = useQuery({ queryKey: ['cash-settlements-pending', ...key], queryFn: ({ signal }) => fetchPendingReceipts(scope, undefined, signal), enabled: ready && canSettle })
  const list = useQuery({ queryKey: ['cash-settlements', ...key, page], queryFn: ({ signal }) => listSettlements(page, scope, signal), enabled: ready && canSettle })
  const money = (v: string) => formatCurrency(v, currencyCode, locale)
  const byMethod = Object.values((pending.data?.items || []).reduce<Record<number, { name: string; total: number; count: number; oldest: string }>>((acc, i) => {
    const row = acc[i.payment_method_id] ||= { name: i.payment_method_name, total: 0, count: 0, oldest: i.economic_at }
    row.total += (i.direction === 'IN' ? 1 : -1) * Number(i.remaining); row.count++; if (i.economic_at < row.oldest) row.oldest = i.economic_at
    return acc
  }, {}))
  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Liquidaciones</h1>
    <CashClosureTabs value="settlements" />
    {caps.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : !caps.data?.available ? <Card className="auna-surface"><CardContent className="p-4 text-sm"><p className="font-medium">Las liquidaciones aún no están disponibles.</p><p className="mt-1 text-muted-foreground">Falta aplicar la actualización verificada. Los cobros siguen registrándose como antes.</p></CardContent></Card>
      : <>
        <div className="flex flex-wrap items-center gap-2">
          {caps.data.canManage || caps.data.canApprove ? <Button variant="outline" onClick={() => navigate(CASH_BANK_METHODS_PATH)}><Settings2 className="h-4 w-4" aria-hidden />Medios bancarios</Button> : null}
          {canSettle && <Button className="ml-auto" onClick={() => navigate(`${CASH_SETTLEMENTS_PATH}/nueva`)}><Plus className="h-4 w-4" aria-hidden />Registrar liquidación</Button>}
        </div>
        {canSettle && <>
          <section aria-labelledby="pending-title" className="space-y-2">
            <h2 id="pending-title" className="text-sm font-semibold">Pendiente de liquidar</h2>
            {pending.isLoading ? <LoadingState variant="cards" size="sm" message="Calculando…" />
              : !byMethod.length ? <p className="text-sm text-muted-foreground">No hay cobros diferidos pendientes en esta sucursal.</p>
              : <MetricStrip label="Pendiente de liquidar por medio" items={byMethod.map(m => ({ label: `${m.name} · ${m.count} cobro${m.count === 1 ? '' : 's'} · desde ${civilDate(m.oldest.slice(0, 10), locale)}`, value: money(m.total.toFixed(2)) }))} />}
          </section>
          <Card className="auna-data-table-shell auna-surface"><CardContent className="p-0">
            {!list.isLoading && !list.data?.items.length ? <CollectionEmptyState title="Sin liquidaciones" description="Cuando el proveedor deposite, registra la liquidación para saldar los cobros diferidos." />
              : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Depósito</TableHead><TableHead className="hidden sm:table-cell">Medio</TableHead><TableHead className="text-right">Neto</TableHead><TableHead className="hidden md:table-cell text-right">Deducciones</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>
                {list.isLoading && <TableLoadingRows columns={5} message="Cargando liquidaciones…" />}
                {list.data?.items.map(s => <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`${CASH_SETTLEMENTS_PATH}/${s.id}`)}>
                  <TableCell><button type="button" className="text-left font-medium underline-offset-2 hover:underline" onClick={e => { e.stopPropagation(); navigate(`${CASH_SETTLEMENTS_PATH}/${s.id}`) }}>{s.deposit_reference}</button><span className="block text-xs text-muted-foreground">{civilDate(s.deposited_on, locale)}</span></TableCell>
                  <TableCell className="hidden sm:table-cell">{s.payment_method_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(s.net)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{money(s.deductions)}</TableCell>
                  <TableCell><Badge variant={s.status === 'POSTED' ? 'default' : 'outline'}>{s.status === 'POSTED' ? 'Registrada' : 'Anulada'}</Badge></TableCell>
                </TableRow>)}
              </TableBody></Table></div>}
          </CardContent></Card>
          {!!list.data && list.data.totalItems > 0 && <div className="auna-pagination-outside"><Pagination currentPage={list.data.page} totalPages={list.data.totalPages} onPageChange={setPage} totalItems={list.data.totalItems} pageSize={list.data.pageSize} count={list.data.items.length} itemLabel="liquidaciones" loading={list.isFetching} /></div>}
        </>}
      </>}
  </div>
}
