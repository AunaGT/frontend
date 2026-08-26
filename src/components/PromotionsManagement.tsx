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
import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import { Badge } from './ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from './ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from './ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from './ui/table'
import { Checkbox } from './ui/checkbox'
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
} from './ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useTenant } from '@/context/useTenant'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/services/api'
import { generatePromotionTicketsPDF } from './promotions/generatePromotionTicketsPDF'
import { getFriendlyTypeName } from './promotions/getFriendlyTypeName'
import { ProductCombobox } from './promotions/ProductCombobox'
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
    Loader2,
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
interface PromotionType {
    id: number
    name: string
    description: string
}

interface PromotionCode {
    id: number
    code: string
    current_uses: number
    active: boolean
    created_at: string
}

interface Promotion {
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
}

interface CodesDialogState {
    open: boolean
    promotion?: Promotion
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
    const { locale, currencyCode, companyLogoUrl } = useSystemSettings()
    const { hasPermission } = useAuthPermissions()
    const { branch } = useTenant()
    // Con solo promotions.view se consulta; crear/editar/eliminar/activar requiere promotions.manage
    const canManagePromos = hasPermission('promotions.manage')
    const [searchTerm, setSearchTerm] = useState('')
    const [codesDialog, setCodesDialog] = useState<CodesDialogState>({ open: false })

    const { data: promotions = [], isLoading } = usePromotions()

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
                    {isLoading ? (
                        <div className='flex justify-center py-8'>
                            <Loader2 className='w-6 h-6 animate-spin text-muted-foreground' />
                        </div>
                    ) : filteredPromotions.length === 0 ? (
                        <div className='text-center py-8 text-muted-foreground'>
                            {searchTerm ? 'No se encontraron promociones' : 'No hay promociones creadas'}
                        </div>
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
                                                            onClick={() => setCodesDialog({ open: true, promotion: promo })}
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
                                                        <AlertDialogContent>
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
}

const CodesDialog = ({ dialog, setDialog, onCopyCode, locale, currencyCode, companyLogoUrl }: CodesDialogProps) => {
    const [selectedCodes, setSelectedCodes] = useState<string[]>([])
    const [termsText, setTermsText] = useState('Válido solo en tiendas participantes. No acumulable con otras promociones.')

    const promotion = dialog.promotion

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
        if (!promotion) return

        const codesToExport = selectedCodes.length > 0
            ? promotion.codes?.filter(c => selectedCodes.includes(c.code)) || []
            : promotion.codes || []

        const logoBase64 = await resolvePdfLogoDataUrl(companyLogoUrl)

        generatePromotionTicketsPDF({
            codes: codesToExport,
            promotion: promotion,
            terms: termsText,
            logoBase64,
            locale,
            currencyCode
        })
    }

    return (
        <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ ...dialog, open })}>
            <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
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
                        <div>
                            <Label htmlFor='terms'>Términos y Condiciones (para el PDF)</Label>
                            <Textarea
                                id='terms'
                                value={termsText}
                                onChange={e => setTermsText(e.target.value)}
                                rows={2}
                                className='text-sm'
                            />
                        </div>

                        <div className='border rounded-lg'>
                            <div className='p-3 bg-muted/50 border-b flex items-center justify-between'>
                                <div className='flex items-center gap-2'>
                                    <Checkbox
                                        checked={selectedCodes.length === promotion.codes?.length}
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
                    <Button variant='outline' onClick={() => setDialog({ ...dialog, open: false })}>
                        Cerrar
                    </Button>
                    <Button onClick={handleGeneratePDF} disabled={selectedCodes.length === 0}>
                        <FileDown className='w-4 h-4 mr-2' />
                        Descargar PDF ({selectedCodes.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default PromotionsManagement
