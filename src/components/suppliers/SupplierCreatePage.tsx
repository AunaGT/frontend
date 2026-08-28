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
 * Vista para crear un nuevo proveedor. Mismo estilo que detalle/editar.
 * Conserva todos los atributos del formulario de proveedores.
 */
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building2, ChevronsUpDown, Check, Package, ShoppingBag, User } from 'lucide-react'
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

export default function SupplierCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
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
      toast({ title: 'Contacto agregado', description: 'El contacto se creó correctamente' })
      const id = (supplier as { id?: string })?.id
      if (id) navigate(`/contactos/${id}`)
      else navigate('/contactos')
    } catch (err: unknown) {
      const message = (err && typeof err === 'object' && 'message' in err)
        ? String((err as { message?: unknown }).message) || 'No se pudo crear el proveedor'
        : 'No se pudo crear el contacto'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const isLoading = createSupplierMutation.isPending

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contactos')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nuevo contacto</h1>
            <p className="text-sm text-muted-foreground">Alta de proveedor o cliente</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo de relación con el negocio
              </p>
              <RadioGroup
                value={partyKind}
                onValueChange={(v) => {
                  const next = v === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPLIER'
                  setPartyKind(next)
                  if (next === 'CUSTOMER') setNewCategoryIds([])
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <label
                  htmlFor="party-supplier"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors',
                    partyKind === 'SUPPLIER'
                      ? 'border-liquor-amber bg-liquor-amber/10 shadow-sm'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  )}
                >
                  <RadioGroupItem value="SUPPLIER" id="party-supplier" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Package className="h-4 w-4 shrink-0 text-liquor-amber" aria-hidden />
                      Proveedor
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">
                      Suministra productos; requiere al menos una categoría de proveedor.
                    </span>
                  </div>
                </label>
                <label
                  htmlFor="party-customer"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors',
                    partyKind === 'CUSTOMER'
                      ? 'border-liquor-amber bg-liquor-amber/10 shadow-sm'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  )}
                >
                  <RadioGroupItem value="CUSTOMER" id="party-customer" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <ShoppingBag className="h-4 w-4 shrink-0 text-liquor-amber" aria-hidden />
                      Cliente
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">
                      Compra en el punto de venta; sin categorías de proveedor.
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Naturaleza del contacto
              </p>
              <RadioGroup
                value={entityKind}
                onValueChange={(v) => setEntityKind(v === 'PERSON' ? 'PERSON' : 'ORGANIZATION')}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <label
                  htmlFor="entity-org"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors',
                    entityKind === 'ORGANIZATION'
                      ? 'border-liquor-amber bg-liquor-amber/10 shadow-sm'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  )}
                >
                  <RadioGroupItem value="ORGANIZATION" id="entity-org" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Building2 className="h-4 w-4 shrink-0 text-liquor-amber" aria-hidden />
                      Empresa
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">
                      Razón social y persona de contacto para pedidos o facturación.
                    </span>
                  </div>
                </label>
                <label
                  htmlFor="entity-person"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors',
                    entityKind === 'PERSON'
                      ? 'border-liquor-amber bg-liquor-amber/10 shadow-sm'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  )}
                >
                  <RadioGroupItem value="PERSON" id="entity-person" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <User className="h-4 w-4 shrink-0 text-liquor-amber" aria-hidden />
                      Persona individual
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">
                      Una sola persona; el nombre completo se usa en facturas y comunicación.
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
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
            </div>
            <div className="space-y-4">
              {partyKind === 'SUPPLIER' && (
              <div>
                <Label>Categorías *</Label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
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
                <Label>Términos de pago *</Label>
                <Popover open={paymentTermPopoverOpen} onOpenChange={setPaymentTermPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between mt-1" id="terms">
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
                      <Label className="text-xs text-muted-foreground">Predeterminado</Label>
                      <Select value={newDefaultPaymentTermId} onValueChange={setNewDefaultPaymentTermId}>
                        <SelectTrigger className="mt-1 h-9">
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
              <div>
                <Label htmlFor="address">Dirección *</Label>
                <Textarea
                  id="address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Dirección completa"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="tax-id">ID fiscal (opcional)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Para facturación: NIT, VAT, RFC u otro según el país.
                </p>
                <Input
                  id="tax-id"
                  value={newTaxId}
                  onChange={(e) => setNewTaxId(e.target.value)}
                  placeholder="Ej. 12345678-9, ESX1234567X"
                  className="mt-1"
                />
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
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => navigate('/contactos')} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
              disabled={isLoading}
              onClick={handleSubmit}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4 mr-2" />
                  Guardar contacto
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
