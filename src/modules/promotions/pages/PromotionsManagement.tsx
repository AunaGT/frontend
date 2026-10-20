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
 * PromotionsManagement - Admin UI for managing discount codes and promotions
 * Supports multiple codes per promotion, auto-generation, PDF export, and product selection
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import {CouponPreview} from '../coupons/CouponPreview'
import {CouponSheetPreview} from '../coupons/CouponSheetPreview'
import {couponData,getCouponPrintLayout,sharedCouponCode,withoutCouponCode} from '../coupons/couponPresentation'
import {createDefaultCouponDesign,parseCouponDesign,couponAssetIds,type CouponDesign} from '../coupons/couponDesign'
import {resolveCouponAssets} from '../coupons/couponAssetsApi'
import type {CouponAssets} from '../coupons/CouponCanvas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useTenant } from '@/context/useTenant'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/services/api'
import { generatePromotionTicketsPDF } from './generatePromotionTicketsPDF'
import { getFriendlyTypeName } from './getFriendlyTypeName'
import { ProductCombobox } from '@/components/shared/ProductCombobox'
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Tag,
    Percent,
    Gift,
    Sparkles,
    TicketPercent,
    Copy,
    Shuffle,
    X,
    FileDown,
    Eye,
    TicketIcon,
    ShoppingCart,
    Package
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

// Types
export interface PromotionType {
    id: number
    name: string
    description: string
}

export interface PromotionCode {
    id: number
    code: string
    current_uses: number
    active: boolean
    created_at: string
}

export interface Promotion {
    company_id?:string
    coupon_design?:CouponDesign|null
    max_uses_per_customer?:number
    id: string
    name: string
    description?: string
    type_id: number
    type: PromotionType
    codes: PromotionCode[]
    discount_value?: string
    discount_percentage?: string
    buy_quantity?: number
    get_quantity?: number
    min_quantity?: number
    trigger_product_id?: string
    target_product_id?: string
    applies_to_all: boolean
    start_date: string
    end_date?: string
    max_uses?: number
    min_purchase_amount?: string
    active: boolean
    applies_to_all_branches?: boolean
    branches?: { branch: { id: string; name: string; code: string } }[]
    usage?: { used: number; capacity: number | null }
}

export interface CodesDialogState {
    open: boolean
    promotion?: Promotion
    companyId?:string
}

// Hooks
function usePromotions() {
    return useQuery({
        queryKey: ['promotions'],
        queryFn: async () => {
            const response = await apiFetch<{ items: Promotion[] }>('/promotions')
            return response.items
        }
    })
}

