import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adaptApiSupplier, fetchSupplierById } from '@/services/supplierService'

export type CommercialPaymentTerms = { payment_condition: 'CASH' | 'CREDIT'; credit_days: number | null }

export function CommercialPaymentFields({ customerId, value, onChange }: {
  customerId?: string | null
  value: CommercialPaymentTerms
  onChange: (value: CommercialPaymentTerms) => void
}) {
  const { data: customer } = useQuery({
    queryKey: ['customer-payment-terms', customerId],
    queryFn: async () => adaptApiSupplier(await fetchSupplierById(customerId!)),
    enabled: Boolean(customerId && customerId !== '__none__') && value.payment_condition === 'CREDIT',
  })
  const suggestedDays = customer?.paymentTermsList?.find(term => term.isDefault)?.netDays
  useEffect(() => {
    if (value.payment_condition === 'CREDIT' && value.credit_days == null && suggestedDays != null) {
      onChange({ ...value, credit_days: suggestedDays })
    }
  }, [suggestedDays, value, onChange])
  return <div className="space-y-3">
    <Label>Condición de pago acordada</Label>
    <div className="grid grid-cols-2 gap-2">
      {(['CASH', 'CREDIT'] as const).map(condition => <button key={condition} type="button" aria-pressed={value.payment_condition === condition}
        className={`rounded-xl border px-4 py-3 text-sm font-medium ${value.payment_condition === condition ? 'border-brand-orange bg-brand-orange/10 text-brand-orange' : 'border-input bg-background'}`}
        onClick={() => onChange({ payment_condition: condition, credit_days: condition === 'CREDIT' ? suggestedDays ?? null : null })}>{condition === 'CASH' ? 'Al contado' : 'A crédito'}</button>)}
    </div>
    {value.payment_condition === 'CREDIT' && <><Label>Plazo desde la fecha de venta (días)<Input aria-label="Plazo de crédito en días" className="mt-2" type="number" min={0} max={3650} step={1} value={value.credit_days ?? ''} onChange={event => onChange({ ...value, credit_days: event.target.value === '' ? null : Number(event.target.value) })} /></Label>
      {(!customerId || customerId === '__none__') && <p role="alert" className="text-sm text-destructive">Selecciona un cliente registrado para vender a crédito.</p>}</>}
    <p className="text-xs text-muted-foreground">{value.payment_condition === 'CREDIT' ? 'Este acuerdo se conservará en el pedido. El vencimiento y el saldo en Cartera se generan al registrar la venta; podrás recibir un abono inicial.' : 'Al registrar la venta se confirma el pago completo y su medio de cobro.'}</p>
  </div>
}
