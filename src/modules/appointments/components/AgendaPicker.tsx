import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command'
import { LoadingIndicator } from '@/components/shared/LoadingState'
import { appointmentQueryKey, getAgenda, agendaParams } from '../api'
import type { AgendaScope, AgendaService, Page } from '../types'

function serviceRestriction(service: AgendaService, group?: boolean) {
  if (!service.available) return 'No disponible para venta'
  if (!service.schedulable) return service.durationMinutes == null ? 'Configurar para recibir citas' : 'No habilitado para citas en esta sucursal'
  if (group !== undefined && (service.mode === 'GROUP') !== group) return service.mode === 'GROUP' ? 'Solo sesiones grupales' : 'Solo citas individuales'
  return null
}

export function AgendaPicker<T extends { id: string; name: string }>({ scope, kind, label, onSelect, disabled, group, schedulableOnly = true, canConfigure = false }: { scope: AgendaScope; kind: 'services' | 'contacts'; label: string; onSelect: (row: T) => void; disabled?: boolean; group?: boolean; schedulableOnly?: boolean; canConfigure?: boolean }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState(''), [page, setPage] = useState(1)
  const query = useQuery({ queryKey: appointmentQueryKey(scope, kind, { q, page }), queryFn: ({ signal }) => getAgenda<Page<T>>(`/${kind}?${agendaParams({ q, page })}`, scope, signal), enabled: open && !disabled })
  const rows = (query.data?.items || []).map(row => ({ row, restriction: kind === 'services' && schedulableOnly ? serviceRestriction(row as unknown as AgendaService, group) : null }))
  const needsConfiguration = kind === 'services' && schedulableOnly && rows.some(({ row }) => !(row as unknown as AgendaService).schedulable)
  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button id={`agenda-${kind === 'contacts' ? 'contactId' : 'productId'}`} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal"><span className="truncate">{label}</span><ChevronsUpDown className="ml-2 size-4 shrink-0" aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
      <Command shouldFilter={false}>
        <CommandInput placeholder={kind === 'services' ? 'Buscar servicio…' : 'Buscar cliente…'} value={q} onValueChange={value => { setQ(value); setPage(1) }} />
        <CommandList>
          <CommandGroup>{rows.map(({ row, restriction }) => <CommandItem key={row.id} value={row.id} disabled={!!restriction} onSelect={() => { if (restriction) return; onSelect(row); setOpen(false) }}>
            <span className="min-w-0"><span className="block">{row.name}</span>{restriction && <span className="block text-xs text-muted-foreground">{restriction}</span>}</span>
          </CommandItem>)}</CommandGroup>
          {query.isLoading && <LoadingIndicator message="Buscando…" />}
          {query.isError && <div role="alert" className="p-3 text-sm">No se pudieron cargar las opciones.<Button variant="ghost" onClick={() => void query.refetch()}>Reintentar</Button></div>}
          {!query.isLoading && !query.isError && !rows.length && <p className="p-3 text-sm text-muted-foreground">{kind === 'services' ? 'No se encontraron servicios.' : 'No se encontraron clientes.'}{q && ' Prueba otro nombre.'}</p>}
        </CommandList>
      </Command>
      {!query.isError && needsConfiguration && <div className="space-y-2 border-t p-3 text-xs text-muted-foreground"><p>Para recibir citas, configura el servicio y habilítalo en esta sucursal.</p>{canConfigure && <Button asChild size="sm" variant="outline"><Link to="/agenda/configuracion">Configurar servicios</Link></Button>}</div>}
      <div className="flex justify-between border-t p-2"><Button type="button" size="sm" variant="ghost" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>Anterior</Button><span className="p-2 text-xs">{page}</span><Button type="button" size="sm" variant="ghost" disabled={page * 10 >= (query.data?.totalItems || 0) || query.isFetching} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </PopoverContent>
  </Popover>
}
