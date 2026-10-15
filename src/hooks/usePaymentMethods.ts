import { useQuery } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { apiFetch } from '@/services/api'
import type { PaymentMethodDto } from '@/services/paymentMethodsService'
export type PaymentMethod = PaymentMethodDto
export const PAYMENT_METHODS_QUERY_KEY = ['payment-methods'] as const
export const usePaymentMethods = ({ includeInactive = false }: { includeInactive?: boolean } = {}) => {
  const { company, branch } = useTenant()
  const companyId = company?.id ?? null
  const headers = { 'X-Company-Id': companyId!, 'X-Branch-Id': branch?.id ?? 'all' }
  return useQuery({
    queryKey: [...PAYMENT_METHODS_QUERY_KEY, companyId, includeInactive],
    enabled: Boolean(companyId),
    queryFn: ({ signal }) => apiFetch<PaymentMethod[]>(`/catalogs/payment-methods${includeInactive ? '?includeInactive=1' : ''}`, { signal, headers }),
    staleTime: 60_000,
  })
}
