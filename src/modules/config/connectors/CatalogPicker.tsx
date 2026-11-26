import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fiscalProfileOptions } from './api'
import type { CatalogKind, CatalogPage, ConnectorScope, Environment } from './types'
export function CatalogPicker({ scope, environment, kind, label, disabled, onChoose }: { scope: ConnectorScope; environment: Environment; kind: CatalogKind; label: string; disabled: boolean; onChoose: (row: CatalogPage['rows'][number]) => void }) {
  const id = useId(), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1), [retry, setRetry] = useState(0), [data, setData] = useState<CatalogPage | null>(null), [error, setError] = useState(false), [loading, setLoading] = useState(true)
  const searchAgain = () => { setPage(1); setQuery(search); setRetry(n => n + 1) }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false); setData(null)
    void fiscalProfileOptions(scope, environment, kind, query, page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(() => { if (!controller.signal.aborted) setError(true) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope.companyId, scope.branchId, scope.userId, scope.sessionId, environment, kind, query, page, retry])
  return <div className="grid gap-2 rounded border bg-muted/30 p-3">
    <label htmlFor={`${id}-search`} className="text-sm font-medium">{label}</label>
    <div className="flex gap-2"><Input id={`${id}-search`} className="min-h-11" type="search" maxLength={100} value={search} disabled={disabled} placeholder="Buscar por nombre" onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAgain() } }}/><Button type="button" className="min-h-11" variant="outline" disabled={disabled || loading} onClick={searchAgain}>Buscar</Button></div>
    <label className="sr-only" htmlFor={`${id}-select`}>Agregar {label.toLowerCase()}</label>
    <select id={`${id}-select`} className="auna-control auna-control-select min-h-11 w-full" value="" disabled={disabled || loading || error} onChange={e => { const option = data?.rows.find(row => String(row.id) === e.target.value); if (option) onChoose(option) }}><option value="">{loading ? 'Buscando…' : data?.rows.length ? 'Selecciona para agregar' : 'Sin resultados'}</option>{data?.rows.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select>
    {error && <p role="alert" className="text-sm text-destructive">No se pudo cargar el catálogo. Pulsa Buscar para reintentar.</p>}
    {data && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{data.total} resultados · Página {page}</span><div className="flex gap-2"><Button type="button" className="min-h-11" variant="outline" disabled={disabled || loading || page === 1} onClick={() => setPage(n => n - 1)}>Anterior</Button><Button type="button" className="min-h-11" variant="outline" disabled={disabled || loading || page * data.pageSize >= data.total} onClick={() => setPage(n => n + 1)}>Siguiente</Button></div></div>}
  </div>
}
