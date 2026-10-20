import { TABLE_PAGE_SIZES } from '@/utils/pagination'

export function PageSizeSelect({ value, onChange, options = TABLE_PAGE_SIZES, label = 'Registros por página', disabled = false }: {
  value: number
  onChange: (size: number) => void
  options?: readonly number[]
  label?: string
  disabled?: boolean
}) {
  return <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
    {label}
    <select className="auna-control auna-control-select auna-receipt-select !w-20" aria-label={label} value={value} disabled={disabled}
      onChange={event => { const size = Number(event.target.value); if (options.includes(size)) onChange(size) }}>
      {options.map(size => <option key={size} value={size}>{size}</option>)}
    </select>
  </label>
}
