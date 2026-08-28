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
 * Vista de detalle de contacto (proveedor o cliente):
 * - Detalles: datos del contacto.
 * - Proveedor: entradas de mercancía.
 * - Cliente: historial de compras (ventas vinculadas por nombre o ID fiscal).
 */
import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Printer,
  Package,
  User,
  Calendar,
  Edit,
  Receipt,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useSupplier } from '@/hooks/useSupplier'
import { useCustomerSales } from '@/hooks/useCustomerSales'
import { useIncomingMerchandise, useIncomingMerchandiseById } from '@/hooks/useIncomingMerchandise'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { adaptApiSupplier } from '@/services/supplierService'
import type { Supplier, Sale } from '@/types'
import { SaleDetailDialog } from '@/components/sales/components/SaleDetailDialog'
import { normalizeRawSale } from '@/components/sales/hooks/useSalesData'
import { generateSupplierPDF, type SupplierPDFOptions, type SupplierPDFMerchandiseEntry, type CustomerPDFMetrics } from '@/components/suppliers/generateSupplierPDF'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { fetchIncomingMerchandise } from '@/services/incomingMerchandiseService'
import { fetchSalesByCustomerContact } from '@/services/saleService'
import { Pagination } from '@/components/shared/Pagination'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { useUpdateSupplier } from '@/hooks/useUpdateSupplier'
import { useDeleteSupplier } from '@/hooks/useDeleteSupplier'
import type { IncomingMerchandise } from '@/services/incomingMerchandiseService'
import { replaceSupplierPriceRules } from '@/services/supplierService'
import { useCategories } from '@/hooks/useCategories'
import { usePaymentTerms } from '@/hooks/usePaymentTerms'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const getStatusBadge = (status: string | undefined) =>
  status === 'active' ? (
    <Badge className="bg-liquor-gold text-liquor-bronze">Activo</Badge>
  ) : (
    <Badge variant="secondary">Inactivo</Badge>
  )

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { locale, currencyCode, companyName, companyLogoUrl } = useSystemSettings()
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' }).format(value)
  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return dateString
      return new Intl.DateTimeFormat(locale || 'es-GT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d)
    } catch {
      return dateString
    }
  }
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()

  const [merchPage, setMerchPage] = useState(1)
  const [merchPageSize, setMerchPageSize] = useState(10)
  const [salesPage, setSalesPage] = useState(1)
  const [salesPageSize, setSalesPageSize] = useState(10)
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false)
  const [isPdfOptionsOpen, setIsPdfOptionsOpen] = useState(false)
  const [pdfOptions, setPdfOptions] = useState<SupplierPDFOptions>({
    includeBasic: true,
    includeMetrics: true,
    includeProducts: true,
    includeMerchandiseEntries: false,
  })
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const {
    data: rawSupplier,
    isLoading: supplierLoading,
    isError: supplierError,
    refetch: refetchSupplier,
  } = useSupplier(id ?? undefined)
  const supplier: Supplier | null = useMemo(
    () => (rawSupplier ? adaptApiSupplier(rawSupplier) : null),
    [rawSupplier]
  )

  const partyType =
    String((rawSupplier as { party_type?: string })?.party_type ?? 'SUPPLIER') === 'CUSTOMER'
      ? 'CUSTOMER'
      : 'SUPPLIER'
  const isSupplierParty = partyType === 'SUPPLIER'
  const creditLimit = (rawSupplier as { credit_limit?: number | string | null })?.credit_limit

  const canViewMerchandise = hasPermission('merchandise.view')
  const canViewCustomerSales = hasPermission('sales.view')
  const canViewSaleInvoice = hasPermission('sales.view_invoice')
  const canViewSaleDetail = hasPermission('sales.view_detail')
  const { data: merchData, isLoading: merchLoading } = useIncomingMerchandise({
    supplier_id: id ?? undefined,
    page: merchPage,
    pageSize: merchPageSize,
    enabled:
      Boolean(id) &&
      canViewMerchandise &&
      rawSupplier != null &&
      String((rawSupplier as { party_type?: string }).party_type ?? 'SUPPLIER').toUpperCase() ===
        'SUPPLIER',
  })
  const { data: detailData } = useIncomingMerchandiseById(detailRecordId ?? undefined)

  const records: IncomingMerchandise[] = merchData?.items ?? []
  const totalPages = merchData?.totalPages ?? 1
  const canDetails = hasPermission('merchandise.details')
  const showMerchTab = isSupplierParty && canViewMerchandise
  const showSalesHistoryTab = !isSupplierParty && canViewCustomerSales
  const hasSecondaryTab = showMerchTab || showSalesHistoryTab

  const { data: customerSalesData, isLoading: customerSalesLoading } = useCustomerSales(id, {
    page: salesPage,
    pageSize: salesPageSize,
    enabled:
      Boolean(id) &&
      canViewCustomerSales &&
      rawSupplier != null &&
      String((rawSupplier as { party_type?: string }).party_type ?? 'SUPPLIER').toUpperCase() ===
        'CUSTOMER',
  })
  const saleRows = customerSalesData?.items ?? []
  const salesTotalPages = customerSalesData?.totalPages ?? 1
  const customerPurchaseSummary = customerSalesData?.customerPurchaseSummary
  const canEditSupplier =
    partyType === 'CUSTOMER'
      ? hasPermission('contacts.clients.edit')
      : hasPermission('contacts.suppliers.edit')
  const canDeleteSupplier =
    partyType === 'CUSTOMER'
      ? hasPermission('contacts.clients.delete')
      : hasPermission('contacts.suppliers.delete')

  const [defaultPriceTier, setDefaultPriceTier] = useState<'LIST' | 'WHOLESALE' | 'PROMOTION'>('LIST')
  const [priceRuleDraft, setPriceRuleDraft] = useState<
    Array<{ channel: string; price_tier: string; priority: string }>
  >([{ channel: '', price_tier: 'LIST', priority: '0' }])
  const [savingPriceRules, setSavingPriceRules] = useState(false)

  useEffect(() => {
    if (!supplier || partyType !== 'CUSTOMER') return
    const d = supplier.defaultPriceTier
    setDefaultPriceTier(d === 'WHOLESALE' || d === 'PROMOTION' || d === 'LIST' ? d : 'LIST')
    const rules = supplier.customerPriceRules ?? []
    setPriceRuleDraft(
      rules.length > 0
        ? rules.map((r) => ({
            channel: r.channel ?? '',
            price_tier: r.price_tier,
            priority: String(r.priority ?? 0),
          }))
        : [{ channel: '', price_tier: 'LIST', priority: '0' }]
    )
  }, [supplier, partyType])

  const updateSupplierMutation = useUpdateSupplier()
  const { mutateAsync: updateSupplierAsync, isPending: isUpdating } = updateSupplierMutation

  const deleteMutation = useDeleteSupplier()
  const { mutateAsync: deleteSupplierAsync, isPending: deleteIsLoading } = deleteMutation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const { data: categoriesData } = useCategories()
  const { data: paymentTermsData } = usePaymentTerms()

  const categories = useMemo(() => {
    if (!categoriesData) return [] as Array<{ id: number | string; name: string }>
    if (Array.isArray(categoriesData)) {
      return categoriesData as Array<{ id: number | string; name: string }>
    }
    return (categoriesData as { items?: Array<{ id: number | string; name: string }> }).items ?? []
  }, [categoriesData])

  const paymentTerms = useMemo(() => {
    if (Array.isArray(paymentTermsData)) {
      return paymentTermsData
    }
    return paymentTermsData?.items ?? []
  }, [paymentTermsData])

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editContact, setEditContact] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([])
  const [editPaymentTermIds, setEditPaymentTermIds] = useState<string[]>([])
  const [editDefaultPaymentTermId, setEditDefaultPaymentTermId] = useState<string | undefined>(undefined)
  const [paymentTermPopoverOpen, setPaymentTermPopoverOpen] = useState(false)
  const [editEstado, setEditEstado] = useState<number>(1)
  const [editTaxId, setEditTaxId] = useState('')
  const [editCreditLimit, setEditCreditLimit] = useState('')
  const [editEntityKind, setEditEntityKind] = useState<'PERSON' | 'ORGANIZATION'>('ORGANIZATION')

  useEffect(() => {
    if (!supplier) return
    setEditName(supplier.name ?? '')
    setEditContact(supplier.contact ?? '')
    setEditPhone(supplier.phone ?? '')
    setEditEmail(supplier.email ?? '')
    setEditAddress(supplier.address ?? '')
    setEditTaxId(supplier.taxId ?? '')
    setEditCreditLimit(creditLimit == null ? '' : String(creditLimit))
    setEditCategoryIds([])
    const ptList = supplier.paymentTermsList
    if (ptList && ptList.length > 0) {
      setEditPaymentTermIds(ptList.map((x) => String(x.id)))
      const def = ptList.find((x) => x.isDefault) || ptList[0]
      setEditDefaultPaymentTermId(String(def.id))
    } else {
      setEditPaymentTermIds([])
      setEditDefaultPaymentTermId(undefined)
    }
    setEditEstado(supplier.estado !== undefined && supplier.estado !== null ? Number(supplier.estado) : 1)
    setEditEntityKind(supplier.entityKind ?? 'ORGANIZATION')
  }, [supplier, creditLimit])

  useEffect(() => {
    if (editPaymentTermIds.length === 0) {
      setEditDefaultPaymentTermId(undefined)
      return
    }
    setEditDefaultPaymentTermId((prev) => {
      if (prev && editPaymentTermIds.includes(prev)) return prev
      return editPaymentTermIds[0]
    })
  }, [editPaymentTermIds])

  const handleDeleteSupplier = async () => {
    if (!id) return
    try {
      await deleteSupplierAsync(id)
      setIsDeleteDialogOpen(false)
      toast({ title: 'Contacto eliminado', description: 'Se eliminó correctamente.' })
      navigate('/contactos')
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as Error)?.message ?? 'No se pudo eliminar el contacto',
        variant: 'destructive',
      })
    }
  }

  const openMerchandiseDetail = (recordId: string) => {
    if (!canDetails) return
    setDetailRecordId(recordId)
    setIsDetailOpen(true)
  }

  const saleRowClickable = canViewSaleDetail || canViewSaleInvoice
  const openSaleRow = (raw: Sale) => {
    const normalized = normalizeRawSale(raw as unknown)
    if (canViewSaleDetail) {
      setSelectedSale(normalized)
      setIsSaleDetailOpen(true)
    } else if (canViewSaleInvoice) {
      navigate(`/ventas/${normalized.reference ?? normalized.id}/factura`)
    }
  }

  const handleSave = async () => {
    if (!supplier || !id) return
    try {
      if (
        editPaymentTermIds.length === 0 ||
        !editDefaultPaymentTermId ||
        !editPaymentTermIds.includes(editDefaultPaymentTermId)
      ) {
        toast({
          title: 'Términos de pago',
          description: 'Selecciona al menos un término y uno predeterminado',
          variant: 'destructive',
        })
        return
      }
      const payment_terms = editPaymentTermIds.map((tid, i) => ({
        payment_term_id: Number(tid),
        is_default: tid === editDefaultPaymentTermId,
        sort_order: i,
      }))
      await updateSupplierAsync({
        id,
        payload: {
          entity_kind: editEntityKind,
          name: editName,
          contact: editEntityKind === 'PERSON' ? editName : editContact,
          phone: editPhone,
          email: editEmail,
          address: editAddress,
          tax_id: editTaxId.trim() || null,
          ...(partyType === 'CUSTOMER' ? { credit_limit: editCreditLimit.trim() || null } : {}),
          category_ids:
            isSupplierParty && editCategoryIds.length ? editCategoryIds : undefined,
          payment_terms,
          estado: editEstado,
        },
      })
      await refetchSupplier()
      toast({
        title: 'Contacto actualizado',
        description: `Los datos de "${editName}" se guardaron correctamente`,
      })
      setIsEditing(false)
    } catch (e) {
      toast({
        title: 'Error al actualizar',
        description: (e as Error)?.message ?? 'No se pudo actualizar el contacto',
        variant: 'destructive',
      })
    }
  }

  const handleSavePriceRules = async () => {
    if (!id || partyType !== 'CUSTOMER' || !canEditSupplier) return
    setSavingPriceRules(true)
    try {
      await updateSupplierAsync({
        id,
        payload: { default_price_tier: defaultPriceTier },
      })
      await replaceSupplierPriceRules(
        id,
        priceRuleDraft.map((r) => ({
          channel: (r.channel || '') as '' | 'POS' | 'WHOLESALE' | 'ONLINE',
          price_tier: r.price_tier as 'LIST' | 'WHOLESALE' | 'PROMOTION',
          priority: Number(r.priority) || 0,
          active: true,
        }))
      )
      await refetchSupplier()
      toast({
        title: 'Precios guardados',
        description: 'Tarifa por defecto y reglas por canal actualizadas.',
      })
    } catch (e) {
      toast({
        title: 'Error al guardar precios',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
        variant: 'destructive',
      })
    } finally {
      setSavingPriceRules(false)
    }
  }

  if (!id) {
    navigate('/contactos')
    return null
  }

  if (supplierError || (rawSupplier === null && !supplierLoading)) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/contactos')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="mt-6 text-center text-destructive">Contacto no encontrado.</div>
      </div>
    )
  }

  if (supplierLoading || !supplier) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const displayEntityKind: 'PERSON' | 'ORGANIZATION' =
    isEditing && canEditSupplier ? editEntityKind : (supplier.entityKind ?? 'ORGANIZATION')

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contactos')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{supplier.name}</h1>
            <p className="text-sm text-muted-foreground">
              {isSupplierParty ? 'Proveedor' : 'Cliente'} · Detalle del contacto
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {canEditSupplier && !isEditing && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={isUpdating}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
          {canDeleteSupplier && !isEditing && (
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={deleteIsLoading}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          )}
          <Button
            variant="outline"
            className="border-liquor-amber text-liquor-amber hover:bg-liquor-amber/10"
            onClick={() => setIsPdfOptionsOpen(true)}
          >
            <Printer className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{supplier.name}» del listado de contactos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteIsLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteIsLoading}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteSupplier()
              }}
            >
              {deleteIsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando…
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo: qué información incluir en el PDF */}
      <Dialog open={isPdfOptionsOpen} onOpenChange={setIsPdfOptionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contenido del PDF</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seleccione la información que desea incluir en el reporte del{' '}
            {isSupplierParty ? 'proveedor' : 'contacto'}.
          </p>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pdf-basic"
                checked={pdfOptions.includeBasic ?? true}
                onCheckedChange={(checked) =>
                  setPdfOptions((o) => ({ ...o, includeBasic: checked === true }))
                }
              />
              <label
                htmlFor="pdf-basic"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Información básica (datos del contacto, dirección, estado, términos de pago
                {isSupplierParty ? ', categorías' : ''})
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pdf-metrics"
                checked={pdfOptions.includeMetrics ?? true}
                onCheckedChange={(checked) =>
                  setPdfOptions((o) => ({ ...o, includeMetrics: checked === true }))
                }
              />
              <label
                htmlFor="pdf-metrics"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Métricas (total productos, total compras, último pedido)
              </label>
            </div>
            {isSupplierParty && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pdf-products"
                  checked={pdfOptions.includeProducts ?? true}
                  onCheckedChange={(checked) =>
                    setPdfOptions((o) => ({ ...o, includeProducts: checked === true }))
                  }
                />
                <label
                  htmlFor="pdf-products"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Listado de productos que suministra
                </label>
              </div>
            )}
            {isSupplierParty && canViewMerchandise && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pdf-merchandise"
                  checked={pdfOptions.includeMerchandiseEntries ?? false}
                  onCheckedChange={(checked) =>
                    setPdfOptions((o) => ({ ...o, includeMerchandiseEntries: checked === true }))
                  }
                />
                <label
                  htmlFor="pdf-merchandise"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Entradas de mercancía (registros de ingreso asociados)
                </label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPdfOptionsOpen(false)} disabled={isGeneratingPdf}>
              Cancelar
            </Button>
            <Button
              className="border-liquor-amber bg-liquor-amber/10 text-liquor-amber hover:bg-liquor-amber/20"
              disabled={(() => {
                const b = pdfOptions.includeBasic ?? true
                const m = pdfOptions.includeMetrics ?? true
                const p = pdfOptions.includeProducts ?? true
                const me = pdfOptions.includeMerchandiseEntries ?? false
                const anySel =
                  b ||
                  m ||
                  (isSupplierParty && p) ||
                  (isSupplierParty && canViewMerchandise && me)
                return !anySel || isGeneratingPdf
              })()}
              onClick={async () => {
                setIsGeneratingPdf(true)
                try {
                  let merchEntries: SupplierPDFMerchandiseEntry[] | undefined
                  if (
                    isSupplierParty &&
                    pdfOptions.includeMerchandiseEntries &&
                    canViewMerchandise &&
                    id
                  ) {
                    const data = await fetchIncomingMerchandise({
                      supplier_id: id,
                      pageSize: 100,
                      page: 1,
                    })
                    merchEntries = data.items.map((entry) => ({
                      date: entry.date,
                      registeredBy: entry.registeredBy,
                      itemsCount: entry.itemsCount,
                      totalValue: entry.totalValue,
                    }))
                  }
                  let customerMetrics: CustomerPDFMetrics | undefined
                  if (!isSupplierParty && canViewCustomerSales && id) {
                    const salesData =
                      customerPurchaseSummary != null
                        ? {
                            customerPurchaseSummary,
                            totalItems: customerSalesData?.totalItems ?? 0,
                          }
                        : await fetchSalesByCustomerContact(id, { page: 1, pageSize: 1 })
                    const summary = salesData.customerPurchaseSummary
                    customerMetrics = {
                      totalPurchases: summary?.totalPurchases ?? 0,
                      lastSaleDate: summary?.lastSaleDate ?? null,
                      salesCount: salesData.totalItems ?? 0,
                    }
                  }
                  const pdfOptsEffective: SupplierPDFOptions = {
                    ...pdfOptions,
                    includeProducts: isSupplierParty ? (pdfOptions.includeProducts ?? true) : false,
                    includeMerchandiseEntries: isSupplierParty
                      ? (pdfOptions.includeMerchandiseEntries ?? false)
                      : false,
                    companyName,
                    customerMetrics,
                  }
                  const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
                  generateSupplierPDF(supplier, { ...pdfOptsEffective, logoDataUrl }, merchEntries)
                  toast({
                    title: 'PDF Generado',
                    description: `Reporte de "${supplier.name}" descargado correctamente`,
                  })
                  setIsPdfOptionsOpen(false)
                } catch (e) {
                  toast({
                    title: 'Error',
                    description: (e as Error)?.message ?? 'No se pudo generar el PDF',
                    variant: 'destructive',
                  })
                } finally {
                  setIsGeneratingPdf(false)
                }
              }}
            >
              {isGeneratingPdf ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Generando...
                </span>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Generar PDF
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="detalles" className="w-full">
        <TabsList
          className={
            hasSecondaryTab ? 'grid w-full max-w-md grid-cols-2' : 'grid w-full max-w-md grid-cols-1'
          }
        >
          <TabsTrigger value="detalles">Detalles</TabsTrigger>
          {showMerchTab && (
            <TabsTrigger value="entradas">
              Entradas de mercancía
              {merchData?.totalItems != null && merchData.totalItems > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {merchData.totalItems}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {showSalesHistoryTab && (
            <TabsTrigger value="compras">
              Historial de compras
              {customerSalesData?.totalItems != null && customerSalesData.totalItems > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {customerSalesData.totalItems}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="detalles" className="mt-6">
          <Card className={isEditing && canEditSupplier ? 'ring-2 ring-liquor-amber/30' : ''}>
            <CardContent className="pt-6 space-y-6">
              {isEditing && canEditSupplier && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (supplier) {
                          setEditName(supplier.name ?? '')
                          setEditContact(supplier.contact ?? '')
                          setEditPhone(supplier.phone ?? '')
                          setEditEmail(supplier.email ?? '')
                          setEditAddress(supplier.address ?? '')
                          setEditCategoryIds([])
                          const ptList = supplier.paymentTermsList
                          if (ptList && ptList.length > 0) {
                            setEditPaymentTermIds(ptList.map((x) => String(x.id)))
                            const def = ptList.find((x) => x.isDefault) || ptList[0]
                            setEditDefaultPaymentTermId(String(def.id))
                          } else {
                            setEditPaymentTermIds([])
                            setEditDefaultPaymentTermId(undefined)
                          }
                          setEditEstado(supplier.estado !== undefined && supplier.estado !== null ? Number(supplier.estado) : 1)
                          setEditEntityKind(supplier.entityKind ?? 'ORGANIZATION')
                        }
                        setIsEditing(false)
                      }}
                      disabled={isUpdating}
                    >
                      Cancelar cambios
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                    >
                      {isUpdating ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {displayEntityKind === 'PERSON' ? 'Datos del contacto' : 'Datos de la empresa'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">
                      {displayEntityKind === 'PERSON' ? 'Nombre completo' : 'Nombre de la empresa'}
                    </Label>
                    {isEditing && canEditSupplier ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{supplier.name}</p>
                    )}
                  </div>
                  {displayEntityKind === 'ORGANIZATION' && (
                    <div>
                      <Label className="text-muted-foreground">Persona de contacto</Label>
                      {isEditing && canEditSupplier ? (
                        <Input
                          value={editContact}
                          onChange={(e) => setEditContact(e.target.value)}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-foreground font-medium">{supplier.contact}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Teléfono</Label>
                    {isEditing && canEditSupplier ? (
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{supplier.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    {isEditing && canEditSupplier ? (
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{supplier.email}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Naturaleza</Label>
                    {isEditing && canEditSupplier ? (
                      <Select
                        value={editEntityKind}
                        onValueChange={(v) => setEditEntityKind(v === 'PERSON' ? 'PERSON' : 'ORGANIZATION')}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ORGANIZATION">Empresa</SelectItem>
                          <SelectItem value="PERSON">Persona individual</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-foreground font-medium mt-1">
                        {displayEntityKind === 'PERSON' ? 'Persona individual' : 'Empresa'}
                      </p>
                    )}
                  </div>
                  {!isSupplierParty && (
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <p className="text-foreground font-medium mt-1">Cliente</p>
                  </div>
                  )}
                  {isSupplierParty && (
                  <div>
                    <Label className="text-muted-foreground">Categorías</Label>
                    {isEditing && canEditSupplier ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between mt-1"
                          >
                            <span className="truncate text-left">
                              {editCategoryIds.length === 0
                                ? 'Seleccionar categorías'
                                : `${editCategoryIds.length} categoría(s) seleccionada(s)`}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar categoría..." />
                            <CommandList>
                              <CommandEmpty>Sin resultados.</CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="max-h-64">
                                  {categories.map((c) => {
                                    const idStr = String(c.id)
                                    const selected = editCategoryIds.includes(idStr)
                                    return (
                                      <CommandItem
                                        key={idStr}
                                        value={c.name}
                                        onSelect={() => {
                                          setEditCategoryIds((prev) =>
                                            prev.includes(idStr)
                                              ? prev.filter((v) => v !== idStr)
                                              : [...prev, idStr]
                                          )
                                        }}
                                      >
                                        <Check
                                          className={
                                            'mr-2 h-4 w-4 ' + (selected ? 'opacity-100' : 'opacity-0')
                                          }
                                        />
                                        {c.name}
                                      </CommandItem>
                                    )
                                  })}
                                  {categories.length === 0 && (
                                    <div className="px-2 py-3 text-xs text-muted-foreground">
                                      Configura categorías en Datos maestros primero.
                                    </div>
                                  )}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="text-foreground font-medium">
                        {supplier.categoriesLabel || String(supplier.category)}
                      </p>
                    )}
                  </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Estado</Label>
                    {isEditing && canEditSupplier ? (
                      <Select
                        value={String(editEstado)}
                        onValueChange={(v) => setEditEstado(Number(v))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={editEstado === 1 ? 'Activo' : 'Inactivo'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Activo</SelectItem>
                          <SelectItem value="0">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">{getStatusBadge(String(supplier.status))}</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Términos de Pago</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isSupplierParty
                        ? 'Plazo en que se le paga a este proveedor.'
                        : 'Plazo que se le da a este cliente. El predeterminado fija el vencimiento de sus ventas al crédito.'}
                    </p>
                    {isEditing && canEditSupplier ? (
                      <>
                        <Popover open={paymentTermPopoverOpen} onOpenChange={setPaymentTermPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between mt-1"
                            >
                              <span className="truncate text-left">
                                {editPaymentTermIds.length === 0
                                  ? 'Seleccionar términos'
                                  : `${editPaymentTermIds.length} término(s) seleccionado(s)`}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar términos de pago..." />
                              <CommandList>
                                <CommandEmpty>No se encontraron términos.</CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-48">
                                    {(paymentTerms.length > 0
                                      ? paymentTerms
                                      : [
                                          { id: 1, name: '7 días' },
                                          { id: 2, name: '15 días' },
                                          { id: 3, name: '30 días' },
                                          { id: 4, name: '45 días' },
                                        ]
                                    ).map((t: { id: number | string; name: string; net_days?: number | null }) => {
                                      const idStr = String(t.id)
                                      const selected = editPaymentTermIds.includes(idStr)
                                      return (
                                        <CommandItem
                                          key={idStr}
                                          value={t.name}
                                          onSelect={() => {
                                            setEditPaymentTermIds((prev) =>
                                              prev.includes(idStr)
                                                ? prev.filter((v) => v !== idStr)
                                                : [...prev, idStr]
                                            )
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              'mr-2 h-4 w-4',
                                              selected ? 'opacity-100' : 'opacity-0'
                                            )}
                                          />
                                          {t.name}
                                          {/* El nombre puede decir "30 días" y el término no
                                              tener días: ahí no hay vencimiento que calcular. */}
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            {t.net_days != null ? `${t.net_days} d` : 'sin días'}
                                          </span>
                                        </CommandItem>
                                      )
                                    })}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {editPaymentTermIds.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {paymentTerms
                                .filter((t: { id: number | string }) =>
                                  editPaymentTermIds.includes(String(t.id))
                                )
                                .map((t: { id: number | string; name: string; net_days?: number | null }) => (
                                  <Badge key={String(t.id)} variant="secondary" className="text-xs">
                                    {t.name}
                                    {t.net_days != null ? ` · ${t.net_days} d` : ' · sin días'}
                                    {String(t.id) === editDefaultPaymentTermId
                                      ? ' · predeterminado'
                                      : ''}
                                  </Badge>
                                ))}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Predeterminado</Label>
                              <Select
                                value={editDefaultPaymentTermId}
                                onValueChange={setEditDefaultPaymentTermId}
                              >
                                <SelectTrigger className="mt-1 h-9">
                                  <SelectValue placeholder="Elegir" />
                                </SelectTrigger>
                                <SelectContent>
                                  {editPaymentTermIds.map((tid) => {
                                    const t = paymentTerms.find(
                                      (x: { id: number | string }) => String(x.id) === tid
                                    ) as { name: string } | undefined
                                    return (
                                      <SelectItem key={tid} value={tid}>
                                        {t?.name ?? tid}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-foreground font-medium">{supplier.paymentTerms || '—'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">ID fiscal (facturación)</Label>
                    {isEditing && canEditSupplier ? (
                      <Input
                        value={editTaxId}
                        onChange={(e) => setEditTaxId(e.target.value)}
                        placeholder="NIT, VAT, RFC, etc."
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{supplier.taxId || '—'}</p>
                    )}
                  </div>
                  {partyType === 'CUSTOMER' && (
                    <div>
                      <Label className="text-muted-foreground">Límite de crédito</Label>
                      {isEditing && canEditSupplier ? (
                        <>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editCreditLimit}
                            onChange={(e) => setEditCreditLimit(e.target.value)}
                            placeholder="Sin límite"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Vacío = sin límite. 0 = no se le vende al crédito.
                          </p>
                        </>
                      ) : (
                        <p className="text-foreground font-medium">
                          {creditLimit == null
                            ? 'Sin límite'
                            : Number(creditLimit).toLocaleString('es-GT', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>

              <Separator />

              {!isEditing && isSupplierParty && (
                <div className="mt-6 space-y-3">
                  <Label className="text-lg font-medium">Productos que Suministra</Label>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {supplier.productsList && supplier.productsList.length > 0 ? (
                      <div className="space-y-2 p-3">
                        {supplier.productsList.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Stock: {product.stock} unidades
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-sm">
                                Q {Number(product.price).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        No hay productos asociados a este proveedor
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Dirección</p>
                {isEditing && canEditSupplier ? (
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Dirección del proveedor"
                    className="mt-1"
                  />
                ) : (
                  <p className="text-foreground font-medium">{supplier.address || '—'}</p>
                )}
              </div>

              <Separator />

              <div
                className={`grid grid-cols-1 gap-4 pt-2 ${isSupplierParty ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
              >
                {isSupplierParty && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {supplier.productsList?.length ?? supplier.products}
                    </p>
                    <p className="text-sm text-muted-foreground">Productos</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {isSupplierParty || !canViewCustomerSales
                      ? formatCurrency(Number(supplier.totalPurchases))
                      : customerSalesLoading && customerPurchaseSummary == null
                        ? '…'
                        : formatCurrency(customerPurchaseSummary?.totalPurchases ?? 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isSupplierParty ? 'Total Compras' : 'Total comprado'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {isSupplierParty || !canViewCustomerSales
                      ? supplier.lastOrder
                      : customerSalesLoading && customerPurchaseSummary == null
                        ? '…'
                        : customerPurchaseSummary?.lastSaleDate
                          ? formatDate(customerPurchaseSummary.lastSaleDate)
                          : 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isSupplierParty ? 'Último Pedido' : 'Última compra'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {partyType === 'CUSTOMER' && canEditSupplier && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Precios por canal</CardTitle>
                <p className="text-sm text-muted-foreground">
                  La regla con mayor prioridad aplica primero. «Todos los canales» coincide con cualquier venta.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tarifa por defecto</Label>
                  <Select
                    value={defaultPriceTier}
                    onValueChange={(v) => {
                      if (v === 'LIST' || v === 'WHOLESALE' || v === 'PROMOTION') setDefaultPriceTier(v)
                    }}
                  >
                    <SelectTrigger className="mt-1 w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIST">Lista (precio base)</SelectItem>
                      <SelectItem value="WHOLESALE">Mayoreo</SelectItem>
                      <SelectItem value="PROMOTION">Promoción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {priceRuleDraft.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 border border-border rounded-lg p-3">
                    <div className="min-w-[140px] flex-1">
                      <Label className="text-xs">Canal</Label>
                      <Select
                        value={row.channel === '' ? '__all__' : row.channel}
                        onValueChange={(v) => {
                          const ch = v === '__all__' ? '' : v
                          setPriceRuleDraft((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, channel: ch } : x))
                          )
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos</SelectItem>
                          <SelectItem value="POS">Mostrador</SelectItem>
                          <SelectItem value="WHOLESALE">Mayoreo</SelectItem>
                          <SelectItem value="ONLINE">En línea</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[140px] flex-1">
                      <Label className="text-xs">Tarifa</Label>
                      <Select
                        value={row.price_tier}
                        onValueChange={(v) => {
                          if (v !== 'LIST' && v !== 'WHOLESALE' && v !== 'PROMOTION') return
                          setPriceRuleDraft((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, price_tier: v } : x))
                          )
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LIST">Lista</SelectItem>
                          <SelectItem value="WHOLESALE">Mayoreo</SelectItem>
                          <SelectItem value="PROMOTION">Promoción</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Prioridad</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={row.priority}
                        onChange={(e) =>
                          setPriceRuleDraft((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, priority: e.target.value } : x))
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPriceRuleDraft((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={priceRuleDraft.length <= 1}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPriceRuleDraft((p) => [
                        ...p,
                        { channel: 'POS', price_tier: 'WHOLESALE', priority: '10' },
                      ])
                    }
                  >
                    Añadir regla
                  </Button>
                  <Button
                    type="button"
                    className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                    size="sm"
                    disabled={savingPriceRules}
                    onClick={() => void handleSavePriceRules()}
                  >
                    {savingPriceRules ? 'Guardando…' : 'Guardar precios'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {showMerchTab && (
        <TabsContent value="entradas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Entradas de mercancía</CardTitle>
              <p className="text-sm text-muted-foreground">
                Registros de ingreso de productos asociados a este proveedor.
                {canDetails && ' Haz clic en una fila para ver el detalle.'}
              </p>
            </CardHeader>
            <CardContent>
              {merchLoading ? (
                <div className="py-12 text-center text-muted-foreground">Cargando registros...</div>
              ) : records.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No hay entradas de mercancía para este proveedor</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Registrado por</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Productos</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr
                            key={record.id}
                            role={canDetails ? 'button' : undefined}
                            tabIndex={canDetails ? 0 : undefined}
                            className={`border-b hover:bg-muted/50${canDetails ? ' cursor-pointer' : ''}`}
                            onClick={canDetails ? () => openMerchandiseDetail(record.id) : undefined}
                            onKeyDown={(e) => {
                              if (!canDetails) return
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openMerchandiseDetail(record.id)
                              }
                            }}
                          >
                            <td className="p-3 text-sm">{formatDate(record.date)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span>{record.registeredBy.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary">{record.itemsCount} productos</Badge>
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {formatCurrency(record.totalValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Items por página:</span>
                        <Select
                          value={String(merchPageSize)}
                          onValueChange={(v) => { setMerchPageSize(Number(v)); setMerchPage(1); }}
                        >
                          <SelectTrigger className="w-[72px] h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 10, 25, 50, 100].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {totalPages > 1 && (
                        <Pagination
                          currentPage={merchPage}
                          totalPages={totalPages}
                          onPageChange={setMerchPage}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {showSalesHistoryTab && (
          <TabsContent value="compras" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Historial de compras</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ventas donde el cliente coincide con este contacto (por nombre en la venta o por ID
                  fiscal). Si no ves ventas recientes, verifica que en el punto de venta se use el mismo
                  nombre o NIT que en la ficha del cliente.
                  {saleRowClickable &&
                    ' Haz clic en una fila para ver el detalle o la factura, según tus permisos.'}
                </p>
              </CardHeader>
              <CardContent>
                {customerSalesLoading ? (
                  <div className="py-12 text-center text-muted-foreground">Cargando ventas...</div>
                ) : saleRows.length === 0 ? (
                  <div className="py-12 text-center">
                    <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No hay ventas registradas para este cliente</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Referencia</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Ítems</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {saleRows.map((sale) => (
                            <tr
                              key={sale.id}
                              role={saleRowClickable ? 'button' : undefined}
                              tabIndex={saleRowClickable ? 0 : undefined}
                              className={`border-b hover:bg-muted/50${saleRowClickable ? ' cursor-pointer' : ''}`}
                              onClick={saleRowClickable ? () => openSaleRow(sale) : undefined}
                              onKeyDown={(e) => {
                                if (!saleRowClickable) return
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openSaleRow(sale)
                                }
                              }}
                            >
                              <td className="p-3 text-sm">{formatDate(sale.date)}</td>
                              <td className="p-3 text-sm font-medium">{sale.reference ?? sale.id}</td>
                              <td className="p-3 text-right font-semibold">
                                {formatCurrency(Number(sale.adjusted_total ?? sale.total))}
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary">{sale.items}</Badge>
                              </td>
                              <td className="p-3 text-sm">{sale.status?.name ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {salesTotalPages > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Items por página:</span>
                          <Select
                            value={String(salesPageSize)}
                            onValueChange={(v) => {
                              setSalesPageSize(Number(v))
                              setSalesPage(1)
                            }}
                          >
                            <SelectTrigger className="w-[72px] h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 10, 25, 50].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {salesTotalPages > 1 && (
                          <Pagination
                            currentPage={salesPage}
                            totalPages={salesTotalPages}
                            onPageChange={setSalesPage}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del registro de mercancía</DialogTitle>
          </DialogHeader>
          {detailData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Fecha</Label>
                  <p className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(detailData.date)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Registrado por</Label>
                  <p className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4" />
                    {detailData.registeredBy.name}
                  </p>
                </div>
              </div>
              {detailData.notes && (
                <div>
                  <Label className="text-muted-foreground">Notas</Label>
                  <p className="mt-1">{detailData.notes}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Productos</Label>
                <div className="border rounded-lg mt-2 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Producto</th>
                        <th className="text-right p-3 font-medium">Cantidad</th>
                        <th className="text-right p-3 font-medium">Costo unit.</th>
                        <th className="text-right p-3 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.items.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-3">{item.product.name}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">{formatCurrency(item.unit_cost)}</td>
                          <td className="p-3 text-right">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-2">
                  <span className="font-semibold">Total: {formatCurrency(detailData.totalValue)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Cargando detalle...</div>
          )}
        </DialogContent>
      </Dialog>

      <SaleDetailDialog
        open={isSaleDetailOpen}
        onOpenChange={(open) => {
          setIsSaleDetailOpen(open)
          if (!open) setSelectedSale(null)
        }}
        sale={selectedSale}
        locale={locale}
        currencyCode={currencyCode}
      />
    </div>
  )
}
