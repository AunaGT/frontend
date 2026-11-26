import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { fetchEligibleRegisterUsers, type RegisterPerson, type RegisterConfigurationScope } from '@/services/cashSessionsService'

export function CashRegisterAccessFields({ scope, selected, known, disabled, readOnly, onChange }: {
  scope: RegisterConfigurationScope; selected: string[]; known: RegisterPerson[]; disabled: boolean; readOnly: boolean; onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const [names, setNames] = useState<Record<string, string>>({})
  const people = useQuery({ queryKey: ['cash-register-eligible', scope.companyId, scope.branchId, scope.actorId, search, page], queryFn: () => fetchEligibleRegisterUsers({ search, page }, scope), enabled: !readOnly })
  const knownNames = Object.fromEntries([...known, ...(people.data?.items || [])].map(u => [u.id, u.name]))
  function toggle(person: RegisterPerson, checked: boolean) {
    setNames(prev => ({ ...prev, [person.id]: person.name }))
    onChange(checked ? [...new Set([...selected, person.id])] : selected.filter(id => id !== person.id))
  }
  return <section className="min-w-0 space-y-3" aria-labelledby="cash-people-title">
    <header><h2 id="cash-people-title" className="font-semibold">Personas autorizadas <span className="text-muted-foreground font-normal">({selected.length})</span></h2><p className="text-sm text-muted-foreground">Pueden abrir turnos propios. Esto no les concede permiso para vender o cobrar.</p></header>
    {selected.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Personas seleccionadas">{selected.map(id => <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 text-sm"><span className="truncate">{names[id] || knownNames[id] || 'Persona seleccionada'}</span>{!readOnly && <button type="button" className="min-h-11 min-w-9" disabled={disabled} aria-label={`Quitar ${names[id] || knownNames[id] || 'persona'}`} onClick={() => onChange(selected.filter(value => value !== id))}>×</button>}</span>)}</div>}
    {!readOnly && <><div className="space-y-1"><Label htmlFor="cash-people-search">Buscar en esta sucursal</Label><Input id="cash-people-search" value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Nombre de la persona" disabled={disabled} /></div>
      <div className="max-h-44 overflow-auto rounded-lg border" aria-busy={people.isFetching}>
        {people.error ? <p role="alert" className="p-3 text-sm text-destructive">No se pudieron cargar las personas. <button type="button" className="underline" onClick={() => void people.refetch()}>Reintentar</button></p> : people.isLoading ? <p role="status" className="p-3 text-sm">Buscando personas…</p> : people.data?.items.length ? people.data.items.map(person => <label key={person.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/40"><Checkbox aria-label={person.name} checked={selected.includes(person.id)} disabled={disabled} onCheckedChange={checked => toggle(person, checked === true)} /><span className="min-w-0 truncate text-sm">{person.name}</span></label>) : <CollectionEmptyState compact title="El equipo de esta caja aparecerá aquí" description="Selecciona miembros activos de esta empresa y sucursal." filtered={!!search.trim()} onReset={() => { setSearch(''); setPage(1) }} />}
      </div>
      {people.data && <Pagination currentPage={page} totalPages={people.data.totalPages} onPageChange={setPage} loading={people.isFetching || disabled} itemLabel="personas" />}
    </>}
    {readOnly && selected.length === 0 && <p className="text-sm text-muted-foreground">Sin personas autorizadas explícitamente.</p>}
  </section>
}
