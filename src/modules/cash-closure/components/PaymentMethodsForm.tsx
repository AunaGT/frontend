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
 * PaymentMethodsForm - Form for entering actual payment amounts
 */
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { CreditCard } from 'lucide-react'
import type { PaymentMethodBreakdown, TheoreticalData } from '../types'
import { formatCurrency, isCashPaymentMethodName, toNumber } from '../types'

interface PaymentMethodsFormProps {
    paymentBreakdown: PaymentMethodBreakdown[]
    cashSession?: TheoreticalData['cash_session']
    showAdvancedDetails?: boolean
    countedPaymentMethodIds?: Set<number>
    onUpdateAmount: (index: number, field: 'actual_amount' | 'actual_count' | 'notes', value: string | number) => void
}

export const PaymentMethodsForm = ({
    paymentBreakdown,
    cashSession,
    showAdvancedDetails = false,
    countedPaymentMethodIds,
    onUpdateAmount,
}: PaymentMethodsFormProps) => {
    const { currencyCode, locale } = useSystemSettings()
    return (
        <div className="auna-section-list">
            <h2 className="cash-closure-panel-heading"><CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />Métodos de pago</h2>
            <p className="text-xs text-muted-foreground">Verifica cada monto. Escribe 0 cuando corresponda.</p>
            {paymentBreakdown.map((item, index) => {
                const isCash =
                    isCashPaymentMethodName(item.payment_method_name) &&
                    cashSession &&
                    cashSession.opening_float > 0

                return (
                    <section key={item.payment_method_id} className="auna-section-row py-3">
                            <div className="cash-closure-method-row">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-medium">{item.payment_method_name}</h4>
                                    <Badge className="text-[11px]"
                                        variant={
                                            toNumber(item.difference) === 0
                                                ? 'default'
                                                : toNumber(item.difference) > 0
                                                  ? 'secondary'
                                                  : 'destructive'
                                        }
                                    >
                                        {toNumber(item.difference) >= 0 ? '+' : ''}
                                        {formatCurrency(item.difference, currencyCode, locale)}
                                    </Badge>
                                </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground">Esperado</p>
                                        <p className="text-sm font-semibold tabular-nums">
                                            {formatCurrency(item.theoretical_amount, currencyCode, locale)}
                                        </p>
                                        {isCash && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Fondo inicial (
                                                {formatCurrency(cashSession.opening_float, currencyCode, locale)}) + ventas
                                                en efectivo (
                                                {formatCurrency(cashSession.cash_sales_amount, currencyCode, locale)})
                                            </p>
                                        )}
                                        {showAdvancedDetails && (
                                            <p className="text-sm text-muted-foreground">{item.theoretical_count} transacciones</p>
                                        )}
                                    </div>
                              </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`actual-${index}`}>
                                            {isCash ? 'Efectivo contado en caja' : 'Monto verificado'}
                                            <span className="sr-only"> para {item.payment_method_name}</span>
                                        </Label>
                                        <Input
                                            id={`actual-${index}`}
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={item.actual_amount || (countedPaymentMethodIds?.has(item.payment_method_id) ? 0 : '')}
                                            onChange={(e) => onUpdateAmount(index, 'actual_amount', e.target.value)}
                                            placeholder={isCash ? String(cashSession.expected_cash_in_drawer) : '0'}
                                        />
                                        {isCash && (
                                            <p className="text-xs text-muted-foreground">
                                                Cuente todo el efectivo físico (fondo + cobros del turno).
                                            </p>
                                        )}
                                    </div>
                                {showAdvancedDetails && <div className="cash-closure-method-note space-y-1">
                                    <Label htmlFor={`notes-${index}`}>Notas<span className="sr-only"> para {item.payment_method_name}</span></Label>
                                    <Input
                                        id={`notes-${index}`}
                                        value={item.notes || ''}
                                        onChange={(e) => onUpdateAmount(index, 'notes', e.target.value)}
                                        placeholder="Observaciones (opcional)"
                                    />
                                </div>}
                            </div>
                    </section>
                )
            })}
        </div>
    )
}
