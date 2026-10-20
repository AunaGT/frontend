/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Persistencia en sessionStorage de página, tamaño de página y vista (tabla/cuadros)
 * para restaurar al volver desde detalle u otra ruta.
 */

import { useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react'
import { DEFAULT_PAGE_SIZE, TABLE_PAGE_SIZES } from '@/utils/pagination'

const PREFIX = 'deposito:listUi:v1:'

export type TableCardsView = 'table' | 'cards'

export interface ListUiPersisted {
  page?: number
  pageSize?: number
  view?: TableCardsView
  salesPages?: { completed?: number; cancelled?: number }
  salesPageSize?: number
  cardMultiple?: number
  cardPageSize?: number
}

/** The cached identity only namespaces UI preferences; it never authorizes access. */
export function listUiOwner(): string | undefined {
  try { const user = JSON.parse(localStorage.getItem('auth:user') || 'null'); return typeof user?.id === 'string' ? user.id : undefined } catch { return undefined }
}
function storageName(storageKey: string, owner?: string) {
  return owner ? `deposito:listUi:v2:${encodeURIComponent(owner)}:${storageKey}` : PREFIX + storageKey
}
export function readListUiPersisted(storageKey: string, owner = listUiOwner()): ListUiPersisted {
  try {
    const key = storageName(storageKey, owner)
    const session = JSON.parse(sessionStorage.getItem(key) || '{}')
    const preference = owner ? JSON.parse(localStorage.getItem(key) || '{}') : {}
    return { ...(session && !Array.isArray(session) && typeof session === 'object' ? session : {}), ...(preference && !Array.isArray(preference) && typeof preference === 'object' ? preference : {}) }
  } catch {
    return {}
  }
}

export function writeListUiPersisted(storageKey: string, patch: Partial<ListUiPersisted>, owner = listUiOwner()) {
  try {
    const key = storageName(storageKey, owner)
    const next = { ...readListUiPersisted(storageKey, owner), ...patch }
    sessionStorage.setItem(key, JSON.stringify(next))
    if (owner) localStorage.setItem(key, JSON.stringify({ pageSize: next.pageSize, cardMultiple: next.cardMultiple, cardPageSize: next.cardPageSize, view: next.view }))
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
  const dps = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const dv = opts.defaultView
  const sizes = opts.pageSizeOptions ?? ((TABLE_PAGE_SIZES as readonly number[]).includes(dps) ? TABLE_PAGE_SIZES : undefined)
  const owner = listUiOwner()
  const restored = () => {
    const s = readListUiPersisted(storageKey, owner), n = Number(s.pageSize), p = Number(s.page)
    const valid = Number.isInteger(n) && n >= 1 && (!sizes || sizes.includes(n))
    return { page: s.pageSize !== undefined && !valid ? dp : Number.isInteger(p) && p >= 1 ? p : dp,
      pageSize: valid ? n : dps, view: s.view === 'table' || s.view === 'cards' ? s.view : dv ?? 'cards' }
  }

  const [page, setPage] = useState(() => {
    return restored().page
  })
  const [pageSize, setPageSize] = useState(() => {
    return restored().pageSize
  })
  const [viewMode, setViewMode] = useState<TableCardsView>(() => {
    if (dv === undefined) return 'cards'
    return restored().view
  })

  const identity = `${owner ?? ''}:${storageKey}`, previous = useRef(identity)
  if (previous.current !== identity) {
    previous.current = identity
    const next = restored()
    setPage(next.page); setPageSize(next.pageSize); setViewMode(next.view)
  }

  useEffect(() => {
    writeListUiPersisted(storageKey, { page, pageSize }, owner)
  }, [storageKey, owner, page, pageSize])

  useEffect(() => {
    if (dv === undefined) return
    writeListUiPersisted(storageKey, { view: viewMode }, owner)
  }, [storageKey, owner, viewMode, dv])

  if (dv !== undefined) {
    return { page, setPage, pageSize, setPageSize, viewMode, setViewMode }
  }
  return { page, setPage, pageSize, setPageSize }
}
