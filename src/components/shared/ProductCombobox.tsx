/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllProducts } from '@/services/productService'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils'
import { cn } from '@/lib/utils'

export interface ProductComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  icon?: React.ReactNode
}

function useProducts() {
  return useQuery({
    queryKey: ['products-list'],
    // Envuelto: React Query pasa su contexto como primer argumento y
    // fetchAllProducts lo tomaría como sus opciones.
    queryFn: () => fetchAllProducts(),
    staleTime: 5 * 60 * 1000
  })
}

export const ProductCombobox = ({ value, onChange, placeholder, label, icon }: ProductComboboxProps) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { locale, currencyCode } = useSystemSettings()
  const { data: products = [], isLoading } = useProducts()

  const filteredProducts = useMemo(() => {
    if (!search) return products.slice(0, 50)
    const term = search.toLowerCase()
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.barcode?.toLowerCase().includes(term))
      )
      .slice(0, 50)
  }, [products, search])

  const selectedProduct = products.find((p) => p.id === value)

  return (
    <div className="space-y-1">
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <div className="flex items-center gap-2 truncate">
              {icon}
              {selectedProduct ? (
                <span className="truncate">{selectedProduct.name}</span>
              ) : (
                <span className="text-muted-foreground">
                  {placeholder ?? 'Seleccionar producto...'}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar producto..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <CommandEmpty>No se encontraron productos</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredProducts.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => {
                        onChange(product.id)
                        setOpen(false)
                        setSearch('')
                      }}
                    >
                      <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === product.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(product.price ?? 0, locale, currencyCode)} • {product.category ?? '-'}
                      </span>
                    </div>
                  </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
