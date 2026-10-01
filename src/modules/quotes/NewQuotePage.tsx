/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Nueva cotización — carrito + catálogo con validación de disponible neto.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, Package, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ProductPicker } from "@/components/shared/ProductPicker";
import { CommercialPaymentFields, type CommercialPaymentTerms } from "@/components/shared/CommercialPaymentFields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteProductImage, QuoteSummary } from "./QuotePresentation";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { formatMoney } from "@/utils/formatters";
import { postPricingPreview, fetchProductsAvailability } from "@/services/productService";
import { createQuote, updateQuoteStatus } from "@/services/quoteService";
import { useTenant } from "@/context/useTenant";
import { adaptApiSupplier, fetchSupplierById } from "@/services/supplierService";
import { SavedCustomerMany2One } from "@/modules/sales";
import type { Product } from "@/types/product";
import type { Supplier } from "@/types";
import {
  type QuotePriceTier,
  QUOTE_PRICE_TIER_LABELS,
  QUOTE_PRICE_TIER_ORDER,
  QUOTE_PRICE_TIER_SHORT,
  normalizeQuotePriceTier,
  productSupportsPriceTier,
  resolvePriceTierForCustomer,
  resolveUnitPriceFromProduct,
  unitPriceForTier,
} from "@/utils/productPricing";

type CartLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
  product: Product;
};

