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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { PaymentMethodBreakdown, TheoreticalData } from '../types'
import { formatCurrency, isCashPaymentMethodName, toNumber } from '../types'

interface PaymentMethodsFormProps {
    paymentBreakdown: PaymentMethodBreakdown[]
    cashSession?: TheoreticalData['cash_session']
    onUpdateAmount: (index: number, field: 'actual_amount' | 'actual_count' | 'notes', value: string | number) => void
}

export const PaymentMethodsForm = ({ paymentBreakdown, cashSession, onUpdateAmount }: PaymentMethodsFormProps) => {
    const { currencyCode, locale } = useSystemSettings()
    return (
        <div className="space-y-4">
            <h3 className="font-semibold">Desglose por Método de Pago</h3>
            {paymentBreakdown.map((item, index) => {
                const isCash =
                    isCashPaymentMethodName(item.payment_method_name) &&
                    cashSession &&
                    cashSession.opening_float > 0

                return (
                    <Card key={item.payment_method_id}>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">{item.payment_method_name}</h4>
                                    <Badge
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-muted-foreground">Teórico</Label>
                                        <p className="text-lg font-semibold">
                                            {formatCurrency(item.theoretical_amount, currencyCode, locale)}
                                        </p>
                                        {isCash && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Incluye fondo inicial (
                                                {formatCurrency(cashSession.opening_float, currencyCode, locale)}) + ventas
                                                en efectivo (
                                                {formatCurrency(cashSession.cash_sales_amount, currencyCode, locale)})
                                            </p>
                                        )}
                                        <p className="text-sm text-muted-foreground">{item.theoretical_count} transacciones</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`actual-${index}`}>
                                            {isCash ? 'Efectivo total en caja' : 'Monto contado'}
                                        </Label>
                                        <Input
                                            id={`actual-${index}`}
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={item.actual_amount || ''}
                                            onChange={(e) => onUpdateAmount(index, 'actual_amount', e.target.value)}
                                            placeholder={isCash ? String(cashSession.expected_cash_in_drawer) : '0'}
                                        />
                                        {isCash && (
                                            <p className="text-xs text-muted-foreground">
                                                Cuente todo el efectivo físico (fondo + cobros del turno).
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor={`notes-${index}`}>Notas</Label>
                                    <Input
                                        id={`notes-${index}`}
                                        value={item.notes || ''}
                                        onChange={(e) => onUpdateAmount(index, 'notes', e.target.value)}
                                        placeholder="Observaciones (opcional)"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
