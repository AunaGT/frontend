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
 * Vista para crear un nuevo contacto.
 * Conserva todos los atributos del formulario de proveedores.
 */
import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Building2, ChevronsUpDown, Check, CreditCard, FileText, Loader2, Package, Save, ShoppingBag, User, UserRound } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCreateSupplier } from '@/hooks/useCreateSupplier'
import { useCategories } from '@/hooks/useCategories'
import { usePaymentTerms } from '@/hooks/usePaymentTerms'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { ContactImage } from '@/components/shared/ContactImage'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { SUPPLIERS_QUERY_KEY } from '@/hooks/useSuppliers'
import { uploadSupplierImage } from '@/services/supplierService'
import './contactsCreate.css'

export default function SupplierCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const createSupplierMutation = useCreateSupplier()
  const { data: categoriesData } = useCategories()
  const { data: paymentTermsData } = usePaymentTerms()

  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newTaxId, setNewTaxId] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [entityKind, setEntityKind] = useState<'PERSON' | 'ORGANIZATION'>('ORGANIZATION')
  const [partyKind, setPartyKind] = useState<'SUPPLIER' | 'CUSTOMER'>('SUPPLIER')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const canUploadPhoto = hasPermission(partyKind === 'CUSTOMER' ? 'contacts.clients.edit' : 'contacts.suppliers.edit')

  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => { if (!canUploadPhoto) setPhoto(null) }, [canUploadPhoto])
  const [newCategoryIds, setNewCategoryIds] = useState<string[]>([])
  const [newPaymentTermIds, setNewPaymentTermIds] = useState<string[]>([])
  const [newDefaultPaymentTermId, setNewDefaultPaymentTermId] = useState<string | undefined>(undefined)
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [paymentTermPopoverOpen, setPaymentTermPopoverOpen] = useState(false)

  const categories = useMemo(() => {
    if (!categoriesData) return [] as Array<{ id: number | string; name: string }>
    if (Array.isArray(categoriesData)) return categoriesData as Array<{ id: number | string; name: string }>
    return (categoriesData as { items?: Array<{ id: number | string; name: string }> }).items ?? []
  }, [categoriesData])

  const paymentTerms = useMemo(() => {
    if (Array.isArray(paymentTermsData)) return paymentTermsData
    return paymentTermsData?.items ?? []
  }, [paymentTermsData])

  useEffect(() => {
    if (newPaymentTermIds.length === 0) {
      setNewDefaultPaymentTermId(undefined)
      return
    }
    setNewDefaultPaymentTermId((prev) => {
      if (prev && newPaymentTermIds.includes(prev)) return prev
      return newPaymentTermIds[0]
    })
  }, [newPaymentTermIds])

  const handleSubmit = async () => {
    if (createSupplierMutation.isPending || uploadingPhoto) return
    if (!newName?.trim()) {
      toast({
        title: 'Campo requerido',
        description:
          entityKind === 'ORGANIZATION'
            ? 'El nombre o razón social es obligatorio'
            : 'El nombre completo es obligatorio',
        variant: 'destructive',
      })
      return
    }
    if (entityKind === 'ORGANIZATION' && !newContact?.trim()) {
      toast({ title: 'Campo requerido', description: 'La persona de contacto es obligatoria para una empresa', variant: 'destructive' })
      return
    }
    if (!newPhone?.trim()) {
      toast({ title: 'Campo requerido', description: 'El teléfono es obligatorio', variant: 'destructive' })
      return
    }
    if (!newEmail?.trim()) {
      toast({ title: 'Campo requerido', description: 'El email es obligatorio', variant: 'destructive' })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      toast({ title: 'Email inválido', description: 'Por favor ingrese un email válido', variant: 'destructive' })
      return
    }
    if (!newAddress?.trim()) {
      toast({ title: 'Campo requerido', description: 'La dirección es obligatoria', variant: 'destructive' })
      return
    }
    if (partyKind === 'SUPPLIER' && !newCategoryIds.length) {
      toast({ title: 'Campo requerido', description: 'Debes seleccionar al menos una categoría para un proveedor', variant: 'destructive' })
      return
    }
    if (newPaymentTermIds.length === 0) {
      toast({ title: 'Campo requerido', description: 'Selecciona al menos un término de pago', variant: 'destructive' })
      return
    }
    if (!newDefaultPaymentTermId || !newPaymentTermIds.includes(newDefaultPaymentTermId)) {
      toast({ title: 'Término predeterminado', description: 'Indica cuál es el término predeterminado', variant: 'destructive' })
      return
    }

    try {
      const payment_terms = newPaymentTermIds.map((id, i) => ({
        payment_term_id: Number(id),
        is_default: id === newDefaultPaymentTermId,
        sort_order: i,
      }))
      const supplier = await createSupplierMutation.mutateAsync({
        party_type: partyKind,
        entity_kind: entityKind,
        name: newName.trim(),
        contact: entityKind === 'PERSON' ? newName.trim() : newContact.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        address: newAddress.trim(),
        tax_id: newTaxId.trim() || null,
        credit_limit: partyKind === 'CUSTOMER' ? (creditLimit.trim() || null) : undefined,
        category_ids: partyKind === 'SUPPLIER' ? newCategoryIds.map((id) => Number(id)) : undefined,
        payment_terms,
      })
      const id = (supplier as { id?: string })?.id
      if (id && photo && canUploadPhoto) {
        setUploadingPhoto(true)
        try {
          await uploadSupplierImage(id, photo)
          await queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
        } catch (error) {
          toast({ title: 'Contacto creado; foto pendiente', description: error instanceof Error ? error.message : 'Puedes cargarla desde la edición del contacto.', variant: 'destructive' })
          navigate(`/contactos/${id}`)
          return
        } finally { setUploadingPhoto(false) }
      }
      toast({ title: 'Contacto agregado', description: 'El contacto se creó correctamente' })
      if (id) navigate(`/contactos/${id}`)
      else navigate('/contactos')
    } catch (err: unknown) {
      const message = (err && typeof err === 'object' && 'message' in err)
        ? String((err as { message?: unknown }).message) || 'No se pudo crear el proveedor'
        : 'No se pudo crear el contacto'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const isLoading = createSupplierMutation.isPending || uploadingPhoto

  return (
    <div className="contact-create-page mx-auto w-full max-w-[1560px] p-4 sm:p-8">
      <h1 className="sr-only">Nuevo contacto</h1>

      <div className="contact-create-toolbar">
        <div className="contact-create-kind">
          <Label id="party-kind-label">Tipo de relación con el negocio</Label>
          <RadioGroup
            aria-labelledby="party-kind-label"
            aria-describedby="party-kind-help"
            value={partyKind}
            onValueChange={(v) => {
              const next = v === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPLIER'
              setPartyKind(next)
              if (next === 'CUSTOMER') setNewCategoryIds([])
            }}
            className="contact-create-choices"
          >
            <label htmlFor="party-supplier" className="contact-create-choice" data-selected={partyKind === 'SUPPLIER'}>
              <RadioGroupItem value="SUPPLIER" id="party-supplier" />
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              Proveedor
            </label>
            <label htmlFor="party-customer" className="contact-create-choice" data-selected={partyKind === 'CUSTOMER'}>
              <RadioGroupItem value="CUSTOMER" id="party-customer" />
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              Cliente
            </label>
          </RadioGroup>
          <p id="party-kind-help" className="text-xs text-muted-foreground">
            {partyKind === 'SUPPLIER'
              ? 'Suministra productos; requiere al menos una categoría de proveedor.'
              : 'Compra en el punto de venta; sin categorías de proveedor.'}
          </p>
        </div>

        <div className="contact-create-kind">
          <Label id="entity-kind-label">Naturaleza del contacto</Label>
          <RadioGroup
            aria-labelledby="entity-kind-label"
            aria-describedby="entity-kind-help"
            value={entityKind}
            onValueChange={(v) => setEntityKind(v === 'PERSON' ? 'PERSON' : 'ORGANIZATION')}
            className="contact-create-choices"
          >
            <label htmlFor="entity-org" className="contact-create-choice" data-selected={entityKind === 'ORGANIZATION'}>
              <RadioGroupItem value="ORGANIZATION" id="entity-org" />
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              Empresa
            </label>
            <label htmlFor="entity-person" className="contact-create-choice" data-selected={entityKind === 'PERSON'}>
              <RadioGroupItem value="PERSON" id="entity-person" />
              <User className="h-4 w-4 shrink-0" aria-hidden />
              Persona individual
            </label>
          </RadioGroup>
          <p id="entity-kind-help" className="text-xs text-muted-foreground">
            {entityKind === 'ORGANIZATION'
              ? 'Razón social y persona de contacto para pedidos o facturación.'
              : 'Una sola persona; el nombre completo se usa en facturas y comunicación.'}
          </p>
        </div>
      </div>

      <section className="auna-surface contact-create-section" aria-labelledby="contact-identity-title">
        <h2 id="contact-identity-title" className="contact-create-heading">
          <FileText aria-hidden />
          Datos fiscales e identidad
        </h2>
        <div className={cn('contact-create-identity', canUploadPhoto && 'contact-create-identity-with-photo')}>
          <div className="contact-create-fields contact-create-fields-two">
            <div>
              <Label htmlFor="name">
                {entityKind === 'ORGANIZATION' ? 'Nombre de la empresa *' : 'Nombre completo *'}
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={entityKind === 'ORGANIZATION' ? 'Ej: Diageo Guatemala' : 'Nombre y apellidos'}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tax-id">ID fiscal (opcional)</Label>
              <Input
                id="tax-id"
                value={newTaxId}
                onChange={(e) => setNewTaxId(e.target.value)}
                placeholder="Ej. 12345678-9, ESX1234567X"
                aria-describedby="tax-id-help"
                className="mt-1"
              />
              <p id="tax-id-help" className="text-xs text-muted-foreground mt-1">
                Para facturación: NIT, VAT, RFC u otro según el país.
              </p>
            </div>
          </div>
          {canUploadPhoto && (
            <aside className="contact-create-photo" aria-label="Imagen del contacto (opcional)">
              <div className="contact-create-photo-summary">
                <ContactImage src={photoPreview} name={newName || 'Nuevo contacto'} className="h-14 w-14" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Imagen del contacto</p>
                  <p className="text-xs text-muted-foreground">Opcional · JPG, PNG o WebP</p>
                </div>
              </div>
              <details>
                <summary className="contact-create-photo-toggle">
                  {photo ? 'Cambiar o quitar imagen' : 'Añadir imagen'}
                </summary>
                <ImageUploadDropzone onFileSelect={setPhoto} onReject={message => toast({ title: 'Imagen no válida', description: message, variant: 'destructive' })}
                  disabled={isLoading} isUploading={uploadingPhoto} accept="image/jpeg,image/png,image/webp" formatsLabel="JPG, PNG o WebP"
                  selectionLabel={photo?.name} onClearSelection={isLoading ? undefined : () => setPhoto(null)}
                  validateFile={file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'Selecciona una imagen JPG, PNG o WebP.' : null}
                />
              </details>
            </aside>
          )}
        </div>
      </section>

      <section className="auna-surface contact-create-section" aria-labelledby="contact-information-title">
        <h2 id="contact-information-title" className="contact-create-heading">
          <UserRound aria-hidden />
          Contacto y dirección
        </h2>
        <div className="contact-create-fields contact-create-fields-three">
          {entityKind === 'ORGANIZATION' && (
            <div>
              <Label htmlFor="contact">Persona de contacto *</Label>
              <Input
                id="contact"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                placeholder="Nombre de quien atiende pedidos o facturación"
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label htmlFor="phone">Teléfono *</Label>
            <Input
              id="phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+502 2345-6789"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="contacto@empresa.com"
              className="mt-1"
            />
          </div>
          <div className="contact-create-field-wide">
            <Label htmlFor="address">Dirección *</Label>
            <Textarea
              id="address"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="Dirección completa"
              rows={2}
              className="mt-1 resize-y"
            />
          </div>
        </div>
      </section>

      <section className="auna-surface contact-create-section" aria-labelledby="contact-commercial-title">
        <h2 id="contact-commercial-title" className="contact-create-heading">
          <CreditCard aria-hidden />
          Condiciones comerciales y de pago
        </h2>
        <div className="contact-create-fields contact-create-fields-two">
              {partyKind === 'SUPPLIER' && (
              <div>
                <Label htmlFor="categories">Categorías *</Label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button id="categories" variant="outline" role="combobox" aria-expanded={categoryPopoverOpen} className="w-full justify-between mt-1">
                      <span className="truncate text-left">
                        {newCategoryIds.length === 0
                          ? 'Seleccionar categorías'
                          : `${newCategoryIds.length} categoría(s) seleccionada(s)`}
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
                              const id = String(c.id)
                              const selected = newCategoryIds.includes(id)
                              return (
                                <CommandItem
                                  key={id}
                                  value={c.name}
                                  onSelect={() => {
                                    setNewCategoryIds((prev) =>
                                      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
                                    )
                                  }}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
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
                {newCategoryIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {categories
                      .filter((c) => newCategoryIds.includes(String(c.id)))
                      .map((c) => (
                        <Badge key={String(c.id)} variant="secondary" className="text-xs">
                          {c.name}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
              )}
              <div>
                <Label htmlFor="terms">Términos de pago *</Label>
                <Popover open={paymentTermPopoverOpen} onOpenChange={setPaymentTermPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={paymentTermPopoverOpen} className="w-full justify-between mt-1" id="terms">
                      {newPaymentTermIds.length === 0
                        ? 'Seleccionar términos'
                        : `${newPaymentTermIds.length} término(s) seleccionado(s)`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar términos de pago..." />
                      <CommandEmpty>No se encontraron términos.</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          <ScrollArea className="h-48">
                            {(paymentTerms.length > 0
                              ? paymentTerms
                              : [
                                  { id: '1', name: '7 días' },
                                  { id: '2', name: '15 días' },
                                  { id: '3', name: '30 días' },
                                  { id: '4', name: '45 días' },
                                ]
                            ).map((t: { id: number | string; name: string }) => {
                              const idStr = String(t.id)
                              const selected = newPaymentTermIds.includes(idStr)
                              return (
                                <CommandItem
                                  key={idStr}
                                  value={t.name}
                                  onSelect={() => {
                                    setNewPaymentTermIds((prev) =>
                                      prev.includes(idStr) ? prev.filter((v) => v !== idStr) : [...prev, idStr]
                                    )
                                  }}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                                  {t.name}
                                </CommandItem>
                              )
                            })}
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {newPaymentTermIds.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {paymentTerms
                        .filter((t: { id: number | string }) => newPaymentTermIds.includes(String(t.id)))
                        .map((t: { id: number | string; name: string }) => (
                          <Badge key={String(t.id)} variant="secondary" className="text-xs">
                            {t.name}
                            {String(t.id) === newDefaultPaymentTermId ? ' · predeterminado' : ''}
                          </Badge>
                        ))}
                    </div>
                    <div>
                      <Label htmlFor="default-term" className="text-xs text-muted-foreground">Predeterminado</Label>
                      <Select value={newDefaultPaymentTermId} onValueChange={setNewDefaultPaymentTermId}>
                        <SelectTrigger id="default-term" className="mt-1">
                          <SelectValue placeholder="Elegir" />
                        </SelectTrigger>
                        <SelectContent>
                          {newPaymentTermIds.map((tid) => {
                            const t = paymentTerms.find((x: { id: number | string }) => String(x.id) === tid) as
                              | { name: string }
                              | undefined
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
              </div>
              {partyKind === 'CUSTOMER' && (
                <div>
                  <Label htmlFor="credit-limit">Límite de crédito (opcional)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Máximo que puede deber al crédito. Vacío = sin límite; 0 = no se le vende al crédito.
                  </p>
                  <Input
                    id="credit-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="Sin límite"
                    className="mt-1"
                  />
                </div>
              )}
        </div>
      </section>

      <div className="contact-create-actions">
        <p className="text-xs text-muted-foreground">Los campos con * son obligatorios.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/contactos')} disabled={isLoading}>
            Cancelar
          </Button>
          <Button disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden />
                Guardar contacto
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
