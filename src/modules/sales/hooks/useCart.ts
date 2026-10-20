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
 * useCart - Custom hook for managing the shopping cart
 */
import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { getApiBaseUrl } from '@/services/api'
import {normalizeQuantityInput,previewLineTotal,stepQuantity} from '@/lib/commercialQuantity'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import type { Product } from '@/types/product'
import type { CartProduct, AvailabilityDialogState, AdminAuthDialogState } from '../types'
import {selectProductUnit,reconcileUnitPreview,unitCartKey,selectedQuantity,selectedBaseQuantity,selectedLineTotal,exactProductValues,addUnitQuantities,compareUnitQuantities,stepUnitQuantity,type UnitSelection,type UnitPreview} from '@/modules/inventory/units/public'

interface UseCartOptions {
    availableProducts: Product[]
    /** Precio unitario según cliente/canal (POS); si no se envía, se usa `product.price`. */
    getUnitPrice?: (product: Product) => number
    /** Cantidad vendible (stock − reservas); por defecto `product.stock`. */
    getAvailableQty?: (product: Product) => number
    getAvailableQtyExact?: (product:Product)=>string
    priceContext?:string
    isCurrent?:()=>boolean
}

interface UseCartReturn {
    cartItems: CartProduct[]
    cartTotal: number
    cartTotalExact: string
    baseQuantities: Record<string,string>
    hasInvalidQuantities: boolean
    lineTotals: Record<string,string|null>
    adminAuthorizedProducts: Set<string>
    availabilityDialog: AvailabilityDialogState
    adminAuthDialog: AdminAuthDialogState
    additionalQty: string
    adminUsername: string
    adminPassword: string
    isAuthenticating: boolean
    // Actions
    addToCart: (product: Product, selection?: {presentationId?:string|null;priceContext?:string}) => void
    selectCartUnit: (lineKey:string,presentationId:string|null) => void
    acceptCartRounding: (lineKey:string,accepted:boolean) => void
    removeFromCart: (productId: string) => void
    updateQuantity: (productId: string, newQty: string | number) => void
    clearCart: () => void
    /** Restaura líneas desde borrador; devuelve productIds no encontrados en catálogo. */
    hydrateFromLines: (
        lines: { productId: string; qty: string | number;unitSelection?:UnitSelection;lineKey?:string }[],
        adminAuthorizedIds: string[]
    ) => { missingProductIds: string[]; qtyAdjustedIds: string[];unitReviewIds:string[] }
    /** Recalcula precios en carrito (p. ej. tras cambiar canal o cliente). */
    repriceCartLines: () => void
    reconcileUnitPreparation:(lineKey:string,preview:UnitPreview)=>boolean
    setAdditionalQty: (qty: string) => void
    setAdminUsername: (username: string) => void
    setAdminPassword: (password: string) => void
    // Dialog handlers
    handleConfirmAdditionalQty: () => void
    handleCancelAvailability: () => void
    handleAdminAuth: () => Promise<void>
    closeAdminAuthDialog: () => void
}

