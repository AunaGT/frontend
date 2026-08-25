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
 * NewSaleDialog - Dialog for creating a new sale
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt } from 'lucide-react'
import { CartPanel } from './CartPanel'
import { PromotionCodeInput } from './PromotionCodeInput'
import type { Product } from '@/types/product'
import type { CartProduct } from '../types'
import type { PaymentMethod } from '@/hooks/usePaymentMethods'
import type { AppliedPromotion } from '@/services/promotionService'

interface NewSaleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    // Customer info
    customer: string
    onCustomerChange: (value: string) => void
    customerNit: string
    onCustomerNitChange: (value: string) => void
    isFinalConsumer: boolean
    onFinalConsumerChange: (value: boolean) => void
    // Payment
    paymentMethod: PaymentMethod | null
    paymentMethods: PaymentMethod[]
    isLoadingPaymentMethods: boolean
    onPaymentMethodChange: (method: PaymentMethod | null) => void
    // Cart
    cartItems: CartProduct[]
    cartTotal: number
    productSearch: string
    onProductSearchChange: (value: string) => void
    filteredProducts: Product[]
    isLoadingProducts: boolean
    onAddToCart: (product: Product) => void
    onRemoveFromCart: (productId: string) => void
    onUpdateQuantity: (productId: string, qty: number) => void
    // Payment amount
    amountReceived: string
    onAmountReceivedChange: (value: string) => void
    changeAmount: number
    // Submit
    isProcessing: boolean
    onSubmit: () => void
    // Promotions
    appliedPromotions?: AppliedPromotion[]
    totalDiscount?: number
    finalTotal?: number
    isValidatingPromotion?: boolean
    onApplyPromoCode?: (code: string) => Promise<boolean>
    onRemovePromotion?: (promotionId: string) => void
}

export const NewSaleDialog = ({
    open,
    onOpenChange,
    customer,
    onCustomerChange,
    customerNit,
    onCustomerNitChange,
    isFinalConsumer,
    onFinalConsumerChange,
    paymentMethod,
    paymentMethods,
    isLoadingPaymentMethods,
    onPaymentMethodChange,
    cartItems,
    cartTotal,
    productSearch,
    onProductSearchChange,
    filteredProducts,
    isLoadingProducts,
    onAddToCart,
    onRemoveFromCart,
    onUpdateQuantity,
    amountReceived,
    onAmountReceivedChange,
    changeAmount,
    isProcessing,
    onSubmit,
    // Promotions
    appliedPromotions = [],
    totalDiscount = 0,
    finalTotal,
    isValidatingPromotion = false,
    onApplyPromoCode,
    onRemovePromotion
}: NewSaleDialogProps) => {
    const displayTotal = finalTotal ?? cartTotal
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle>Registrar Nueva Venta</DialogTitle>
                    <DialogDescription className="sr-only">
                        Formulario para registrar una nueva venta: datos del cliente, productos y método de pago.
                    </DialogDescription>
                </DialogHeader>
                <div className='space-y-6'>
                    {/* Customer Info */}
                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <Label htmlFor='customer'>Cliente *</Label>
                            <Input
                                id='customer'
                                placeholder='Nombre del cliente'
                                value={customer}
                                onChange={e => onCustomerChange(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor='payment'>Método de Pago *</Label>
                            <Select
                                value={paymentMethod ? String(paymentMethod.id) : ''}
                                onValueChange={(val) => {
                                    const found = paymentMethods.find(pm => String(pm.id) === val)
                                    onPaymentMethodChange(found ?? null)
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder='Seleccionar método' />
                                </SelectTrigger>
                                <SelectContent>
                                    {isLoadingPaymentMethods && (
                                        <SelectItem value='loading' disabled>Cargando...</SelectItem>
                                    )}
                                    {paymentMethods.map(pm => (
                                        <SelectItem key={pm.id} value={String(pm.id)}>{pm.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <Label htmlFor='customerNit'>ID fiscal</Label>
                            <Input
                                id='customerNit'
                                placeholder='12345678-9'
                                value={customerNit}
                                onChange={e => onCustomerNitChange(e.target.value)}
                                disabled={isFinalConsumer}
                            />
                        </div>
                        <div className='flex items-center space-x-2 pt-6'>
                            <input
                                type='checkbox'
                                id='isFinalConsumer'
                                checked={isFinalConsumer}
                                onChange={e => {
                                    onFinalConsumerChange(e.target.checked)
                                    if (e.target.checked) onCustomerNitChange('')
                                }}
                                className='w-4 h-4'
                            />
                            <Label htmlFor='isFinalConsumer' className='text-sm'>Consumidor Final (CF)</Label>
                        </div>
                    </div>

                    {/* Cart Panel */}
                    <CartPanel
                        cartItems={cartItems}
                        cartTotal={cartTotal}
                        productSearch={productSearch}
                        onProductSearchChange={onProductSearchChange}
                        filteredProducts={filteredProducts}
                        isLoadingProducts={isLoadingProducts}
                        onAddToCart={onAddToCart}
                        onRemoveFromCart={onRemoveFromCart}
                        onUpdateQuantity={onUpdateQuantity}
                        paymentMethodName={paymentMethod?.name}
                        amountReceived={amountReceived}
                        onAmountReceivedChange={onAmountReceivedChange}
                        changeAmount={changeAmount}
                    />

                    {/* Promotion Code Input */}
                    {onApplyPromoCode && onRemovePromotion && (
                        <PromotionCodeInput
                            appliedPromotions={appliedPromotions}
                            totalDiscount={totalDiscount}
                            isValidating={isValidatingPromotion}
                            onApplyCode={onApplyPromoCode}
                            onRemovePromotion={onRemovePromotion}
                        />
                    )}

                    {/* Total Summary with Discounts */}
                    {totalDiscount > 0 && (
                        <div className='bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4'>
                            <div className='flex justify-between text-sm text-muted-foreground'>
                                <span>Subtotal:</span>
                                <span>Q {cartTotal.toFixed(2)}</span>
                            </div>
                            <div className='flex justify-between text-sm text-green-600 dark:text-green-400 font-medium'>
                                <span>Descuentos:</span>
                                <span>-Q {totalDiscount.toFixed(2)}</span>
                            </div>
                            <div className='flex justify-between text-lg font-bold mt-2 pt-2 border-t border-green-200 dark:border-green-800'>
                                <span>Total a Pagar:</span>
                                <span className='text-green-700 dark:text-green-300'>Q {displayTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    {/* Actions */}
                    <div className='flex justify-end space-x-2'>
                        <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isProcessing}>
                            Cancelar
                        </Button>
                        <Button
                            className='bg-liquor-amber hover:bg-liquor-amber/90 text-white'
                            onClick={onSubmit}
                            disabled={cartItems.length === 0 || isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    Procesando...
                                </>
                            ) : (
                                <><Receipt className='w-4 h-4 mr-2' /> Procesar Venta</>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
