/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Pagination - Reusable pagination component
 */
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  hasNextPage?: boolean
  hasPrevPage?: boolean
  loading?: boolean
  totalItems?: number
  pageSize?: number
  count?: number
  itemLabel?: string
}

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  hasPrevPage,
  loading = false,
  totalItems,
  pageSize = 10,
  count = 0,
  itemLabel = 'registros',
}: PaginationProps) => {
  const canGoPrev = hasPrevPage !== undefined ? hasPrevPage : currentPage > 1
  const canGoNext = hasNextPage !== undefined ? hasNextPage : currentPage < totalPages

  const first = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const last = Math.min(totalPages, first + 4)
  const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index)
  return (
    <footer className={totalItems === undefined ? 'flex justify-end items-center gap-2 mt-4' : 'auna-data-table-pagination'}>
      <span className="text-sm text-muted-foreground mr-2">
        {totalItems === undefined ? `Página ${currentPage} de ${totalPages}` : `Mostrando ${totalItems ? (currentPage - 1) * pageSize + 1 : 0} a ${totalItems ? (currentPage - 1) * pageSize + count : 0} de ${totalItems} ${itemLabel}`}
      </span>
      <nav className="flex items-center gap-2" aria-label={`Paginación de ${itemLabel}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev || loading}
        aria-label="Página anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      {totalItems !== undefined && pages.map((page) => <Button key={page} variant="outline" size="sm" aria-current={page === currentPage ? 'page' : undefined} disabled={loading} onClick={() => onPageChange(page)}>{page}</Button>)}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext || loading}
        aria-label="Página siguiente"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
      </nav>
    </footer>
  )
}