export const useCart = ({ availableProducts, getUnitPrice, getAvailableQty,getAvailableQtyExact,priceContext='LIST',isCurrent=()=>true }: UseCartOptions): UseCartReturn => {
    const { toast } = useToast()
    const {locale}=useSystemSettings()
    const normalize=useCallback((qty:string,product:Product)=>normalizeQuantityInput(qty,{kind:product.kind ?? 'STANDARD',quantityDecimals:product.quantityDecimals ?? 0},locale),[locale])

    // Cart state
    const [cartItems, setCartItems] = useState<CartProduct[]>([])
    const [adminAuthorizedProducts, setAdminAuthorizedProducts] = useState<Set<string>>(new Set())

    // Availability dialog state
    const [availabilityDialog, setAvailabilityDialog] = useState<AvailabilityDialogState>({
        open: false,
        product: null,
        requestedQty: 0,
        availableStock: 0
    })
    const [additionalQty, setAdditionalQty] = useState('')

    // Admin auth dialog state
    const [adminAuthDialog, setAdminAuthDialog] = useState<AdminAuthDialogState>({
        open: false,
        product: null,
        requestedQty: 0
    })
    const [adminUsername, setAdminUsername] = useState('')
    const [adminPassword, setAdminPassword] = useState('')
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [authOwner]=useState(()=>({operation:0}))

    // Computed
    const keyOf=(item:CartProduct)=>item.lineKey??item.id
    const lineTotals=Object.fromEntries(cartItems.map(item=>{try{return[keyOf(item),item.unitSelection?selectedLineTotal(item.qty,item.unitSelection):previewLineTotal(normalize(item.qty,availableProducts.find(product=>product.id===item.id) ?? item),item.price.toFixed(2))]}catch{return[keyOf(item),null]}})) as Record<string,string|null>
    const totalCents=Object.values(lineTotals).reduce((sum,total)=>sum+(total ? BigInt(total.replace('.','')) : 0n),0n)
    const baseQuantities:Record<string,string>={}
    let invalidUnits=false
    for(const item of cartItems)if(item.unitSelection){try{if(item.unitSelection.reviewRequired)invalidUnits=true;baseQuantities[item.id]=addUnitQuantities(baseQuantities[item.id]??'0',selectedBaseQuantity(item.qty,item.unitSelection))}catch{invalidUnits=true}}
    const hasInvalidQuantities=invalidUnits||totalCents>999999999999n || cartItems.some(item=>lineTotals[keyOf(item)]===null || !availableProducts.some(product=>product.id===item.id))
    const cartTotalExact=`${totalCents/100n}.${(totalCents%100n).toString().padStart(2,'0')}`
    const cartTotal=Number(totalCents)/100

    const resolveAvailable = useCallback(
        (product: Product) => (getAvailableQty ? getAvailableQty(product) : Number(product.stock ?? 0)),
        [getAvailableQty]
    )

    // Actions
    const addToCart = useCallback((product: Product,selection?:{presentationId?:string|null;priceContext?:string}) => {
        if(product.unitConfiguration){
            const selected=selectProductUnit(product,selection?.presentationId,selection?.priceContext??priceContext),lineKey=unitCartKey(product.id,selected)
            setCartItems(prev=>{
                const found=prev.find(i=>keyOf(i)===lineKey),qty=stepUnitQuantity(found?.qty??'0',1)
                const candidate={...product,qty,lineKey,unitSelection:selected}
                try{const demand=prev.filter(i=>i.id===product.id&&keyOf(i)!==lineKey).reduce((sum,i)=>addUnitQuantities(sum,i.unitSelection?selectedBaseQuantity(i.qty,i.unitSelection):i.qty),selectedBaseQuantity(qty,selected!))
                    if(product.kind!=='SERVICE'&&compareUnitQuantities(demand,getAvailableQtyExact?.(product)??exactProductValues(product).stock)>0&&!adminAuthorizedProducts.has(product.id)){setAvailabilityDialog({open:true,product:candidate,requestedQty:qty,requestedBaseQty:demand,unitLabel:selected!.snapshot.baseUnit.label,availableStock:getAvailableQtyExact?.(product)??exactProductValues(product).stock});return prev}
                }catch{}
                return found?prev.map(i=>keyOf(i)===lineKey?candidate:i):[...prev,candidate]
            });return
        }
        const unit = getUnitPrice ? getUnitPrice(product) : Number(product.price ?? 0)
        const available = resolveAvailable(product)
        const existing = cartItems.find(i => i.id === product.id)
        const currentQty = Number(existing?.qty || 0)
        const requestedQty = currentQty + 1

        if (product.kind === 'SERVICE' || requestedQty <= available) {
            // La decisión de fusionar se toma con `prev`, no con el `cartItems` del
            // closure: dos llamadas en el mismo tick veían ambas "no está" y metían
            // dos renglones del mismo producto.
            setCartItems(prev => {
                const found = prev.find(i => i.id === product.id)
                if (found) return prev.map(i => i.id === product.id ? { ...i, qty: stepQuantity(i.qty,1) } : i)
                return [...prev, { ...product, price: unit, qty: '1' }]
            })
            return
        }

        // Insufficient stock: ask for additional quantity
        setAvailabilityDialog({ open: true, product, requestedQty, availableStock: available })
        setAdditionalQty('')
    }, [cartItems, getUnitPrice, resolveAvailable,priceContext,getAvailableQtyExact,adminAuthorizedProducts])

    const removeFromCart = useCallback((productId: string) => {
        setCartItems(prev => prev.filter(i => keyOf(i) !== productId))
        setAdminAuthorizedProducts(prev => {
            const newSet = new Set(prev)
            newSet.delete(productId)
            return newSet
        })
    }, [])

    const updateQuantity = useCallback((productId: string, newQty: string | number) => {
        if (String(newQty)==='0') return removeFromCart(productId)

        const selected=cartItems.find(i=>keyOf(i)===productId)
        if(selected?.unitSelection){
            try{const qty=selectedQuantity(String(newQty),selected.unitSelection),base=selectedBaseQuantity(qty,selected.unitSelection)
                const demand=cartItems.filter(i=>i.id===selected.id&&keyOf(i)!==productId).reduce((sum,i)=>addUnitQuantities(sum,i.unitSelection?selectedBaseQuantity(i.qty,i.unitSelection):i.qty),base)
                const current=availableProducts.find(p=>p.id===selected.id)??selected
                if(current.kind!=='SERVICE'&&compareUnitQuantities(demand,getAvailableQtyExact?.(current)??exactProductValues(current).stock)>0&&!adminAuthorizedProducts.has(selected.id)){setAvailabilityDialog({open:true,product:selected,requestedQty:qty,requestedBaseQty:demand,unitLabel:selected.unitSelection.snapshot.baseUnit.label,availableStock:getAvailableQtyExact?.(current)??exactProductValues(current).stock});return}
            }catch{}
            setCartItems(prev=>prev.map(i=>keyOf(i)===productId?{...i,qty:String(newQty)}:i));return
        }
        const prod = availableProducts.find(p => p.id === productId)
        if (!prod) return
        let qty:string
        try {qty=normalize(String(newQty),prod)} catch {
            setCartItems(prev=>prev.map(item=>item.id===productId ? {...item,qty:String(newQty)} : item))
            return
        }

        const available = resolveAvailable(prod)

        if (prod.kind === 'SERVICE' || Number(qty) <= available) {
            setCartItems(prev => prev.map(i => i.id === productId ? { ...i, qty } : i))
            return
        }

        // Insufficient stock
        setAvailabilityDialog({ open: true, product: prod, requestedQty: Number(qty), availableStock: available })
        setAdditionalQty('')
    }, [availableProducts,cartItems,adminAuthorizedProducts,getAvailableQtyExact, removeFromCart, resolveAvailable,normalize])

    const clearCart = useCallback(() => {
        authOwner.operation++
        setIsAuthenticating(false)
        setAvailabilityDialog({open:false,product:null,requestedQty:0,availableStock:0})
        setAdminAuthDialog({open:false,product:null,requestedQty:0})
        setAdminUsername('');setAdminPassword('')
        setCartItems([])
        setAdminAuthorizedProducts(new Set())
    }, [])

    const hydrateFromLines = useCallback(
        (lines: { productId: string; qty: string | number;unitSelection?:UnitSelection;lineKey?:string }[], adminAuthorizedIds: string[]) => {
            const adminSet = new Set(adminAuthorizedIds)
            const missingProductIds: string[] = []
            const qtyAdjustedIds: string[] = []
            const unitReviewIds:string[]=[]
            const built: CartProduct[] = []

            for (const line of lines) {
                const q = String(line.qty)
                const p = availableProducts.find((x) => x.id === line.productId)
                if (!p) {
                    missingProductIds.push(line.productId)
                    continue
                }
                if(line.unitSelection||p.unitConfiguration){
                    const selected=line.unitSelection??{...selectProductUnit(p,null)!,reviewRequired:true}
                    if(selected.revision!==p.unitConfiguration?.unit_revision&&!selected.sourceLineId)selected.reviewRequired=true
                    if(selected.reviewRequired)unitReviewIds.push(p.id)
                    built.push({...p,qty:q,lineKey:line.lineKey??unitCartKey(p.id,selected),unitSelection:selected});continue
                }
                const stock = resolveAvailable(p)
                let qty = q
                if (p.kind !== 'SERVICE' && !adminSet.has(line.productId) && Number(qty) > stock) {
                    qty = String(Math.max(0, stock))
                    if (qty === '0') {
                        missingProductIds.push(line.productId)
                        continue
                    }
                    qtyAdjustedIds.push(line.productId)
                }
                const unit = getUnitPrice ? getUnitPrice(p) : Number(p.price ?? 0)
                built.push({ ...p, price: unit, qty })
            }

            setCartItems(built)
            setAdminAuthorizedProducts(adminSet)
            return { missingProductIds, qtyAdjustedIds,unitReviewIds }
        },
        [availableProducts, getUnitPrice, resolveAvailable]
    )

    // Dialog handlers
    const handleConfirmAdditionalQty = useCallback(() => {
        if(availabilityDialog.requestedBaseQty){
            try{const additional=selectedQuantity(additionalQty,{...((availabilityDialog.product as CartProduct).unitSelection!),snapshot:{...((availabilityDialog.product as CartProduct).unitSelection!.snapshot),presentation:null,factor:'1'}});if(compareUnitQuantities(addUnitQuantities(String(availabilityDialog.availableStock),additional),availabilityDialog.requestedBaseQty)<0)throw Error('La cantidad física no cubre lo solicitado');setAdminAuthDialog({open:true,product:availabilityDialog.product,requestedQty:availabilityDialog.requestedQty});setAvailabilityDialog({open:false,product:null,requestedQty:0,availableStock:0})}catch(error){toast({title:'Revisa la cantidad física',description:(error as Error).message,variant:'destructive'})}return
        }
        const additional = parseInt(additionalQty)

        if (!additional || additional <= 0 || isNaN(additional)) {
            toast({
                title: 'Cantidad inválida',
                description: 'Ingresa una cantidad válida mayor a 0.',
                variant: 'destructive'
            })
            return
        }

        const { product, availableStock } = availabilityDialog
        const totalQty = Number(availableStock) + additional

        setAvailabilityDialog({ open: false, product: null, requestedQty: 0, availableStock: 0 })
        setAdminAuthDialog({ open: true, product, requestedQty: totalQty })
    }, [additionalQty, availabilityDialog, toast])

    const handleCancelAvailability = useCallback(() => {
        setAvailabilityDialog({ open: false, product: null, requestedQty: 0, availableStock: 0 })
        setAdditionalQty('')
        toast({
            title: 'Cancelado',
            description: 'No se agregó el producto.',
            variant: 'default'
        })
    }, [toast])

    const handleAdminAuth = useCallback(async () => {
        if(!isCurrent()||isAuthenticating)return
        if (!adminUsername.trim() || !adminPassword.trim()) {
            toast({
                title: 'Credenciales requeridas',
                description: 'Ingresa usuario y contraseña de administrador.',
                variant: 'destructive'
            })
            return
        }

        setIsAuthenticating(true)
        const operation=++authOwner.operation

        try {
            const response = await fetch(`${getApiBaseUrl()}/auth/validate-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: adminUsername, password: adminPassword })
            })

            const data = await response.json()
            if(!isCurrent()||authOwner.operation!==operation)return

            if (!response.ok || !data.valid) {
                toast({
                    title: 'Credenciales inválidas',
                    description: 'Usuario o contraseña incorrectos.',
                    variant: 'destructive'
                })
                setIsAuthenticating(false)
                return
            }

            const { product, requestedQty } = adminAuthDialog

            if (product) {
                const selected=product as CartProduct
                if(selected.unitSelection){setCartItems(previous=>{const found=previous.some(i=>keyOf(i)===keyOf(selected));const candidate={...selected,qty:String(requestedQty)};return found?previous.map(i=>keyOf(i)===keyOf(selected)?candidate:i):[...previous,candidate]});setAdminAuthorizedProducts(previous=>new Set(previous).add(product.id))}
                else {
                const existing = cartItems.find(i => i.id === product.id)

                if (existing) {
                    setCartItems(prev => prev.map(i =>
                        i.id === product.id ? { ...i, qty: String(requestedQty) } : i
                    ))
                } else {
                    const unit = getUnitPrice ? getUnitPrice(product) : Number(product.price ?? 0)
                    setCartItems(prev => [...prev, { ...product, price: unit, qty: String(requestedQty) }])
                }

                setAdminAuthorizedProducts(prev => new Set(prev).add(product.id))
                }

                toast({
                    title: 'Producto agregado',
                    description: `Se agregó "${product.name}" con autorización de administrador.`,
                    variant: 'default'
                })
            }

            setAdminUsername('')
            setAdminPassword('')
            setAdminAuthDialog({ open: false, product: null, requestedQty: 0 })

        } catch {
            if(!isCurrent()||authOwner.operation!==operation)return
            toast({
                title: 'Error',
                description: 'No se pudo validar las credenciales. Intenta nuevamente.',
                variant: 'destructive'
            })
        } finally {
            if(isCurrent()&&authOwner.operation===operation)setIsAuthenticating(false)
        }
    }, [adminUsername, adminPassword, adminAuthDialog, cartItems, toast, getUnitPrice,isCurrent,isAuthenticating])

    const closeAdminAuthDialog = useCallback(() => {
        setAdminAuthDialog({ open: false, product: null, requestedQty: 0 })
        setAdminUsername('')
        setAdminPassword('')
    }, [])

    const repriceCartLines = useCallback(() => {
        setCartItems((prev) =>
            prev.map((i) => {
                const p = availableProducts.find((x) => x.id === i.id)
                if (!p) return i
                if(i.unitSelection){if(i.unitSelection.sourceLineId||i.unitSelection.reviewRequired)return i;if(i.unitSelection.revision!==p.unitConfiguration?.unit_revision)return{...i,unitSelection:{...i.unitSelection,reviewRequired:true}};const selection=selectProductUnit(p,i.unitSelection.presentationId,priceContext);return{...i,unitSelection:selection,lineKey:unitCartKey(i.id,selection)}}
                return getUnitPrice?{ ...i, price: getUnitPrice(p) }:i
            })
        )
    }, [availableProducts, getUnitPrice,priceContext])

    return {
        cartItems,
        cartTotal,
        cartTotalExact,
        baseQuantities,
        reconcileUnitPreparation:(lineKey,preview)=>{
            const item=cartItems.find(row=>keyOf(row)===lineKey)
            if(!item?.unitSelection)return false
            const reviewed=reconcileUnitPreview(item.unitSelection,item.qty,preview)
            if(reviewed.changed)setCartItems(previous=>previous.map(row=>row===item?{...row,qty:reviewed.quantity,unitSelection:reviewed.selection,lineKey:unitCartKey(row.id,reviewed.selection)}:row))
            return reviewed.changed
        },
        selectCartUnit:(lineKey,presentationId)=>setCartItems(prev=>{
            const item=prev.find(row=>keyOf(row)===lineKey)
            if(!item||item.unitSelection?.sourceLineId)return prev
            try {
                const product=availableProducts.find(p=>p.id===item.id)??item
                const selection=selectProductUnit(product,presentationId,item.unitSelection?.priceContext),nextKey=unitCartKey(item.id,selection)
                if(prev.some(row=>keyOf(row)!==lineKey&&keyOf(row)===nextKey))throw Error('Esta unidad ya está en el carrito. Modifica su cantidad en el renglón existente.')
                const demand=prev.filter(row=>row.id===item.id&&keyOf(row)!==lineKey).reduce((sum,row)=>addUnitQuantities(sum,row.unitSelection?selectedBaseQuantity(row.qty,row.unitSelection):row.qty),selectedBaseQuantity(item.qty,selection!))
                if(product.kind!=='SERVICE'&&compareUnitQuantities(demand,getAvailableQtyExact?.(product)??exactProductValues(product).stock)>0&&!adminAuthorizedProducts.has(item.id))throw Error('La cantidad excede la disponibilidad en unidades base. Revisa la cantidad antes de cambiar de unidad.')
                return prev.map(row=>keyOf(row)===lineKey?{...row,unitSelection:selection,lineKey:nextKey}:row)
            } catch(error) {toast({title:'Revisa la unidad',description:(error as Error).message,variant:'destructive'});return prev}
        }),
        acceptCartRounding:(lineKey,accepted)=>setCartItems(prev=>prev.map(item=>keyOf(item)===lineKey&&item.unitSelection?{...item,unitSelection:{...item.unitSelection,acceptRounding:accepted}}:item)),
        hasInvalidQuantities,
        lineTotals,
        adminAuthorizedProducts,
        availabilityDialog,
        adminAuthDialog,
        additionalQty,
        adminUsername,
        adminPassword,
        isAuthenticating,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        hydrateFromLines,
        repriceCartLines,
        setAdditionalQty,
        setAdminUsername,
        setAdminPassword,
        handleConfirmAdditionalQty,
        handleCancelAvailability,
        handleAdminAuth,
        closeAdminAuthDialog,
    }
}
