import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { PRODUCTS_QUERY_KEY } from '@/hooks/useProducts'
import { authSessionIdentity } from '@/services/authSession'
import { fetchProducts, type ProductsQueryParams } from '@/services/productService'

export function useInventoryProducts(params: ProductsQueryParams) {
  const { company, branch, isConsolidated } = useTenant()
  const companyId = company?.id, branchId = isConsolidated ? 'all' : branch?.id
  const session = authSessionIdentity(), identity = JSON.stringify([companyId, branchId, session])
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity
  const search = params.search ?? '', [settledSearch, setSettledSearch] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])
  const isSearchPending = search !== settledSearch
  const enabled = !!companyId && !!branchId && !isSearchPending
  const query = useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'inventory-page', companyId, branchId, session, { ...params, search: settledSearch || undefined }],
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const check = () => {
        if (signal.aborted || currentIdentity.current !== identity || authSessionIdentity() !== session) {
          throw new DOMException('Cambió la sesión o sucursal', 'AbortError')
        }
      }
      check()
      const result = await fetchProducts({ ...params, search: settledSearch || undefined }, {
        signal, headers: { 'X-Company-Id': companyId!, 'X-Branch-Id': branchId! },
      })
      check()
      return result
    },
  })
  return { ...query, data: enabled ? query.data : undefined, isSearchPending, isLoading: query.isLoading || isSearchPending }
}
