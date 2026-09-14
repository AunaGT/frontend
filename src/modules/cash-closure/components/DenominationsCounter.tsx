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
 * DenominationsCounter - Cash denominations counter
 */
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { Denomination } from '../types'
import { formatCurrency, toNumber } from '../types'

interface DenominationsCounterProps {
    denominations: Denomination[]
    onUpdateQuantity: (index: number, quantity: number) => void
    cashTotal: number
    expectedCashInDrawer?: number
    openingFloat?: number
}

export const DenominationsCounter = ({
    denominations,
    onUpdateQuantity,
    cashTotal,
    expectedCashInDrawer,
    openingFloat = 0,
}: DenominationsCounterProps) => {
    const { currencyCode, locale } = useSystemSettings()
    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold">Conteo de Efectivo</h3>
                {openingFloat > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Incluya el fondo inicial ({formatCurrency(openingFloat, currencyCode, locale)}) y las ventas en
                        efectivo del turno.
                        {expectedCashInDrawer != null && expectedCashInDrawer > 0 && (
                            <>
                                {' '}
                                Teórico en caja:{' '}
                                <span className="font-medium text-foreground">
                                    {formatCurrency(expectedCashInDrawer, currencyCode, locale)}
                                </span>
                            </>
                        )}
                    </p>
                )}
            </div>
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-2 font-semibold text-sm">
                            <div>Denominación</div>
                            <div>Tipo</div>
                            <div>Cantidad</div>
                            <div>Subtotal</div>
                        </div>
                        {denominations.map((denom, index) => (
                            <div key={`${denom.type}-${denom.denomination}`} className="grid grid-cols-4 gap-2 items-center">
                                <div className="font-medium">Q {toNumber(denom.denomination).toFixed(2)}</div>
                                <div className="text-sm text-muted-foreground">{denom.type}</div>
                                <Input
                                    type="number"
                                    min="0"
                                    value={denom.quantity || ''}
                                    onChange={(e) => onUpdateQuantity(index, parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="h-8"
                                />
                                <div className="font-semibold">{formatCurrency(denom.subtotal, currencyCode, locale)}</div>
                            </div>
                        ))}
                        <div className="border-t pt-3 mt-3 flex justify-between items-center">
                            <span className="font-semibold">Total Efectivo Contado:</span>
                            <span className="text-xl font-bold">{formatCurrency(cashTotal, currencyCode, locale)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
