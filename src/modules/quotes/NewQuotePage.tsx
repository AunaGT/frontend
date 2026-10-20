/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Nueva cotización — carrito + catálogo con validación de disponible neto.
 */

import { useCallback, useEffect, useState,useRef,useMemo } from "react";
import {useQuery} from '@tanstack/react-query';
import "./quoteLines.css";
import {normalizeQuantityInput,previewLineTotal,stepQuantity} from '@/lib/commercialQuantity'
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
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { CommercialPaymentFields, type CommercialPaymentTerms } from "@/components/shared/CommercialPaymentFields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteProductImage, QuoteSummary, QuoteServiceConditions } from "./QuotePresentation";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { formatMoney } from "@/utils/formatters";
import { postPricingPreview, fetchProductsAvailability } from "@/services/productService";
import { createQuote, updateQuoteStatus, previewQuoteServiceConditions } from "@/services/quoteService";
import { useTenant } from "@/context/useTenant";
import { adaptApiSupplier, fetchSupplierById } from "@/services/supplierService";
import { SavedCustomerMany2One } from "@/modules/sales";
import type { Product } from "@/types/product";
import type { Supplier } from "@/types";
import {UnitLineFields} from '@/components/shared/UnitLineFields'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {selectProductUnit,reconcileUnitPreview,unitCartKey,selectedQuantity,selectedBaseQuantity,selectedLineTotal,selectedUnitPayload,addUnitQuantities,compareUnitQuantities,exactProductValues,stepUnitQuantity,formatUnitDecimal,previewUnitLine,type UnitSelection} from '@/modules/inventory/units/public'
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
  unitSelection?:UnitSelection;
  id: string;
  name: string;
  qty: string;
  price: number;
  product: Product;
};

