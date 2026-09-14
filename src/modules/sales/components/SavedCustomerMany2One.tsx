/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchSuppliers } from '@/services/supplierService'
import type { Supplier } from '@/types'

const PAGE_SIZE = 35

async function fetchCustomerPage(params: { search: string; page: number }) {
  return fetchSuppliers({
    party_type: 'CUSTOMER',
    search: params.search.trim() || undefined,
    page: params.page,
    pageSize: PAGE_SIZE,
  })
}

export interface SavedCustomerMany2OneProps {
  /** `__none__` = entrada manual */
  valueId: string
  /** Texto del trigger cuando hay cliente vinculado (p. ej. nombre actual del formulario) */
  linkedDisplayName: string
  onPick: (row: Supplier) => void
  onClear: () => void
  canCreateContact?: boolean
  className?: string
}

export function SavedCustomerMany2One({
  valueId,
  linkedDisplayName,
  onPick,
  onClear,
  canCreateContact = false,
  className,
}: SavedCustomerMany2OneProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(inputValue), 280)
    return () => window.clearTimeout(t)
  }, [inputValue])

  useEffect(() => {
    if (!open) {
      setInputValue('')
      setDebouncedSearch('')
    }
  }, [open])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
  } = useInfiniteQuery({
    queryKey: ['saved-customer-m2o', debouncedSearch],
    queryFn: ({ pageParam }) =>
      fetchCustomerPage({ search: debouncedSearch, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: open,
    staleTime: 30 * 1000,
  })

  const flatRows = useMemo(() => {
    if (!data?.pages?.length) return []
    const map = new Map<string, Supplier>()
    for (const page of data.pages) {
      for (const item of page.items) {
        map.set(String(item.id), item)
      }
    }
    return [...map.values()]
  }, [data])

  const triggerLabel =
    valueId === '__none__'
      ? 'Manual · sin vincular'
      : linkedDisplayName.trim() || 'Cliente seleccionado'

  const handlePick = useCallback(
    (row: Supplier) => {
      onPick(row)
      setOpen(false)
    },
    [onPick]
  )

  return (
    <div className={cn('space-y-1', className)}>
      <Label>Cliente guardado (opcional)</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal min-h-10 h-auto py-2 px-3"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,420px)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre, correo, NIT…"
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              {isFetching && !isFetchingNextPage && flatRows.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </div>
              ) : isError ? (
                <div className="py-6 px-3 text-sm text-destructive text-center">
                  No se pudieron cargar los clientes.
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {debouncedSearch.trim()
                      ? 'Sin resultados. Prueba otro término o crea el contacto.'
                      : 'Escribe para buscar o desplázate para ver más.'}
                  </CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[min(55vh,320px)]">
                      <div className="p-1">
                        <CommandItem
                          value="__manual__"
                          onSelect={() => {
                            onClear()
                            setOpen(false)
                          }}
                          className="text-muted-foreground"
                        >
                          Manual · sin vincular (nombre e ID fiscal abajo)
                        </CommandItem>
                        {flatRows.map((row) => (
                          <CommandItem
                            key={row.id}
                            value={row.id}
                            onSelect={() => handlePick(row)}
                            className="flex flex-col items-start gap-0.5 py-2"
                          >
                            <span className="font-medium leading-tight">{row.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {(row.entityKind ?? 'ORGANIZATION') === 'PERSON'
                                ? 'Persona'
                                : 'Empresa'}
                              {row.taxId ? ` · ${row.taxId}` : ''}
                              {row.email ? ` · ${row.email}` : ''}
                            </span>
                          </CommandItem>
                        ))}
                        {hasNextPage && (
                          <div className="p-2 pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              disabled={isFetchingNextPage}
                              onClick={() => fetchNextPage()}
                            >
                              {isFetchingNextPage ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                  Cargando…
                                </>
                              ) : (
                                'Cargar más resultados'
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CommandGroup>
                </>
              )}
            </CommandList>
            {canCreateContact && (
              <>
                <CommandSeparator />
                <CommandGroup className="p-0">
                  <CommandItem
                    value="__create_client__"
                    onSelect={() => {
                      window.open('/contactos/nuevo', '_blank', 'noopener,noreferrer')
                    }}
                    className="text-primary"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear cliente (nueva pestaña)
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Busca y elige un contacto tipo cliente; los resultados vienen por páginas del servidor. También
        puedes dejar manual y rellenar nombre e ID fiscal abajo.
      </p>
    </div>
  )
}
