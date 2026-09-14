/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Nueva cotización — carrito + catálogo con validación de disponible neto.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
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
import { useAllProducts } from "@/hooks/useProducts";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { formatMoney } from "@/utils/formatters";
import { postPricingPreview, fetchProductsAvailability } from "@/services/productService";
import { createQuote } from "@/services/quoteService";
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
  catalogPriceForProduct,
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
};

export default function NewQuotePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = useAuthPermissions();
  const { locale, currencyCode } = useSystemSettings();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const canCreate = hasPermission("quotes.create");
  const { data: products = [], isLoading: loadingProducts } = useAllProducts({ forSaleOnly: true, inBranchOnly: true });

  const [customer, setCustomer] = useState("");
  const [customerNit, setCustomerNit] = useState("");
  const [isFinalConsumer, setIsFinalConsumer] = useState(true);
  const [pickedCustomerId, setPickedCustomerId] = useState("__none__");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [productSearch, setProductSearch] = useState("");
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
    });
  }, [manualPriceTier, pickedCustomer, customerContactId, salesChannel]);

  useEffect(() => {
    void refreshPrices();
  }, [customerContactId, manualPriceTier, selectedPriceTier, resolvedPriceTier]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [products, productSearch]);

  useEffect(() => {
    const ids = [
      ...new Set([...filteredProducts.map((p) => p.id), ...cartItems.map((c) => c.id)]),
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
  }, [filteredProducts, cartItems]);

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
      return [...prev, { id: product.id, name: product.name, qty: 1, price: unit }];
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
    });
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((x) => x.id !== productId));
      return;
    }
    const product = products.find((p) => p.id === productId);
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

  const handleSave = async () => {
    if (!canCreate) {
      toast({ title: "Sin permiso", variant: "destructive" });
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Agrega al menos un producto", variant: "destructive" });
      return;
    }
    for (const line of cartItems) {
      const product = products.find((p) => p.id === line.id);
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
        notes: notes.trim() || undefined,
        valid_until: validUntil ? new Date(validUntil).toISOString() : undefined,
        items: cartItems.map((l) => ({
          product_id: l.id,
          qty: l.qty,
          unit_price: l.price,
        })),
      });
      toast({ title: "Cotización guardada", description: created.reference ?? created.id });
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

  return (
    <div className="p-3 sm:p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">Nueva cotización</h1>
          <p className="text-sm text-muted-foreground">
            Canal mayoreo ·{" "}
            {manualPriceTier
              ? `tarifa manual: ${QUOTE_PRICE_TIER_SHORT[selectedPriceTier]}`
              : `tarifa automática: ${QUOTE_PRICE_TIER_SHORT[effectivePriceTier]}`}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente y condiciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SavedCustomerMany2One
              valueId={pickedCustomerId}
              linkedDisplayName={customer}
              onPick={handlePickCustomer}
              onClear={handleClearCustomer}
            />
            <div className="space-y-2">
              <Label htmlFor="customer">Nombre cliente</Label>
              <Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cf"
                checked={isFinalConsumer}
                onCheckedChange={(v) => setIsFinalConsumer(Boolean(v))}
              />
              <Label htmlFor="cf">Consumidor final</Label>
            </div>
            {!isFinalConsumer && (
              <div className="space-y-2">
                <Label htmlFor="nit">NIT</Label>
                <Input id="nit" value={customerNit} onChange={(e) => setCustomerNit(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="valid">Válida hasta</Label>
              <Input
                id="valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {branches.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="quote-branch">Sucursal</Label>
                <Select value={targetBranchId} onValueChange={setTargetBranchId}>
                  <SelectTrigger id="quote-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  El catálogo y el stock que ves son los de {branch?.name ?? "la sucursal activa"}.
                </p>
              </div>
            )}
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="manual-tier"
                  checked={manualPriceTier}
                  onCheckedChange={(v) => setManualPriceTier(Boolean(v))}
                />
                <Label htmlFor="manual-tier">Elegir tarifa de precio manualmente</Label>
              </div>
              {manualPriceTier ? (
                <div className="space-y-2">
                  <Label htmlFor="price-tier">Tarifa</Label>
                  <Select
                    value={selectedPriceTier}
                    onValueChange={(v) => setSelectedPriceTier(v as QuotePriceTier)}
                  >
                    <SelectTrigger id="price-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTE_PRICE_TIER_ORDER.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {QUOTE_PRICE_TIER_LABELS[tier]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Se usa la tarifa del cliente y canal ({QUOTE_PRICE_TIER_SHORT[effectivePriceTier]}).
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos ({cartItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cartItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Agrega productos desde el catálogo.</p>
            )}
            {cartItems.map((line) => {
              const product = products.find((p) => p.id === line.id);
              const available = product ? getAvailableQty(product) : 0;
              const atMax = line.qty >= available;
              return (
              <div key={line.id} className="flex items-center gap-2 border rounded-md p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(line.price)} c/u · disp. {available}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(line.id, line.qty - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm">{line.qty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={atMax}
                    onClick={() => updateQty(line.id, line.qty + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(line.id, 0)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
            })}
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Total</span>
              <span>{fmt(cartTotal)}</span>
            </div>
            <Button className="w-full" disabled={isSaving || cartItems.length === 0} onClick={() => void handleSave()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar borrador
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar producto…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          {loadingProducts && <p className="text-sm text-muted-foreground">Cargando productos…</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto">
            {filteredProducts.map((p) => {
              const available = getAvailableQty(p);
              const inCart = getCartQty(p.id);
              const tierOk = manualPriceTier
                ? productSupportsPriceTier(p, selectedPriceTier).ok
                : true;
              const canAdd = tierOk && inCart < available;
              const displayPrice = fmt(catalogPriceForProduct(p, effectivePriceTier, priceMap));
              return (
              <button
                key={p.id}
                type="button"
                disabled={!canAdd}
                className="text-left border rounded-md p-3 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                onClick={() => addProduct(p)}
              >
                <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {displayPrice} · disp. {available}
                  {!tierOk && manualPriceTier ? " · sin tarifa" : ""}
                </p>
              </button>
            );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