// Main Component
const PromotionsManagement = () => {
    const navigate = useNavigate()
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { locale, currencyCode, companyLogoUrl, companyName,timezone } = useSystemSettings()
    const { hasPermission } = useAuthPermissions()
    const { branch,company } = useTenant()
    // Con solo promotions.view se consulta; crear/editar/eliminar/activar requiere promotions.manage
    const canManagePromos = hasPermission('promotions.manage')
    const [searchTerm, setSearchTerm] = useState('')
    const [codesDialog, setCodesDialog] = useState<CodesDialogState>({ open: false })

    const { data: promotions = [], isLoading, isFetching, isError, refetch } = usePromotions()

    // Filter promotions
    const filteredPromotions = useMemo(() => {
        if (!searchTerm) return promotions
        const term = searchTerm.toLowerCase()
        return promotions.filter(p =>
            p.codes?.some(c => c.code.toLowerCase().includes(term)) ||
            p.name.toLowerCase().includes(term) ||
            p.type?.name.toLowerCase().includes(term)
        )
    }, [promotions, searchTerm])

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            apiFetch(`/promotions/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promotions'] })
            toast({ title: 'Promoción eliminada' })
        },
        onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
    })

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) =>
            apiFetch(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify({ active }) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promotions'] })
        },
        onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
    })

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code)
        toast({ title: 'Código copiado', description: code })
    }

    const getTypeIcon = (typeName: string) => {
        switch (typeName) {
            case 'PERCENTAGE': return <Percent className='w-4 h-4' />
            case 'FIXED_AMOUNT': return <TicketPercent className='w-4 h-4' />
            case 'BUY_X_GET_Y': return <Sparkles className='w-4 h-4' />
            case 'FREE_GIFT': return <Gift className='w-4 h-4' />
            default: return <Tag className='w-4 h-4' />
        }
    }

    const getTypeBadgeColor = (typeName: string) => {
        switch (typeName) {
            case 'PERCENTAGE': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            case 'FIXED_AMOUNT': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            case 'BUY_X_GET_Y': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
            case 'FREE_GIFT': return 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'
            case 'COMBO_DISCOUNT': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
            case 'MIN_QTY_DISCOUNT': return 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const formatPromoValue = (promo: Promotion) => {
        const typeName = promo.type?.name
        if (typeName === 'PERCENTAGE') return `${promo.discount_percentage}% OFF`
        if (typeName === 'FIXED_AMOUNT') {
            const n = Number(promo.discount_value)
            const formatted = Number.isFinite(n)
                ? new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
                : String(promo.discount_value)
            return `${formatted} OFF`
        }
        if (typeName === 'BUY_X_GET_Y') return `${promo.buy_quantity}x${(promo.buy_quantity || 0) - (promo.get_quantity || 0)}`
        if (typeName === 'MIN_QTY_DISCOUNT') return `${promo.min_quantity}+ = ${promo.discount_percentage}%`
        if (typeName === 'FREE_GIFT') return '🎁 Regalo'
        if (typeName === 'COMBO_DISCOUNT') return '📦 Combo'
        return '-'
    }

    const getTotalUses = (promo: Promotion) => {
        return promo.codes?.reduce((sum, c) => sum + c.current_uses, 0) || 0
    }

    return (
        <div className='p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in'>
            <Card>
                <CardHeader className='p-3 sm:p-6'>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between'>
                        <div>
                            <CardTitle className='flex items-center gap-2 text-lg sm:text-xl'>
                                Promociones
                            </CardTitle>
                            <CardDescription className='text-xs sm:text-sm'>
                                Códigos de descuento que aplican en {branch?.name ?? 'esta sucursal'}. Las
                                limitadas a otras sucursales se ven cambiándote en el selector de arriba.
                            </CardDescription>
                        </div>
                        {canManagePromos && (
                            <Button onClick={() => navigate('/promociones/nueva')} size='sm' className='w-full sm:w-auto'>
                                <Plus className='w-4 h-4 mr-2' />
                                Nueva Promoción
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className='p-3 sm:p-6 pt-0 sm:pt-0'>
                    {/* Search */}
                    <div className='mb-4'>
                        <div className='relative'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                            <Input
                                placeholder='Buscar...'
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className='pl-10'
                            />
                        </div>
                    </div>

                    {/* Table */}
                    {isFetching && !isLoading && <LoadingIndicator message="Actualizando promociones…" className="mb-3" />}
                    {isLoading ? (
                        <LoadingState columns={['Códigos', 'Nombre', 'Tipo', 'Valor', 'Sucursales', 'Usos', 'Estado', 'Acciones']} message="Cargando promociones…" />
                    ) : isError ? (
                        <div role="alert" className="space-y-3 py-8 text-center"><p className="text-destructive">No se pudieron cargar las promociones.</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div>
                    ) : filteredPromotions.length === 0 ? (
                        <CollectionEmptyState title="La próxima buena oferta empieza aquí" description="Crea una promoción para definir descuentos y compartirlos con tus clientes." filtered={Boolean(searchTerm.trim())} onReset={() => setSearchTerm('')} action={canManagePromos && <Button onClick={() => navigate('/promociones/nueva')}><Plus className="mr-2 h-4 w-4" />Nueva promoción</Button>} />
                    ) : (
                        <div className='rounded-md border overflow-hidden'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Códigos</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Sucursales</TableHead>
                                        <TableHead>Usos</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className='text-right'>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPromotions.map(promo => (
                                        <TableRow key={promo.id}>
                                            <TableCell>
                                                <div className='flex flex-wrap gap-1 max-w-[200px]'>
                                                    {promo.codes?.slice(0, 2).map(c => (
                                                        <code key={c.id} className='bg-muted px-1.5 py-0.5 rounded text-xs font-mono'>
                                                            {c.code}
                                                        </code>
                                                    ))}
                                                    {promo.codes?.length > 0 && (
                                                        <Button
                                                            variant='ghost'
                                                            size='sm'
                                                            className='h-6 px-2 text-xs'
                                                            onClick={() => setCodesDialog({ open: true, promotion: promo,companyId:promo.company_id||company?.id })}
                                                        >
                                                            <Eye className='w-3 h-3 mr-1' />
                                                            Ver {promo.codes.length > 2 ? `+${promo.codes.length - 2}` : 'todos'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className='font-medium'>{promo.name}</TableCell>
                                            <TableCell>
                                                <Badge className={`flex items-center gap-1 w-fit ${getTypeBadgeColor(promo.type?.name)}`}>
                                                    {getTypeIcon(promo.type?.name)}
                                                    <span className='text-xs'>{getFriendlyTypeName(promo.type?.name)}</span>
                                                </Badge>
                                            </TableCell>
                                            <TableCell className='font-semibold text-green-600 dark:text-green-400'>
                                                {formatPromoValue(promo)}
                                            </TableCell>
                                            <TableCell>
                                                {promo.applies_to_all_branches === false ? (
                                                    <div className='flex flex-wrap gap-1 max-w-[180px]'>
                                                        {(promo.branches ?? []).map(pb => (
                                                            <Badge key={pb.branch.id} variant='outline' className='text-xs'>
                                                                {pb.branch.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className='text-muted-foreground text-xs'>Todas</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className='text-muted-foreground'>
                                                    {getTotalUses(promo)}{promo.max_uses ? `/${promo.max_uses}` : ''}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={promo.active}
                                                    disabled={!canManagePromos}
                                                    onCheckedChange={(active) =>
                                                        toggleActiveMutation.mutate({ id: promo.id, active })
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className='text-right'>
                                                <div className='flex justify-end gap-1'>
                                                    {canManagePromos && (
                                                    <>
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() => navigate(`/promociones/${promo.id}/editar`)}
                                                    >
                                                        <Pencil className='w-4 h-4' />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant='ghost'
                                                                size='sm'
                                                                className='text-destructive hover:text-destructive'
                                                            >
                                                                <Trash2 className='w-4 h-4' />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent variant="auna">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción no se puede deshacer. Se eliminará la promoción "{promo.name}" y sus códigos asociados.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                                                    onClick={() => deleteMutation.mutate(promo.id)}
                                                                >
                                                                    Eliminar
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                    </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Codes Dialog with PDF Export */}
            <CodesDialog
                dialog={codesDialog}
                setDialog={setCodesDialog}
                onCopyCode={copyCode}
                locale={locale}
                currencyCode={currencyCode}
                companyLogoUrl={companyLogoUrl}
                companyName={companyName}
                timezone={timezone}
            />
        </div>
    )
}

// ============================================
// Codes Dialog with PDF Export
// ============================================
interface CodesDialogProps {
    dialog: CodesDialogState
    setDialog: (state: CodesDialogState) => void
    onCopyCode: (code: string) => void
    locale?: string
    currencyCode?: string
    companyLogoUrl?: string
    companyName?: string
    timezone?:string
}

export const CodesDialog = ({ dialog, setDialog, onCopyCode, locale, currencyCode, companyLogoUrl, companyName,timezone }: CodesDialogProps) => {
    const [selectedCodes, setSelectedCodes] = useState<string[]>([])
    const [design,setDesign]=useState(createDefaultCouponDesign)
    const [assets,setAssets]=useState<CouponAssets>(new Map())
    const [pending,setPending]=useState(false),[error,setError]=useState('')
    // Un código compartido (único y sin límite de usos) se imprime en las copias que se pidan, con o sin el código.
    const [copies,setCopies]=useState(4),[printCode,setPrintCode]=useState(true)
    const {company}=useTenant(),{hasPermission}=useAuthPermissions(),navigate=useNavigate()
    const isScoped=!!company?.id&&dialog.companyId===company.id&&(!dialog.promotion?.company_id||dialog.promotion.company_id===company.id)
    const scopeKey=company?.id+':'+dialog.promotion?.id+':'+dialog.open,scopeRef=useRef(scopeKey),running=useRef(false),controller=useRef<AbortController|null>(null)
    scopeRef.current=scopeKey
    const dialogRef=useRef(dialog);dialogRef.current=dialog
    useEffect(()=>{if(dialog.open&&!isScoped){controller.current?.abort();setDialog({open:false})}},[dialog.open,isScoped,setDialog])
    useEffect(()=>{
        controller.current?.abort();running.current=false;setPending(false);setError('');setAssets(new Map())
        const current=dialogRef.current
        setSelectedCodes(current.open?(current.promotion?.codes||[]).filter(c=>c.active).map(c=>c.code):[])
        setPrintCode(true)
        try{const parsed=parseCouponDesign(current.promotion?.coupon_design??null)||createDefaultCouponDesign(),layout=getCouponPrintLayout(parsed.printPreset,parsed.aspect);setDesign(parsed);setCopies(layout.columns*layout.rows)}catch(e){setError(e instanceof Error?e.message:'Diseño no válido')}
        return()=>{controller.current?.abort()}
    },[scopeKey,dialog.promotion?.coupon_design])
    const promotionId=dialog.promotion?.id
    useEffect(()=>{
        if(!dialog.open||!isScoped||!company?.id||!promotionId)return
        const ids=couponAssetIds(design);if(!ids.length)return
        const abort=new AbortController(),key=scopeKey;setPending(true)
        resolveCouponAssets(ids,{companyId:company.id,promotionId},abort.signal).then(rows=>{if(scopeRef.current===key&&!abort.signal.aborted)setAssets(new Map(rows.map(r=>[r.id,r])))}).catch(e=>{if(!abort.signal.aborted&&scopeRef.current===key)setError(e.message)}).finally(()=>{if(!abort.signal.aborted&&scopeRef.current===key)setPending(false)})
        return()=>abort.abort()
    },[design,scopeKey,company?.id,dialog.open,promotionId,isScoped])

    const promotion = dialog.promotion
    const shared=!!promotion&&sharedCouponCode(promotion),validCopies=Number.isInteger(copies)&&copies>=1&&copies<=200
    const shown=shared&&!printCode?withoutCouponCode(design):design

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedCodes(promotion?.codes?.map(c => c.code) || [])
        } else {
            setSelectedCodes([])
        }
    }

    const handleSelectCode = (code: string, checked: boolean) => {
        if (checked) {
            setSelectedCodes([...selectedCodes, code])
        } else {
            setSelectedCodes(selectedCodes.filter(c => c !== code))
        }
    }

    const handleGeneratePDF = async () => {
        if (!promotion||!isScoped||scopeRef.current!==scopeKey||!company?.id||!selectedCodes.length||pending||running.current||shared&&!validCopies) return
        const selected=promotion.codes?.filter(c=>selectedCodes.includes(c.code))||[]
        const codesToExport=shared?Array.from({length:copies},()=>selected[0]):selected
        const key=scopeKey,abort=new AbortController();controller.current=abort;running.current=true;setPending(true);setError('')
        try{
        const ids=couponAssetIds(design)
        const fresh=ids.length?new Map((await resolveCouponAssets(ids,{companyId:company.id,promotionId:promotion.id},abort.signal)).map(a=>[a.id,a])):assets
        const logoBase64 = await resolvePdfLogoDataUrl(companyLogoUrl)
        if(scopeRef.current!==key||abort.signal.aborted)return
        await generatePromotionTicketsPDF({
            codes: codesToExport,
            promotion: promotion,
            design,assets:fresh,signal:abort.signal,printCode:shared?printCode:true,
            logoBase64,
            locale,
            currencyCode,
            companyName,timezone
        })
        }catch(e){if(!abort.signal.aborted&&scopeRef.current===key)setError(e instanceof Error?e.message:'No se pudo generar el PDF')}
        finally{if(scopeRef.current===key){running.current=false;setPending(false)}}
    }

    return (
        <Dialog open={dialog.open&&isScoped} onOpenChange={(open) => {if(!pending)setDialog({ ...dialog, open })}}>
            <DialogContent variant="auna" className='max-w-3xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <TicketIcon className='w-5 h-5' />
                        Códigos de Promoción
                    </DialogTitle>
                    <DialogDescription>
                        {promotion?.name} - {promotion?.codes?.length || 0} códigos disponibles
                    </DialogDescription>
                </DialogHeader>

                {promotion && (
                    <div className='space-y-4'>
                        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Diseño guardado · {design.printPreset==='large'?'2':'4'} por hoja</span>{hasPermission('promotions.manage')&&<Button variant="outline" disabled={pending} onClick={()=>navigate(`/promociones/${promotion.id}/editar`)}>Editar diseño</Button>}</div>
                        <div className="mx-auto max-w-md"><CouponPreview design={shown} promotion={promotion} code={promotion.codes?.find(c=>selectedCodes.includes(c.code))||promotion.codes?.[0]||{code:'SIN-CÓDIGO'}} branding={{companyName:companyName||'',logoDataUrl:companyLogoUrl,locale:locale||'es-GT',currencyCode:currencyCode||'GTQ',timezone:timezone||'America/Guatemala'}} assets={assets}/></div>
                        {!!selectedCodes.length&&<details><summary className="cursor-pointer text-sm font-medium text-brand-orange">Ver hojas de impresión y cortes</summary><div className="mt-3"><CouponSheetPreview design={shown} data={(shared?Array.from({length:validCopies?copies:1},()=>promotion.codes[0]).filter(c=>selectedCodes.includes(c.code)):(promotion.codes||[]).filter(c=>selectedCodes.includes(c.code))).map(code=>couponData({...promotion,coupon_design:design},code,{companyName:companyName||'',logoDataUrl:companyLogoUrl,locale:locale||'es-GT',currencyCode:currencyCode||'GTQ',timezone:timezone||'America/Guatemala'}))} assets={assets} logoUrl={companyLogoUrl}/></div></details>}
                        {shared&&<div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr] sm:items-end">
                            <Label className="grid gap-1 text-sm">Copias en el PDF<Input type="number" aria-label="Copias en el PDF" min={1} max={200} className="w-28" value={copies||''} disabled={pending} onChange={event=>setCopies(Number(event.target.value))}/></Label>
                            <Label className="flex min-h-10 items-center gap-2 text-sm"><Checkbox aria-label="Imprimir el código en el cupón" checked={printCode} disabled={pending} onCheckedChange={value=>setPrintCode(value===true)}/>Imprimir el código en el cupón</Label>
                            <p className={`text-xs sm:col-span-2 ${validCopies?'text-muted-foreground':'text-red-600 dark:text-red-400'}`}>{!validCopies?'Elige entre 1 y 200 copias.':printCode?'Este código no tiene límite de usos: todas las copias llevan el mismo código.':'Sin el código impreso, el cliente presenta el cupón y en caja se aplica la promoción.'}</p>
                        </div>}
                        {error&&<p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}

                        <div className='border rounded-lg'>
                            <div className='p-3 bg-muted/50 border-b flex items-center justify-between'>
                                <div className='flex items-center gap-2'>
                                    <Checkbox
                                        checked={selectedCodes.length === promotion.codes?.length}
                                        disabled={pending}
                                        onCheckedChange={handleSelectAll}
                                    />
                                    <span className='text-sm font-medium'>Seleccionar todos</span>
                                </div>
                                <Badge variant='secondary'>
                                    {selectedCodes.length} seleccionados
                                </Badge>
                            </div>
                            <div className='max-h-[200px] overflow-y-auto'>
                                <Table>
                                    <TableBody>
                                        {promotion.codes?.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className='w-10'>
                                                    <Checkbox
                                                        checked={selectedCodes.includes(c.code)}
                                                        disabled={pending}
                                                        onCheckedChange={(checked) => handleSelectCode(c.code, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <code className='bg-muted px-2 py-1 rounded font-mono text-sm'>
                                                        {c.code}
                                                    </code>
                                                </TableCell>
                                                <TableCell className='text-muted-foreground text-sm'>
                                                    Usos: {c.current_uses}{promotion.max_uses ? `/${promotion.max_uses}` : ''}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={c.active ? 'default' : 'secondary'}>
                                                        {c.active ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() => onCopyCode(c.code)}
                                                    >
                                                        <Copy className='w-4 h-4' />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant='outline' disabled={pending} onClick={() => setDialog({ ...dialog, open: false })}>
                        Cerrar
                    </Button>
                    <Button onClick={handleGeneratePDF} disabled={selectedCodes.length === 0||pending||!isScoped||shared&&!validCopies}>
                        <FileDown className='w-4 h-4 mr-2' />
                        {pending?'Preparando…':shared?`Descargar PDF (${copies||0} ${copies===1?'copia':'copias'})`:`Descargar PDF (${selectedCodes.length})`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default PromotionsManagement
