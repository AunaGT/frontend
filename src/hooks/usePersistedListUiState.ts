/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Persistencia en sessionStorage de página, tamaño de página y vista (tabla/cuadros)
 * para restaurar al volver desde detalle u otra ruta.
 */

import { useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react'

const PREFIX = 'deposito:listUi:v1:'

export type TableCardsView = 'table' | 'cards'

export interface ListUiPersisted {
  page?: number
  pageSize?: number
  view?: TableCardsView
  salesPages?: { completed?: number; cancelled?: number }
  salesPageSize?: number
}

export function readListUiPersisted(storageKey: string): ListUiPersisted {
  try {
    const raw = sessionStorage.getItem(PREFIX + storageKey)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return typeof o === 'object' && o !== null ? (o as ListUiPersisted) : {}
  } catch {
    return {}
  }
}

export function writeListUiPersisted(storageKey: string, patch: Partial<ListUiPersisted>) {
  try {
    const prev = readListUiPersisted(storageKey)
    sessionStorage.setItem(PREFIX + storageKey, JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* quota / private mode */
  }
}

/** Vuelve a página 1 al cambiar filtros, sin pisar la página restaurada en el primer render. */
export function useResetPageOnFilterChange(setPage: Dispatch<SetStateAction<number>>, deps: DependencyList) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

type Opts = {
  defaultPage?: number
  defaultPageSize?: number
  defaultView?: TableCardsView
  pageSizeOptions?: readonly number[]
}

export function usePersistedListUiState(storageKey: string, opts: Opts = {}) {
  const dp = opts.defaultPage ?? 1
  const dps = opts.defaultPageSize ?? 10
  const dv = opts.defaultView

  const [page, setPage] = useState(() => {
    const s = readListUiPersisted(storageKey)
    if (s.pageSize !== undefined && opts.pageSizeOptions && !opts.pageSizeOptions.includes(Math.floor(Number(s.pageSize)))) return dp
    const p = Number(s.page)
    return Number.isFinite(p) && p >= 1 ? Math.floor(p) : dp
  })
  const [pageSize, setPageSize] = useState(() => {
    const s = readListUiPersisted(storageKey)
    const n = Number(s.pageSize)
    return Number.isFinite(n) && n >= 1 && (!opts.pageSizeOptions || opts.pageSizeOptions.includes(Math.floor(n))) ? Math.floor(n) : dps
  })
  const [viewMode, setViewMode] = useState<TableCardsView>(() => {
    if (dv === undefined) return 'cards'
    const s = readListUiPersisted(storageKey)
    if (s.view === 'table' || s.view === 'cards') return s.view
    return dv
  })

  useEffect(() => {
    writeListUiPersisted(storageKey, { page, pageSize })
  }, [storageKey, page, pageSize])

  useEffect(() => {
    if (dv === undefined) return
    writeListUiPersisted(storageKey, { view: viewMode })
  }, [storageKey, viewMode, dv])

  if (dv !== undefined) {
    return { page, setPage, pageSize, setPageSize, viewMode, setViewMode }
  }
  return { page, setPage, pageSize, setPageSize }
}