export default function NewQuotePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = useAuthPermissions();
  const { locale, currencyCode } = useSystemSettings();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const canCreate = hasPermission("quotes.create");
  const canManage = hasPermission("quotes.manage");

  const [customer, setCustomer] = useState("");
  const [customerNit, setCustomerNit] = useState("");
  const [isFinalConsumer, setIsFinalConsumer] = useState(true);
  const [pickedCustomerId, setPickedCustomerId] = useState("__none__");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<CommercialPaymentTerms>({ payment_condition: 'CASH', credit_days: null });
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [availabilityById, setAvailabilityById] = useState<
    Record<string, { stock: number; reserved: number; available: number }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const { branches, branch } = useTenant();
  const [targetBranchId, setTargetBranchId] = useState(branch?.id ?? "");
  const [manualPriceTier, setManualPriceTier] = useState(false);
  const [selectedPriceTier, setSelectedPriceTier] = useState<QuotePriceTier>("WHOLESALE");
  const [resolvedPriceTier, setResolvedPriceTier] = useState<QuotePriceTier>("WHOLESALE");
  const [pickedCustomer, setPickedCustomer] = useState<Supplier | null>(null);

  const salesChannel = "WHOLESALE" as const;
  const customerContactId = pickedCustomerId !== "__none__" ? pickedCustomerId : undefined;
  const effectivePriceTier = manualPriceTier ? selectedPriceTier : resolvedPriceTier;

  const getAvailableQty = useCallback(
    (product: Product) => {
      const a = availabilityById[product.id];
      if (a) return a.available;
      return Number(product.stock ?? 0);
    },
    [availabilityById]
  );

  const getCartQty = useCallback(
    (productId: string) => cartItems.find((c) => c.id === productId)?.qty ?? 0,
    [cartItems]
  );

  const refreshPrices = useCallback(async () => {
    const ids = [...new Set(cartItems.map((c) => c.id))];
    if (ids.length === 0) {
      setPriceMap({});
      return;
    }
    try {
      const res = await postPricingPreview({
        customer_contact_id: customerContactId,
        sales_channel: salesChannel,
        product_ids: ids,
        ...(manualPriceTier ? { price_tier: selectedPriceTier } : {}),
      });
      const map = res.unit_prices ?? {};
      setPriceMap(map);
      if (!manualPriceTier) {
        setResolvedPriceTier(normalizeQuotePriceTier(res.price_tier_used));
      }
      setCartItems((prev) =>
        prev.map((line) => ({
          ...line,
          price: map[line.id] ?? line.price,
        }))
      );
      if (manualPriceTier && res.tier_unavailable?.length) {
        const names = res.tier_unavailable.map((x) => x.name).join(", ");
        toast({
          title: "Productos sin esta tarifa",
          description: names,
          variant: "destructive",
        });
      }
    } catch {
      /* mantener precios actuales */
    }
  }, [cartItems, customerContactId, manualPriceTier, selectedPriceTier, salesChannel, toast]);

  useEffect(() => {
    if (manualPriceTier) return;
    setResolvedPriceTier(resolvePriceTierForCustomer(pickedCustomer, salesChannel));
    void postPricingPreview({
      customer_contact_id: customerContactId,
      sales_channel: salesChannel,
      product_ids: [],
    }).then((res) => {
      setResolvedPriceTier(normalizeQuotePriceTier(res.price_tier_used));
    }).catch(() => { /* conservar la tarifa local */ });
  }, [manualPriceTier, pickedCustomer, customerContactId, salesChannel]);

  useEffect(() => {
    void refreshPrices();
  }, [customerContactId, manualPriceTier, selectedPriceTier, resolvedPriceTier]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const ids = [
      ...new Set(cartItems.map((c) => c.id)),
    ];
    if (ids.length === 0) {
      setAvailabilityById({});
      return;
    }
    let cancelled = false;
    void fetchProductsAvailability(ids).then((map) => {
      if (!cancelled) setAvailabilityById(map);
    });
    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  const cartTotal = cartItems.reduce((acc, l) => acc + l.price * l.qty, 0);

  const stockExceededMessage = (product: Product, available: number) => {
    const a = availabilityById[product.id];
    const reserved = a?.reserved ?? 0;
    const stock = a?.stock ?? Number(product.stock ?? 0);
    return reserved > 0
      ? `Disponible: ${available} (${stock} físico − ${reserved} reservado)`
      : `Disponible: ${available}`;
  };

  const addProduct = (product: Product) => {
    if (manualPriceTier) {
      const tierCheck = productSupportsPriceTier(product, selectedPriceTier);
      if (!tierCheck.ok) {
        toast({
          title: "Tarifa no disponible",
          description: `${product.name}: ${tierCheck.message}`,
          variant: "destructive",
        });
        return;
      }
    }

    const available = getAvailableQty(product);
    const current = getCartQty(product.id);
    if (available <= 0) {
      toast({
        title: "Sin stock disponible",
        description: stockExceededMessage(product, available),
        variant: "destructive",
      });
      return;
    }
    if (current + 1 > available) {
      toast({
        title: "Stock insuficiente",
        description: stockExceededMessage(product, available),
        variant: "destructive",
      });
      return;
    }

    const unit =
      priceMap[product.id] ??
      (manualPriceTier
        ? unitPriceForTier(product, selectedPriceTier) ?? Number(product.price || 0)
        : resolveUnitPriceFromProduct(product, effectivePriceTier));
    setCartItems((prev) => {
      const existing = prev.find((x) => x.id === product.id);
      if (existing) {
        return prev.map((x) => (x.id === product.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { id: product.id, name: product.name, qty: 1, price: unit, product }];
    });
    void postPricingPreview({
      customer_contact_id: customerContactId,
      sales_channel: salesChannel,
      ...(manualPriceTier ? { price_tier: selectedPriceTier } : {}),
      product_ids: [product.id],
    }).then((res) => {
      const price = res.unit_prices?.[product.id];
      if (price != null) {
        setPriceMap((m) => ({ ...m, [product.id]: price }));
        setCartItems((prev) =>
          prev.map((x) => (x.id === product.id ? { ...x, price } : x))
        );
      }
    }).catch(() => toast({ title: "No se pudo actualizar el precio", description: "Verifica la tarifa antes de guardar.", variant: "destructive" }));
  };

  const updateQty = (productId: string, qty: number) => {
    if (!Number.isFinite(qty) || !Number.isInteger(qty)) return;
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((x) => x.id !== productId));
      return;
    }
    const product = cartItems.find((line) => line.id === productId)?.product;
    if (!product) return;
    const available = getAvailableQty(product);
    if (qty > available) {
      toast({
        title: "Stock insuficiente",
        description: stockExceededMessage(product, available),
        variant: "destructive",
      });
      if (available <= 0) {
        setCartItems((prev) => prev.filter((x) => x.id !== productId));
        return;
      }
      qty = available;
    }
    setCartItems((prev) => prev.map((x) => (x.id === productId ? { ...x, qty } : x)));
  };

  const handlePickCustomer = (row: Supplier) => {
    setPickedCustomerId(row.id);
    setCustomer(row.name);
    setCustomerNit(row.taxId ?? "");
    setIsFinalConsumer(false);
    setPickedCustomer(row);
    void fetchSupplierById(row.id)
      .then((full) => {
        if (full) setPickedCustomer(adaptApiSupplier(full));
      })
      .catch(() => {
        /* mantener datos del listado */
      });
  };

  const handleClearCustomer = () => {
    setPickedCustomerId("__none__");
    setPickedCustomer(null);
    setCustomer("");
    setCustomerNit("");
    setIsFinalConsumer(true);
  };

  const handleSave = async (send = false) => {
    if (!canCreate) {
      toast({ title: "Sin permiso", variant: "destructive" });
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Agrega al menos un producto", variant: "destructive" });
      return;
    }
    for (const line of cartItems) {
      const product = line.product;
      if (!product) continue;
      if (manualPriceTier) {
        const tierCheck = productSupportsPriceTier(product, selectedPriceTier);
        if (!tierCheck.ok) {
          toast({
            title: "Tarifa no válida en el carrito",
            description: `${line.name}: ${tierCheck.message}`,
            variant: "destructive",
          });
          return;
        }
      }
      const available = getAvailableQty(product);
      if (line.qty > available) {
        toast({
          title: "Stock insuficiente",
          description: `${line.name}: ${stockExceededMessage(product, available)}`,
          variant: "destructive",
        });
        return;
      }
    }
    setIsSaving(true);
    try {
      const created = await createQuote({
        branch_id: targetBranchId || undefined,
        customer: customer.trim() || undefined,
        customer_nit: customerNit.trim() || undefined,
        is_final_consumer: isFinalConsumer,
        customer_contact_id: customerContactId,
        sales_channel: salesChannel,
        ...(manualPriceTier ? { price_tier: selectedPriceTier } : {}),
        ...paymentTerms,
        notes: notes.trim() || undefined,
        valid_until: validUntil ? new Date(validUntil).toISOString() : undefined,
        items: cartItems.map((l) => ({
          product_id: l.id,
          qty: l.qty,
          unit_price: l.price,
        })),
      });
      if (send && canManage) {
        try { await updateQuoteStatus(created.id, "SENT"); }
        catch (e) { toast({ title: "Borrador guardado, no se pudo generar", description: e instanceof Error ? e.message : "Reintenta desde el detalle.", variant: "destructive" }); navigate(`/cotizaciones/${created.id}`); return; }
      }
      toast({ title: send ? "Cotización generada" : "Borrador guardado", description: created.reference ?? created.id });
      navigate(`/cotizaciones/${created.id}`);
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: e instanceof Error ? e.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="quotes-page mx-auto w-full max-w-[1560px] space-y-4 p-4 sm:px-8 sm:py-4">
    <header className="auna-module-heading"><div><Button variant="link" className="mb-1 min-h-11 p-0 text-muted-foreground" onClick={() => navigate("/cotizaciones")}><ArrowLeft className="mr-2 h-4 w-4" />Cotizaciones</Button><p className="auna-module-eyebrow">Ventas</p><h1>Nueva cotización</h1><p className="auna-module-description">Crea una propuesta comercial para tu cliente de forma rápida y sencilla.</p></div></header>
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5 text-brand-orange" />Cliente y condiciones</CardTitle></CardHeader><CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Buscar cliente</Label><SavedCustomerMany2One valueId={pickedCustomerId} linkedDisplayName={customer} onPick={handlePickCustomer} onClear={handleClearCustomer} /></div>
        <div className="space-y-1.5"><Label htmlFor="customer">Nombre del cliente</Label><Input id="customer" className="h-11" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="nit">NIT</Label><Input id="nit" className="h-11" disabled={isFinalConsumer} value={isFinalConsumer ? "CF" : customerNit} onChange={(e) => setCustomerNit(e.target.value)} /></div>
        <div className="flex items-center gap-2 sm:col-span-2"><Checkbox id="cf" checked={isFinalConsumer} onCheckedChange={(v) => setIsFinalConsumer(Boolean(v))} /><Label htmlFor="cf">Consumidor final</Label></div>
        {pickedCustomer && <div className="grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:col-span-2 sm:grid-cols-2"><div><span className="text-muted-foreground">Correo</span><p className="break-all">{pickedCustomer.email || "No registrado"}</p></div><div><span className="text-muted-foreground">Teléfono</span><p>{pickedCustomer.phone || "No registrado"}</p></div></div>}
      </div>
      <div className="space-y-3 border-t border-border/70 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <CommercialPaymentFields customerId={customerContactId} value={paymentTerms} onChange={setPaymentTerms} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="valid">Válida hasta</Label><Input id="valid" className="h-11" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          {branches.length > 1 && <div className="space-y-1.5"><Label htmlFor="quote-branch">Sucursal</Label><Select value={targetBranchId} onValueChange={setTargetBranchId}><SelectTrigger id="quote-branch" className="h-11"><SelectValue /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="flex min-h-11 items-center gap-2"><Checkbox id="manual-tier" checked={manualPriceTier} onCheckedChange={(v) => setManualPriceTier(Boolean(v))} /><Label htmlFor="manual-tier">Elegir tarifa manualmente</Label></span>{manualPriceTier ? <Select value={selectedPriceTier} onValueChange={(v) => setSelectedPriceTier(v as QuotePriceTier)}><SelectTrigger className="h-11 w-48"><SelectValue /></SelectTrigger><SelectContent>{QUOTE_PRICE_TIER_ORDER.map((tier) => <SelectItem key={tier} value={tier}>{QUOTE_PRICE_TIER_LABELS[tier]}</SelectItem>)}</SelectContent></Select> : <span className="text-sm text-muted-foreground">Tarifa automática: {QUOTE_PRICE_TIER_SHORT[effectivePriceTier]}</span>}</div>
      </div>
    </CardContent></Card>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Package className="h-5 w-5 text-brand-orange" />Productos y servicios</CardTitle></CardHeader><CardContent className="space-y-3">
          <ProductPicker branchId={branch?.id} money={fmt} onPick={addProduct} />
          {!cartItems.length ? <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Busca un producto para agregarlo a la cotización.</div>
            : <section className="auna-data-table-shell"><Table className="min-w-[700px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{cartItems.map((line) => <TableRow key={line.id}>
              <TableCell><div className="flex items-center gap-3"><QuoteProductImage src={line.product.imageUrl} name={line.name} /><div><strong>{line.name}</strong><p className="text-xs text-muted-foreground">{line.product.barcode || "Sin código"} · Disponible: {getAvailableQty(line.product)}</p></div></div></TableCell>
              <TableCell><Input type="number" className="w-24" aria-label={`Cantidad de ${line.name}`} min={1} max={getAvailableQty(line.product)} step={1} value={line.qty} onChange={(e) => updateQty(line.id, Number(e.target.value))} /></TableCell><TableCell className="text-right">{fmt(line.price)}</TableCell><TableCell className="text-right font-medium">{fmt(line.price * line.qty)}</TableCell><TableCell><Button variant="ghost" size="icon" aria-label={`Quitar ${line.name}`} onClick={() => updateQty(line.id, 0)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>)}</TableBody></Table></section>}
        </CardContent></Card>
      <aside className="space-y-4 xl:sticky xl:top-4">
        <QuoteSummary subtotal={cartTotal} total={cartTotal} money={fmt} />
        <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-brand-orange" />Notas</CardTitle></CardHeader><CardContent><Label htmlFor="notes" className="sr-only">Notas adicionales</Label><Textarea id="notes" className="min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones, entrega o información para el cliente…" /></CardContent></Card>
        <div className="space-y-3"><Button variant="outline" className="h-12 w-full" disabled={isSaving || !cartItems.length} onClick={() => void handleSave()}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar borrador</Button>{canManage && <Button className="h-12 w-full bg-brand-orange text-white hover:bg-brand-orange/90" disabled={isSaving || !cartItems.length} onClick={() => void handleSave(true)}><FileText className="mr-2 h-4 w-4" />Generar cotización</Button>}<Button variant="ghost" className="w-full" disabled={isSaving} onClick={() => navigate("/cotizaciones")}>Cancelar</Button></div>
      </aside>
    </div>
  </div>;
}
