import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { useCardPagination } from '@/hooks/useCardPagination'

export function CardPageSizeSelect({ pagination, label }: { pagination: ReturnType<typeof useCardPagination>; label: string }) {
  return <label className="mb-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
    Tarjetas por página
    <Select value={String(pagination.pageSize)} onValueChange={value => pagination.setCardPageSize(Number(value))}>
      <SelectTrigger className="w-20" aria-label={`${label} por página`}><SelectValue /></SelectTrigger>
      <SelectContent>{pagination.pageSizeOptions.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
    </Select>
  </label>
}
