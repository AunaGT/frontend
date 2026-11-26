import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, TableLoadingRows } from '@/components/shared/LoadingState'
import { createCustody, fetchCustodies, fetchCustodyCapabilities, setCustodyActive, type CustodyScope } from '@/services/cashCustodyService'
import { CashPageHeader, Notice } from './components/CashPageParts'
import { CASH_TRANSFERS_PATH } from './components/transferParts'
import { formatCurrency } from './types'

// Lugares que guardan efectivo sin vender ni cobrar (caja fuerte, gerencia). Su saldo sale del libro; no se edita.
export default function CashCustodiesPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale } = useSystemSettings(), navigate = useNavigate(), cache = useQueryClient()
  const scope: CustodyScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const key = [scope.companyId, scope.branchId, scope.actorId]
  usePageTrail([{ label: 'Traslados de efectivo', to: CASH_TRANSFERS_PATH }, { label: 'Custodias' }])
  const caps = useQuery({ queryKey: ['cash-custody-capabilities', ...key], queryFn: ({ signal }) => fetchCustodyCapabilities(scope, signal), enabled: ready })
  const custodies = useQuery({ queryKey: ['cash-custodies', ...key], queryFn: ({ signal }) => fetchCustodies(scope, signal), enabled: ready && !!caps.data?.available })
  const [name, setName] = useState(''), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null)
  const canManage = !!caps.data?.canManage
  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try { await action(); await cache.invalidateQueries({ queryKey: ['cash-custodies'] }) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setBusy(null) }
  }
  function add(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setError('Escribe el nombre de la custodia.'); document.getElementById('custody-name')?.focus(); return }
    void run('new', async () => { await createCustody(name.trim(), scope); setName('') })
  }
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Custodias" subtitle={`${branch?.name || 'Selecciona una sucursal'} · Efectivo guardado fuera de los turnos`} backLabel="Volver a traslados" onBack={() => navigate(CASH_TRANSFERS_PATH)} />
    {caps.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : !caps.data?.available ? <Notice>Las custodias aún no están disponibles. Falta aplicar la actualización verificada.</Notice>
      : <>
        {canManage && <form onSubmit={add} noValidate className="auna-surface flex flex-wrap items-end gap-3 rounded-xl border p-4">
          <div className="min-w-0 flex-1 space-y-1 sm:max-w-sm"><Label htmlFor="custody-name">Nueva custodia</Label><Input id="custody-name" maxLength={120} value={name} disabled={busy === 'new'} onChange={e => setName(e.target.value)} placeholder="Ej. Caja fuerte, Gerencia" /></div>
          <Button type="submit" disabled={busy === 'new'}>{busy === 'new' ? 'Creando…' : 'Crear custodia'}</Button>
        </form>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Card className="auna-data-table-shell auna-surface"><CardContent className="p-0">
          {!custodies.isLoading && !custodies.data?.length ? <CollectionEmptyState title="Sin custodias" description="Crea una custodia para resguardar efectivo fuera de los turnos, por ejemplo la caja fuerte." />
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Custodia</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="hidden sm:table-cell">Por recibir</TableHead><TableHead>Estado</TableHead>{canManage && <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>}</TableRow></TableHeader><TableBody>
              {custodies.isLoading && <TableLoadingRows columns={canManage ? 5 : 4} message="Cargando custodias…" />}
              {custodies.data?.map(k => <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(k.balance, k.currency_code, locale)}</TableCell>
                <TableCell className="hidden text-sm sm:table-cell">{k.pending_in ? `${k.pending_in} traslado${k.pending_in === 1 ? '' : 's'}` : '—'}</TableCell>
                <TableCell><Badge variant={k.active ? 'default' : 'outline'}>{k.active ? 'Activa' : 'Inactiva'}</Badge></TableCell>
                {canManage && <TableCell className="text-right"><Button size="sm" variant="outline" disabled={busy === k.id} onClick={() => void run(k.id, () => setCustodyActive(k.id, !k.active, scope))}>{k.active ? 'Desactivar' : 'Activar'}</Button></TableCell>}
              </TableRow>)}
            </TableBody></Table></div>}
        </CardContent></Card>
        <p className="text-xs text-muted-foreground">Para desactivar una custodia primero entrega su saldo y resuelve lo que tiene por recibir.</p>
      </>}
  </main>
}
