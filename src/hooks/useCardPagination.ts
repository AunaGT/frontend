import { useCallback, useEffect, useRef, useState } from 'react'
import { listUiOwner, readListUiPersisted, writeListUiPersisted } from './usePersistedListUiState'

export function useCardPagination({ enabled, tablePageSize, onPageChange, storageKey }: {
  enabled: boolean
  tablePageSize: number
  onPageChange: (page: number) => void
  storageKey?: string
}) {
  const owner = listUiOwner()
  const restoreSelection = () => {
    const saved = storageKey ? readListUiPersisted(storageKey, owner) : {}
    const size = Number(saved.cardPageSize), multiple = Number(saved.cardMultiple)
    return { size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : undefined,
      multiple: Number.isInteger(multiple) && multiple >= 1 && multiple <= 4 ? multiple : undefined }
  }
  const [width, setWidth] = useState<number | null>(null)
  const [selection, setSelection] = useState(restoreSelection)
  const identity = `${owner ?? ''}:${storageKey ?? ''}`, previousIdentity = useRef(identity)
  if (previousIdentity.current !== identity) { previousIdentity.current = identity; setSelection(restoreSelection()) }
  const observer = useRef<ResizeObserver | null>(null)
  const containerRef = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect()
    if (!node) return
    setWidth(node.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    observer.current.observe(node)
  }, [])
  useEffect(() => () => observer.current?.disconnect(), [])

  // Match .auna-record-grid's 320px minimum and 12px gap, including sidebar resizing.
  const columns = Math.max(1, Math.floor(((width ?? 0) + 12) / 332))
  const fitRows = (size: number) => Math.min(Math.ceil(size / columns) * columns, Math.floor(100 / columns) * columns || 100)
  const legacySize = selection.multiple ? Math.ceil(10 / columns) * columns * selection.multiple : 40
  const cardSize = fitRows(selection.size ?? legacySize)
  const pageSizeOptions = [...new Set([20, 40, 60, 80, 100, cardSize].map(fitRows))].sort((a, b) => a - b)
  const pageSize = enabled && width !== 0 ? cardSize : tablePageSize
  const previousSize = useRef(pageSize)
  useEffect(() => {
    if (previousSize.current !== pageSize) onPageChange(1)
    previousSize.current = pageSize
  }, [pageSize, onPageChange])
  const setCardPageSize = (size: number) => {
    if (pageSizeOptions.includes(size)) {
      setSelection({ size, multiple: undefined })
      if (storageKey) writeListUiPersisted(storageKey, { cardPageSize: size }, owner)
    }
  }
  return { containerRef, pageSize, pageSizeOptions, setCardPageSize }
}
