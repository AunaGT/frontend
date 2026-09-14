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
 * useCashClosureForm - Hook for managing cash closure form state and calculations
 */
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/useAuth'
import type { PaymentMethodBreakdown, Denomination, TheoreticalData } from '../types'
import { GUATEMALAN_DENOMINATIONS, toNumber } from '../types'
import { getDenominations } from '@/services/settingsService'

interface UseCashClosureFormReturn {
    // Dates
    startDate: string
    endDate: string
    setStartDate: (value: string) => void
    setEndDate: (value: string) => void
    // Form data
    paymentBreakdown: PaymentMethodBreakdown[]
    denominations: Denomination[]
    notes: string
    cashierName: string
    isSeller: boolean
    // Setters
    setPaymentBreakdown: React.Dispatch<React.SetStateAction<PaymentMethodBreakdown[]>>
    setNotes: (notes: string) => void
    // Calculations
    getCashTotal: () => number
    getActualTotal: () => number
    getTotalDifference: (theoreticalTotal: number) => number
    getDifferencePercentage: (theoreticalTotal: number) => number
    // Operations
    updateActualAmount: (index: number, field: 'actual_amount' | 'actual_count' | 'notes', value: string | number) => void
    updateDenomination: (index: number, quantity: number) => void
    initializeFromTheoretical: (data: TheoreticalData) => void
    resetForm: () => void
}

export const useCashClosureForm = (): UseCashClosureFormReturn => {
    const { user } = useAuth()

    // Determine if user is seller
    const roleName = user?.role?.name ?? undefined
    const isSeller = typeof roleName === 'string' && ['seller', 'vendedor'].includes(roleName.toLowerCase())
    const cashierName = user?.name || user?.email || 'Cajero'

    // Date state
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Form state
    const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentMethodBreakdown[]>([])
    const [denominations, setDenominations] = useState<Denomination[]>([...GUATEMALAN_DENOMINATIONS])
    const [notes, setNotes] = useState('')

    // Load denominations from API (fallback to GUATEMALAN_DENOMINATIONS)
    useEffect(() => {
        let cancelled = false
        getDenominations().then((list) => {
            if (cancelled) return
            if (list.length > 0) {
                const mapped: Denomination[] = list.map((d) => ({
                    denomination: d.denomination,
                    type: d.type as 'Billete' | 'Moneda',
                    quantity: 0,
                    subtotal: 0,
                }))
                setDenominations(mapped)
            }
        }).catch(() => { /* keep default */ })
        return () => { cancelled = true }
    }, [])

    // Initialize dates for today
    useEffect(() => {
        initializeTodayDates()
    }, [])

    const initializeTodayDates = useCallback(() => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')

        setStartDate(`${year}-${month}-${day}T00:00:00`)
        setEndDate(`${year}-${month}-${day}T23:59:59`)
    }, [])

    // Calculations
    const getCashTotal = useCallback(() => {
        return denominations.reduce((sum, denom) => sum + toNumber(denom.subtotal), 0)
    }, [denominations])

    const getActualTotal = useCallback(() => {
        return paymentBreakdown.reduce((sum, item) => sum + toNumber(item.actual_amount), 0)
    }, [paymentBreakdown])

    const getTotalDifference = useCallback((theoreticalTotal: number) => {
        return getActualTotal() - theoreticalTotal
    }, [getActualTotal])

    const getDifferencePercentage = useCallback((theoreticalTotal: number) => {
        if (theoreticalTotal === 0) return 0
        return (getTotalDifference(theoreticalTotal) / theoreticalTotal) * 100
    }, [getTotalDifference])

    // Operations
    const updateActualAmount = useCallback((
        index: number,
        field: 'actual_amount' | 'actual_count' | 'notes',
        value: string | number
    ) => {
        setPaymentBreakdown(prev => {
            const updated = [...prev]
            if (field === 'notes') {
                updated[index].notes = value as string
            } else {
                const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value
                updated[index][field] = numValue
                updated[index].difference = toNumber(updated[index].actual_amount) - toNumber(updated[index].theoretical_amount)
            }
            return updated
        })
    }, [])

    const updateDenomination = useCallback((index: number, quantity: number) => {
        setDenominations(prev => {
            const updated = [...prev]
            updated[index].quantity = quantity
            updated[index].subtotal = quantity * toNumber(updated[index].denomination)
            return updated
        })
    }, [])

    const initializeFromTheoretical = useCallback((data: TheoreticalData) => {
        setPaymentBreakdown(data.payment_breakdown.map(item => ({
            ...item,
            actual_amount: 0,
            actual_count: 0,
            difference: -item.theoretical_amount,
            notes: ''
        })))
    }, [])

    const resetForm = useCallback(() => {
        setPaymentBreakdown([])
        setDenominations((prev) => prev.map((d) => ({ ...d, quantity: 0, subtotal: 0 })))
        setNotes('')
        initializeTodayDates()
    }, [initializeTodayDates])

    return {
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        paymentBreakdown,
        denominations,
        notes,
        cashierName,
        isSeller,
        setPaymentBreakdown,
        setNotes,
        getCashTotal,
        getActualTotal,
        getTotalDifference,
        getDifferencePercentage,
        updateActualAmount,
        updateDenomination,
        initializeFromTheoretical,
        resetForm
    }
}
