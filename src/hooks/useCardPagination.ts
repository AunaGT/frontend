import { useCallback, useEffect, useRef, useState } from 'react'

export function useCardPagination({ enabled, tablePageSize, onPageChange }: {
  enabled: boolean
  tablePageSize: number
  onPageChange: (page: number) => void
}) {
  const [width, setWidth] = useState<number | null>(null)
  const [multiple, setMultiple] = useState(1)
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
  const unit = Math.ceil(10 / columns) * columns
  const pageSizeOptions = [unit, unit * 2, unit * 3, unit * 4]
  const pageSize = enabled && width !== 0 ? unit * multiple : tablePageSize
  const previousSize = useRef(pageSize)
  useEffect(() => {
    if (previousSize.current !== pageSize) onPageChange(1)
    previousSize.current = pageSize
  }, [pageSize, onPageChange])
  const setCardPageSize = (size: number) => {
    if (pageSizeOptions.includes(size)) setMultiple(size / unit)
  }
  return { containerRef, pageSize, pageSizeOptions, setCardPageSize }
}