export default function NewQuotePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = useAuthPermissions();
  const { locale, currencyCode,inventoryUnitsEnabled } = useSystemSettings();
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
  const { branches, branch, company,registerTenantExitGuard } = useTenant();
  const [targetBranchId, setTargetBranchId] = useState(branch?.id ?? "");
  const [manualPriceTier, setManualPriceTier] = useState(false);
  const [selectedPriceTier, setSelectedPriceTier] = useState<QuotePriceTier>("WHOLESALE");
  const [resolvedPriceTier, setResolvedPriceTier] = useState<QuotePriceTier>("WHOLESALE");
  const [pickedCustomer, setPickedCustomer] = useState<Supplier | null>(null);
  const scopeKey=JSON.stringify([company?.id,targetBranchId]),live=useRef(scopeKey);live.current=scopeKey
  const owner=useMemo(()=>({key:scopeKey,active:true,controller:new AbortController()}),[scopeKey])
  const guard=useDraftGuard(cartItems.length>0||!!notes||!!customer,registerTenantExitGuard,scopeKey)
  const providerScope=JSON.stringify([company?.id,branch?.id]),previousScope=useRef(providerScope)
  useEffect(()=>{owner.active=true;if(previousScope.current!==providerScope){previousScope.current=providerScope;setCartItems([]);setPriceMap({});setAvailabilityById({});setCustomer('');setNotes('');setIsSaving(false);setTargetBranchId(branch?.id??'')}return()=>{owner.active=false;owner.controller.abort()}},[owner,providerScope])
  const current=()=>owner.active&&live.current===owner.key
  const requestOptions={signal:owner.controller.signal,headers:{'X-Company-Id':company?.id??'','X-Branch-Id':targetBranchId}}
  const serviceIds=cartItems.filter(line=>line.product.kind==='SERVICE').map(line=>line.id).sort();
  const serviceConditions=useQuery({queryKey:['quote-service-conditions',company?.id,targetBranchId,serviceIds],queryFn:({signal})=>previewQuoteServiceConditions(serviceIds,signal),enabled:canCreate&&!!company?.id&&serviceIds.length>0});

  const salesChannel = "WHOLESALE" as const;
  const customerContactId = pickedCustomerId !== "__none__" ? pickedCustomerId : undefined;
  const effectivePriceTier = manualPriceTier ? selectedPriceTier : resolvedPriceTier;
  const pricingSelectionContext=JSON.stringify([scopeKey,customerContactId,manualPriceTier,selectedPriceTier])
  const livePricingContext=useRef(pricingSelectionContext);livePricingContext.current=pricingSelectionContext
  const pricingReadyContext=useRef<string|null>(null)
  const reviewContextValue=JSON.stringify([scopeKey,cartItems,customer,customerNit,isFinalConsumer,pickedCustomerId,effectivePriceTier,notes,paymentTerms,validUntil])
  const reviewContext=useRef('');reviewContext.current=reviewContextValue

  const getAvailableQty = useCallback(
    (product: Product) => {
      const a = availabilityById[product.id];
      if (a) return a.available;
      return Number(product.stock ?? 0);
    },
    [availabilityById]
  );

  const getCartQty = useCallback(
    (productId: string) => Number(cartItems.find((c) => c.id === productId)?.qty || 0),
    [cartItems]
  );

  const refreshPrices = useCallback(async (pricingLines:CartLine[]=cartItems) => {
    const ids = [...new Set(pricingLines.map((c) => c.product.id))];
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
      },requestOptions);
      if(!current()||livePricingContext.current!==pricingSelectionContext)return
      pricingReadyContext.current=pricingSelectionContext
      const map = res.unit_prices ?? {};
      setPriceMap(map);
      if (!manualPriceTier) {
        setResolvedPriceTier(normalizeQuotePriceTier(res.price_tier_used));
      }
      setCartItems((prev) => {
        const next=prev.map(line=>{
          if(!line.unitSelection)return {...line,price:map[line.product.id]??line.price}
          if(line.unitSelection.sourceLineId)return line
          const selection={...selectProductUnit(line.product,line.unitSelection.presentationId,res.price_tier_used)!,acceptRounding:line.unitSelection.acceptRounding}
          return {...line,unitSelection:selection,id:unitCartKey(line.product.id,selection)}
        })
        if(new Set(next.map(line=>line.id)).size!==next.length){toast({title:'Revisa las unidades',description:'La tarifa combina unidades ya presentes. Quita el renglón duplicado antes de continuar.',variant:'destructive'});return prev}
        return next
      });
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
  }, [cartItems, customerContactId, manualPriceTier, selectedPriceTier, salesChannel, toast,owner]);

  useEffect(() => {
    if (manualPriceTier) {pricingReadyContext.current=pricingSelectionContext;return}
    pricingReadyContext.current=null
    setResolvedPriceTier(resolvePriceTierForCustomer(pickedCustomer, salesChannel));
    void postPricingPreview({
      customer_contact_id: customerContactId,
      sales_channel: salesChannel,
      product_ids: [],
    },requestOptions).then((res) => {
      if(!current()||livePricingContext.current!==pricingSelectionContext)return
      pricingReadyContext.current=pricingSelectionContext
      setResolvedPriceTier(normalizeQuotePriceTier(res.price_tier_used));
    }).catch(() => { /* conservar la tarifa local */ });
  }, [manualPriceTier, pickedCustomer, customerContactId, salesChannel,owner]);

  useEffect(() => {
    void refreshPrices();
  }, [customerContactId, manualPriceTier, selectedPriceTier, resolvedPriceTier,owner]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const ids = [
      ...new Set(cartItems.map((c) => c.product.id)),
    ];
    if (ids.length === 0) {
      setAvailabilityById({});
      return;
    }
    let cancelled = false;
    void fetchProductsAvailability(ids,requestOptions).then((map) => {
      if (!cancelled) setAvailabilityById(map);
    });
    return () => {
      cancelled = true;
    };
  }, [cartItems,owner]);

  const normalizedQty=(line:CartLine)=>line.unitSelection?selectedQuantity(line.qty,line.unitSelection):normalizeQuantityInput(String(line.qty),{kind:line.product.kind ?? 'STANDARD',quantityDecimals:line.product.quantityDecimals ?? 0},locale)
  const lineTotals=Object.fromEntries(cartItems.map(line=>{try{if(line.unitSelection)selectedBaseQuantity(line.qty,line.unitSelection);return[line.id,line.unitSelection?selectedLineTotal(line.qty,line.unitSelection):previewLineTotal(normalizedQty(line),line.price.toFixed(2))]}catch{return[line.id,null]}})) as Record<string,string|null>
  const cartTotal=Number(Object.values(lineTotals).reduce((sum,total)=>sum+(total ? BigInt(total.replace('.','')) : 0n),0n))/100
  const hasInvalidQuantities=Object.values(lineTotals).some(total=>total===null)||cartItems.some(line=>line.unitSelection&&!line.unitSelection.sourceLineId&&(line.unitSelection.reviewRequired||line.unitSelection.priceContext!==effectivePriceTier))

  const stockExceededMessage = (product: Product, available: number) => {
    const a = availabilityById[product.id];
    const reserved = a?.reserved ?? 0;
    const stock = a?.stock ?? Number(product.stock ?? 0);
    return reserved > 0
      ? `Disponible: ${available} (${stock} físico − ${reserved} reservado)`
      : `Disponible: ${available}`;
  };

  const addProduct = (product: Product) => {
    if(inventoryUnitsEnabled&&product.unitConfiguration){
      const selection=selectProductUnit(product,undefined,effectivePriceTier)!,id=unitCartKey(product.id,selection)
      setCartItems(previous=>{const existing=previous.find(line=>line.id===id),qty=stepUnitQuantity(existing?.qty??'0',1);return existing?previous.map(line=>line.id===id?{...line,qty}:line):[...previous,{id,name:product.name,qty,price:product.price,product,unitSelection:selection}]});return
    }
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
    const currentQty = getCartQty(product.id);
    if (product.kind!=='SERVICE' && available <= 0) {
      toast({
        title: "Sin stock disponible",
        description: stockExceededMessage(product, available),
        variant: "destructive",
      });
      return;
    }
    if (product.kind!=='SERVICE' && currentQty + 1 > available) {
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
        return prev.map((x) => (x.id === product.id ? { ...x, qty: stepQuantity(String(x.qty),1) } : x));
      }
      return [...prev, { id: product.id, name: product.name, qty: '1', price: unit, product }];
    });
    void postPricingPreview({
      customer_contact_id: customerContactId,
      sales_channel: salesChannel,
      ...(manualPriceTier ? { price_tier: selectedPriceTier } : {}),
      product_ids: [product.id],
    },requestOptions).then((res) => {
      if(!current())return
      const price = res.unit_prices?.[product.id];
      if (price != null) {
        setPriceMap((m) => ({ ...m, [product.id]: price }));
        setCartItems((prev) =>
          prev.map((x) => (x.id === product.id ? { ...x, price } : x))
        );
      }
    }).catch(() => {if(current())toast({ title: "No se pudo actualizar el precio", description: "Verifica la tarifa antes de guardar.", variant: "destructive" })});
  };

  const selectLineUnit=(key:string,presentationId:string|null)=>setCartItems(rows=>{
    const line=rows.find(row=>row.id===key)
    if(!line?.unitSelection||line.unitSelection.sourceLineId)return rows
    const selection=selectProductUnit(line.product,presentationId,line.unitSelection.priceContext),id=unitCartKey(line.product.id,selection)
    if(rows.some(row=>row.id!==key&&row.id===id)){
      toast({title:'Revisa la unidad',description:'Esta unidad ya está en la cotización. Modifica su cantidad en el renglón existente.',variant:'destructive'});return rows
    }
    return rows.map(row=>row.id===key?{...row,unitSelection:selection,id}:row)
  })
  const updateQty = (productId: string, qty: string) => {
    if (qty==='0') {
      const remaining=cartItems.filter(line=>line.id!==productId)
      setCartItems((prev) => prev.filter((x) => x.id !== productId));
      if(remaining.some(line=>line.unitSelection&&!line.unitSelection.sourceLineId&&line.unitSelection.priceContext!==effectivePriceTier))void refreshPrices(remaining)
      return;
    }
    const product = cartItems.find((line) => line.id === productId)?.product;
    if (!product) return;
    if(cartItems.find(line=>line.id===productId)?.unitSelection){setCartItems(previous=>previous.map(line=>line.id===productId?{...line,qty}:line));return}
    const available = getAvailableQty(product);
    if (product.kind!=='SERVICE' && Number(qty) > available) {
      toast({
        title: "Stock insuficiente",
        description: stockExceededMessage(product, available),
        variant: "destructive",
      });
      if (available <= 0) {
        setCartItems((prev) => prev.filter((x) => x.id !== productId));
        return;
      }
      qty = String(available);
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
    if(isSaving)return
    if(cartItems.some(line=>line.unitSelection)&&pricingReadyContext.current!==pricingSelectionContext){toast({title:'Tarifa pendiente',description:'Espera a que se confirme la tarifa del cliente antes de guardar.',variant:'destructive'});return}
    const reviewed=reviewContextValue
    if(reviewed!==reviewContext.current)return
    if (hasInvalidQuantities) {toast({title:'Revisa las cantidades',description:'Usa la precisión definida para cada artículo.',variant:'destructive'});return}
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
      if(line.unitSelection){if(product.kind==='SERVICE')continue;try{const demand=cartItems.filter(l=>l.product.id===product.id).reduce((sum,l)=>addUnitQuantities(sum,l.unitSelection?selectedBaseQuantity(l.qty,l.unitSelection):l.qty),'0');const available=String(availabilityById[product.id]?.available??exactProductValues(product).stock);if(compareUnitQuantities(demand,available)>0)throw Error(`${line.name}: disponible ${available} ${line.unitSelection.snapshot.baseUnit.label}`)}catch(error){toast({title:'Revisa la cantidad base',description:(error as Error).message,variant:'destructive'});return}continue}
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
      if (product.kind!=='SERVICE' && Number(line.qty) > available) {
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
      const reconciled=[]
      for(const line of cartItems)if(line.unitSelection)reconciled.push({line,...reconcileUnitPreview(line.unitSelection,line.qty,await previewUnitLine({companyId:company!.id,branchId:targetBranchId},line.product.id,{qty:normalizedQty(line),...selectedUnitPayload(line.unitSelection),unit_revision:line.unitSelection.revision,price_tier:effectivePriceTier},owner.controller.signal))})
      if(!current())return
      if(reviewed!==reviewContext.current)throw Error('La cotización cambió durante la revisión. Revisa el importe antes de guardarla.')
      if(reconciled.some(row=>row.changed)){
        setCartItems(rows=>rows.map(row=>{const next=reconciled.find(r=>r.line===row);return next?.changed?{...row,qty:next.quantity,unitSelection:next.selection,id:unitCartKey(row.product.id,next.selection)}:row}))
        throw Error('Se actualizaron cantidades o precios autorizados. Revisa la cotización antes de guardarla.')
      }
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
          product_id: l.product.id,
          qty: normalizedQty(l),
          ...(l.unitSelection?selectedUnitPayload(l.unitSelection):{unit_price:l.price}),
        })),
      },requestOptions);
      if(!current())return
      if (send && canManage) {
        try { await updateQuoteStatus(created.id, "SENT"); }
        catch (e) { toast({ title: "Borrador guardado, no se pudo generar", description: e instanceof Error ? e.message : "Reintenta desde el detalle.", variant: "destructive" }); navigate(`/cotizaciones/${created.id}`); return; }
      }
      toast({ title: send ? "Cotización generada" : "Borrador guardado", description: created.reference ?? created.id });
      guard.proceed(()=>navigate(`/cotizaciones/${created.id}`));
    } catch (e) {
      if(!current())return
      toast({
        title: "Error al guardar",
        description: e instanceof Error ? e.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      if(current())setIsSaving(false);
    }
  };

  return <div className="quotes-page mx-auto w-full max-w-[1560px] space-y-4 p-4 sm:px-8 sm:py-4">
    {guard.dialog}
    <h1 className="sr-only">Nueva cotización</h1>
    <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5 text-brand-orange" />Cliente y condiciones</CardTitle></CardHeader><CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Buscar cliente</Label><SavedCustomerMany2One valueId={pickedCustomerId} linkedDisplayName={customer} onPick={handlePickCustomer} onClear={handleClearCustomer} /></div>
        <div className="space-y-1.5"><Label htmlFor="customer">Nombre del cliente</Label><Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="nit">NIT</Label><Input id="nit" disabled={isFinalConsumer} value={isFinalConsumer ? "CF" : customerNit} onChange={(e) => setCustomerNit(e.target.value)} /></div>
        <div className="flex items-center gap-2 sm:col-span-2"><Checkbox id="cf" checked={isFinalConsumer} onCheckedChange={(v) => setIsFinalConsumer(Boolean(v))} /><Label htmlFor="cf">Consumidor final</Label></div>
        {pickedCustomer && <div className="grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:col-span-2 sm:grid-cols-2"><div><span className="text-muted-foreground">Correo</span><p className="break-all">{pickedCustomer.email || "No registrado"}</p></div><div><span className="text-muted-foreground">Teléfono</span><p>{pickedCustomer.phone || "No registrado"}</p></div></div>}
      </div>
      <div className="space-y-3 border-t border-border/70 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <CommercialPaymentFields customerId={customerContactId} value={paymentTerms} onChange={setPaymentTerms} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="valid">Válida hasta</Label><Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          {branches.length > 1 && <div className="space-y-1.5"><Label htmlFor="quote-branch">Sucursal</Label><Select value={targetBranchId} onValueChange={setTargetBranchId}><SelectTrigger id="quote-branch"><SelectValue /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="flex min-h-11 items-center gap-2"><Checkbox id="manual-tier" checked={manualPriceTier} onCheckedChange={(v) => setManualPriceTier(Boolean(v))} /><Label htmlFor="manual-tier">Elegir tarifa manualmente</Label></span>{manualPriceTier ? <Select value={selectedPriceTier} onValueChange={(v) => setSelectedPriceTier(v as QuotePriceTier)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{QUOTE_PRICE_TIER_ORDER.map((tier) => <SelectItem key={tier} value={tier}>{QUOTE_PRICE_TIER_LABELS[tier]}</SelectItem>)}</SelectContent></Select> : <span className="text-sm text-muted-foreground">Tarifa automática: {QUOTE_PRICE_TIER_SHORT[effectivePriceTier]}</span>}</div>
      </div>
    </CardContent></Card>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="auna-surface min-w-0"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Package className="h-5 w-5 text-brand-orange" />Productos y servicios</CardTitle></CardHeader><CardContent className="space-y-3">
          <ProductPicker companyId={company?.id} branchId={targetBranchId} money={fmt} onPick={addProduct} />
          {!cartItems.length ? <CollectionEmptyState compact title="Dale forma a esta propuesta" description="Busca un producto para agregarlo a la cotización." />
            : <section className="auna-data-table-shell auna-table-embedded quote-lines-scroll" tabIndex={0} role="region" aria-label="Partidas de la cotización"><Table className="auna-data-table min-w-[700px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{cartItems.map((line) => <TableRow key={line.id}>
              <TableCell><div className="flex items-center gap-3"><QuoteProductImage src={line.product.imageUrl} name={line.name} /><div><strong>{line.name}</strong><p className="text-xs text-muted-foreground">{line.product.barcode || 'Sin código'} · {line.product.kind==='SERVICE' ? `${line.product.serviceUnitLabel} · Sin control de existencias` : `Disponible: ${getAvailableQty(line.product)}`}</p>{line.product.kind==='SERVICE'&&<QuoteServiceConditions snapshot={serviceConditions.data?.conditions?.[line.id]}/>}</div></div></TableCell>
              <TableCell><Input type="text" inputMode={line.product.kind==='SERVICE' ? 'decimal' : 'numeric'} className="w-24" aria-label={`Cantidad de ${line.name}`} aria-invalid={lineTotals[line.id]===null} value={line.qty} onChange={event=>updateQty(line.id,event.target.value)} />{line.unitSelection&&<UnitLineFields product={line.product} selection={line.unitSelection} quantity={line.qty} disabled={isSaving} onSelect={id=>selectLineUnit(line.id,id)} onAcceptRounding={accepted=>setCartItems(rows=>rows.map(row=>row.id===line.id?{...row,unitSelection:{...row.unitSelection!,acceptRounding:accepted}}:row))}/>}</TableCell><TableCell className="text-right">{line.unitSelection?`${currencyCode} ${formatUnitDecimal(line.unitSelection.unitPrice,locale)} / ${line.unitSelection.snapshot.presentation?.label??line.unitSelection.snapshot.baseUnit.label}`:fmt(line.price)}</TableCell><TableCell className="text-right font-medium">{lineTotals[line.id] ? fmt(Number(lineTotals[line.id])) : '—'}</TableCell><TableCell><Button variant="ghost" size="icon" aria-label={`Quitar ${line.name}`} onClick={() => updateQty(line.id,'0')}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>)}</TableBody></Table></section>}
        </CardContent></Card>
      <aside className="space-y-4 xl:sticky xl:top-4">
        <QuoteSummary subtotal={cartTotal} total={cartTotal} money={fmt} />
        <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-brand-orange" />Notas</CardTitle></CardHeader><CardContent><Label htmlFor="notes" className="sr-only">Notas adicionales</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones, entrega o información para el cliente…" /></CardContent></Card>
        <div className="space-y-3"><Button variant="outline" className="h-12 w-full" disabled={isSaving || !cartItems.length || hasInvalidQuantities} onClick={() => void handleSave()}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar borrador</Button>{canManage && <Button className="h-12 w-full bg-brand-orange text-white hover:bg-brand-orange/90" disabled={isSaving || !cartItems.length || hasInvalidQuantities} onClick={() => void handleSave(true)}><FileText className="mr-2 h-4 w-4" />Generar cotización</Button>}<Button variant="ghost" className="w-full" disabled={isSaving} onClick={() => navigate("/cotizaciones")}>Cancelar</Button></div>
      </aside>
    </div>
  </div>;
}
