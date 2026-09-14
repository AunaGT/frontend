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
 * PromotionCodeInput - Component for entering and applying promotion codes
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tag, X, Loader2, TicketPercent, Gift, Sparkles } from 'lucide-react'
import type { AppliedPromotion } from '@/services/promotionService'

interface PromotionCodeInputProps {
    appliedPromotions: AppliedPromotion[]
    totalDiscount: number
    isValidating: boolean
    onApplyCode: (code: string) => Promise<boolean>
    onRemovePromotion: (promotionId: string) => void
}

export const PromotionCodeInput = ({
    appliedPromotions,
    totalDiscount,
    isValidating,
    onApplyCode,
    onRemovePromotion
}: PromotionCodeInputProps) => {
    const [codeInput, setCodeInput] = useState('')

    const handleApply = async () => {
        const success = await onApplyCode(codeInput)
        if (success) {
            setCodeInput('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleApply()
        }
    }

    const getPromoIcon = (typeName?: string) => {
        switch (typeName) {
            case 'FREE_GIFT':
                return <Gift className='w-3 h-3' />
            case 'BUY_X_GET_Y':
                return <Sparkles className='w-3 h-3' />
            default:
                return <TicketPercent className='w-3 h-3' />
        }
    }

    return (
        <div className='space-y-3'>
            {/* Code Input */}
            <div>
                <Label htmlFor='promoCode' className='text-sm font-medium flex items-center gap-2'>
                    <Tag className='w-4 h-4' />
                    Código de Promoción
                </Label>
                <div className='flex gap-2 mt-1'>
                    <Input
                        id='promoCode'
                        placeholder='Ej: DESC10, 2X1VERANO'
                        value={codeInput}
                        onChange={e => setCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        disabled={isValidating}
                        className='font-mono uppercase'
                    />
                    <Button
                        variant='outline'
                        onClick={handleApply}
                        disabled={isValidating || !codeInput.trim()}
                        className='shrink-0'
                    >
                        {isValidating ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            'Aplicar'
                        )}
                    </Button>
                </div>
            </div>

            {/* Applied Promotions List */}
            {appliedPromotions.length > 0 && (
                <div className='bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 space-y-2'>
                    <div className='flex items-center justify-between'>
                        <span className='text-sm font-medium text-green-700 dark:text-green-400'>
                            Promociones aplicadas
                        </span>
                        <Badge variant='secondary' className='bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400'>
                            -Q {totalDiscount.toFixed(2)}
                        </Badge>
                    </div>

                    <div className='space-y-1'>
                        {appliedPromotions.map(promo => (
                            <div
                                key={promo.id}
                                className='flex items-center justify-between text-sm bg-white dark:bg-gray-900 rounded px-2 py-1.5'
                            >
                                <div className='flex items-center gap-2'>
                                    {getPromoIcon(promo.type?.name)}
                                    <span className='font-medium'>{promo.code}</span>
                                    <span className='text-muted-foreground'>•</span>
                                    <span className='text-muted-foreground text-xs'>{promo.name}</span>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <span className='text-green-600 dark:text-green-400 font-medium'>
                                        -Q {promo.discountApplied.toFixed(2)}
                                    </span>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600'
                                        onClick={() => onRemovePromotion(promo.id)}
                                    >
                                        <X className='w-3 h-3' />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Free Gifts Notice */}
                    {appliedPromotions.some(p => p.freeGift) && (
                        <div className='flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mt-2'>
                            <Gift className='w-3 h-3' />
                            <span>Incluye productos de regalo</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
