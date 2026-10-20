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
 * CartPanel - Cart panel for new sale dialog
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Minus, X, Search, Calculator } from 'lucide-react'
import type { Product } from '@/types/product'
import type { CartProduct } from '../types'
import { LoadingState } from '@/components/shared/LoadingState'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import {stepQuantity,previewLineTotal} from '@/lib/commercialQuantity'
import {stepUnitQuantity,selectedLineTotal,formatUnitDecimal} from '@/modules/inventory/units/public'
import {UnitLineFields} from '@/components/shared/UnitLineFields'

interface CartPanelProps {
    cartItems: CartProduct[]
    cartTotal: number
    productSearch: string
    onProductSearchChange: (value: string) => void
    filteredProducts: Product[]
    isLoadingProducts: boolean
    onAddToCart: (product: Product) => void
    onRemoveFromCart: (productId: string) => void
    onUpdateQuantity: (productId: string, newQty: string | number) => void
    onSelectUnit?: (lineKey:string,id:string|null)=>void
    onAcceptRounding?: (lineKey:string,accepted:boolean)=>void
    // Payment
    paymentMethodName?: string
    amountReceived: string
    onAmountReceivedChange: (value: string) => void
    changeAmount: number
}

export const CartPanel = ({
    cartItems,
    cartTotal,
    productSearch,
    onProductSearchChange,
    filteredProducts,
    isLoadingProducts,
    onAddToCart,
    onRemoveFromCart,
    onUpdateQuantity,
    onSelectUnit,onAcceptRounding,
    paymentMethodName,
    amountReceived,
    onAmountReceivedChange,
    changeAmount
}: CartPanelProps) => {
    const total=(item:CartProduct)=>{try{return item.unitSelection?selectedLineTotal(item.qty,item.unitSelection):previewLineTotal(item.qty,item.price.toFixed(2))}catch{return '—'}}
    const isCash = paymentMethodName?.toLowerCase() === 'efectivo'

    return (
        <>
            {/* Product Search */}
            <div>
                <Label>Buscar Productos</Label>
                <div className='relative'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                    <Input
                        placeholder='Buscar por nombre o código de barras...'
                        value={productSearch}
                        onChange={e => onProductSearchChange(e.target.value)}
                        className='pl-10'
                    />
                </div>
                {productSearch && (
                    <div className='mt-2 max-h-40 overflow-y-auto border rounded-lg'>
                        {isLoadingProducts ? (
                            <LoadingState variant="cards" rows={3} message="Cargando productos…" />
                        ) : filteredProducts.length === 0 ? (
                            <CollectionEmptyState compact filtered title="El catálogo espera tus productos" onReset={() => onProductSearchChange('')} />
                        ) : filteredProducts.map(product => (
                            <div
                                key={product.id}
                                className='p-2 hover:bg-muted cursor-pointer flex justify-between items-center'
                                onClick={() => onAddToCart(product)}
                            >
                                <div>
                                    <div className='font-medium'>{product.name}</div>
                                    <div className='text-sm text-muted-foreground'>
                                        Q {Number(product.price).toFixed(2)} • Stock: {product.stock}
                                    </div>
                                </div>
                                <Button size='sm' variant='outline'><Plus className='w-4 h-4' /></Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cart Items */}
            <div>
                <Label>Productos en Venta ({cartItems.length})</Label>
                <div className='border rounded-lg'>
                    {cartItems.length === 0 ? (
                        <CollectionEmptyState compact title="La venta empieza con un producto" description="Busca un producto arriba para agregarlo a esta venta." />
                    ) : (
                        <div className='divide-y'>
                            {cartItems.map(item => (
                                <div key={item.lineKey??item.id} className='p-3 flex items-center justify-between'>
                                    <div className='flex-1'>
                                        <div className='font-medium'>{item.name}</div>
                                        <div className='text-sm text-muted-foreground'>Q {item.unitSelection?formatUnitDecimal(item.unitSelection.unitPrice):item.price.toFixed(2)} / {item.unitSelection?.snapshot.presentation?.label??item.unitSelection?.snapshot.baseUnit.label??'unidad'}</div>
                                        {item.unitSelection&&<UnitLineFields product={item} selection={item.unitSelection} quantity={item.qty} disabled={!onSelectUnit||!!item.unitSelection.sourceLineId} onSelect={id=>onSelectUnit?.(item.lineKey??item.id,id)} onAcceptRounding={accepted=>onAcceptRounding?.(item.lineKey??item.id,accepted)}/>}
                                    </div>
                                    <div className='flex items-center space-x-2'>
                                        <Button size='sm' variant='outline' onClick={() => onUpdateQuantity(item.lineKey??item.id, item.unitSelection?stepUnitQuantity(item.qty,-1):stepQuantity(item.qty,-1))}>
                                            <Minus className='w-4 h-4' />
                                        </Button>
                                        {item.unitSelection?<Input aria-label={`Cantidad de ${item.name}`} inputMode="decimal" className="w-24 text-center" value={item.qty} onChange={event=>onUpdateQuantity(item.lineKey??item.id,event.target.value)}/>:<span className='w-8 text-center'>{item.qty}</span>}
                                        <Button size='sm' variant='outline' onClick={() => onUpdateQuantity(item.lineKey??item.id, item.unitSelection?stepUnitQuantity(item.qty,1):stepQuantity(item.qty,1))}>
                                            <Plus className='w-4 h-4' />
                                        </Button>
                                        <div className='w-20 text-right font-medium'>Q {total(item)}</div>
                                        <Button size='sm' variant='ghost' onClick={() => onRemoveFromCart(item.lineKey??item.id)}>
                                            <X className='w-4 h-4' />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Total & Payment */}
            {cartItems.length > 0 && (
                <div className='bg-muted/50 p-4 rounded-lg space-y-3'>
                    <div className='flex justify-between text-lg font-bold'>
                        <span>Total:</span>
                        <output className="auna-field-value-inline">Q {cartTotal.toFixed(2)}</output>
                    </div>
                    {isCash && (
                        <>
                            <div>
                                <Label htmlFor='amountReceived'>Monto Recibido</Label>
                                <div className='relative'>
                                    <Calculator className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                                    <Input
                                        id='amountReceived'
                                        type='number'
                                        placeholder='0.00'
                                        value={amountReceived}
                                        onChange={e => onAmountReceivedChange(e.target.value)}
                                        className='pl-10'
                                        step='0.01'
                                    />
                                </div>
                            </div>
                            {amountReceived && parseFloat(amountReceived) >= cartTotal && (
                                <div className='flex justify-between text-lg font-bold text-primary'>
                                    <span>Vuelto:</span>
                                    <output className="auna-field-value-inline">Q {changeAmount.toFixed(2)}</output>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    )
}
