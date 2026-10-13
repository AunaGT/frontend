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
import { Input } from '@/components/ui/input'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Banknote } from 'lucide-react'
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
                <h2 className="cash-closure-panel-heading"><Banknote className="h-5 w-5 text-primary" aria-hidden="true" />Arqueo por denominaciones</h2>
                <p className="text-xs text-muted-foreground mt-1">
                    Opcional. El total calculado actualiza automáticamente el efectivo contado.
                </p>
                {openingFloat > 0 && (
                    <p className="auna-field-message mt-1">
                        Incluya el fondo inicial ({formatCurrency(openingFloat, currencyCode, locale)}) y las ventas en
                        efectivo del turno.
                        {expectedCashInDrawer != null && expectedCashInDrawer > 0 && (
                            <>
                                {' '}
                                Teórico en caja:{' '}
                                <output className="auna-field-value-inline font-medium text-foreground">
                                    {formatCurrency(expectedCashInDrawer, currencyCode, locale)}
                                </output>
                            </>
                        )}
                    </p>
                )}
            </div>
                    <div className="cash-closure-denominations-scroll" role="region" aria-label="Conteo de billetes y monedas" tabIndex={0}>
                      <table>
                        <caption className="sr-only">Cantidades y subtotales por denominación</caption>
                        <thead><tr>
                            <th scope="col">Denominación</th>
                            <th scope="col">Cantidad</th>
                            <th scope="col" className="cash-closure-money">Subtotal</th>
                        </tr></thead>
                        <tbody>
                        {denominations.map((denom, index) => (
                            <tr key={`${denom.type}-${denom.denomination}`}>
                                <th scope="row" className="!bg-transparent !text-foreground">
                                  {formatCurrency(toNumber(denom.denomination), currencyCode, locale)}
                                  <span className="block text-xs font-normal text-muted-foreground">{denom.type}</span>
                                </th>
                                <td>
                                <Input
                                    type="number"
                                    data-control-size="compact"
                                    aria-label={`Cantidad de ${denom.type} de ${formatCurrency(toNumber(denom.denomination), currencyCode, locale)}`}
                                    min="0"
                                    value={denom.quantity || ''}
                                    onChange={(e) => onUpdateQuantity(index, parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                                </td>
                                <td className="cash-closure-money font-medium">{formatCurrency(denom.subtotal, currencyCode, locale)}</td>
                            </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t pt-3 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-sm font-semibold">Total efectivo contado</span>
                        <output className="auna-field-value-inline text-lg font-bold tabular-nums">{formatCurrency(cashTotal, currencyCode, locale)}</output>
                    </div>
        </div>
    )
}
