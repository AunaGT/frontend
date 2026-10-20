import {formatUnitDecimal,formatUnitMoney} from '@/modules/inventory/units/public'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import {useEffect} from 'react'
import {useParams} from 'react-router-dom'
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card'
import {Building2,Calendar,Package,User} from 'lucide-react'
import {Tabs,TabsContent} from '@/components/ui/tabs'
import {ModuleTabsList,ModuleTabsTrigger} from '@/components/shared/ModuleTabs'
import {Pagination} from '@/components/shared/Pagination'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {LoadingIndicator,LoadingState} from '@/components/shared/LoadingState'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useTenant} from '@/context/useTenant'
import {useIncomingMerchandiseById} from '../hooks/useIncomingMerchandise'
import {PaymentStatusBadge} from '../components/PaymentStatusBadge'
import {MerchandisePaymentsPanel} from '../components/MerchandisePaymentsPanel'
import '../merchandise.css'
export default function IncomingMerchandiseDetailPage(){
 const {id}=useParams(),tenant=useTenant(),{currencyCode,locale,timezone}=useSystemSettings(),{page:itemsPage,setPage:setItemsPage,pageSize,setPageSize}=usePersistedListUiState('mercancia/detalle/productos', {defaultPageSize:10})
 const {data:detailData,isLoading,isFetching,isError,error}=useIncomingMerchandiseById(id)
 useEffect(()=>setItemsPage(1),[id,tenant.company?.id,tenant.branch?.id])
 const formatCurrency=(value:number|string)=>new Intl.NumberFormat(locale||'es-GT',{style:'currency',currency:currencyCode||'GTQ'}).format(Number(value))
 const formatDate=(value:string)=>new Date(value).toLocaleString(locale||'es-GT',{timeZone:timezone})
 const formatDateShort=(value:string)=>new Date(value).toLocaleDateString(locale||'es-GT',{timeZone:timezone})
 if(isLoading)return <LoadingState variant="detail" message="Cargando entrada de mercancía…"/>
 if(isError||!detailData)return <p role="alert" className="p-6">{error?.message||'Registro no disponible'}</p>
 const amountPaid=Number(detailData.amount_paid_total||0)+Number(detailData.legacy_settled_amount||0),amountPending=Number(detailData.amount_pending??0),payProgressPct=Number(detailData.totalValue)>0?Math.min(100,amountPaid/Number(detailData.totalValue)*100):0
  const visibleItems = detailData.items.slice((itemsPage - 1) * pageSize, itemsPage * pageSize)
  return <div className="merchandise-page min-h-full bg-brand-surface dark:bg-brand-navy"><div className="mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">

    <h1 className="sr-only">Entrada de mercadería</h1><div className="auna-page-toolbar"><p className="auna-module-description">Registro {detailData.id.slice(0,8).toUpperCase()} · {formatDateShort(detailData.date)}</p>
<PaymentStatusBadge status={detailData.payment_status} /></div>
    {isFetching && <LoadingIndicator message="Actualizando entrada de mercancía…" />}
    <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="text-lg">Información general</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Proveedor</p><p className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-brand-orange" />{detailData.supplier.name}</p><p className="text-sm text-muted-foreground">{[detailData.supplier.contact, detailData.supplier.phone, detailData.supplier.email].filter(Boolean).join(' · ')}</p></div>
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Recepción</p><p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-brand-orange" />{formatDate(detailData.date)}</p><p className="text-sm text-muted-foreground">{detailData.items.length} productos recibidos</p></div>
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Registrado por</p><p className="flex items-center gap-2 font-medium"><User className="h-4 w-4 text-brand-orange" />{detailData.registeredBy.name}</p><p className="text-sm text-muted-foreground">{detailData.registeredBy.email}</p></div>
    </CardContent></Card>
    <Tabs defaultValue="items"><div className="max-w-full overflow-x-auto pb-1"><ModuleTabsList aria-label="Detalles de la entrada"><ModuleTabsTrigger value="items">Partidas ({detailData.items.length})</ModuleTabsTrigger><ModuleTabsTrigger value="payments">Pagos y condiciones</ModuleTabsTrigger></ModuleTabsList></div>
      <TabsContent value="items" className="mt-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-5">
          <><section className="auna-data-table-shell"><h2 className="border-b p-4 font-semibold">Productos recibidos</h2><div className="overflow-x-auto"><table className="w-full min-w-[660px]"><thead><tr><th>Producto</th><th>Código</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th></tr></thead><tbody>{!detailData.items.length && <tr><td colSpan={5}><CollectionEmptyState compact title="Esta entrada no tiene partidas para mostrar" description="Los productos recibidos y sus costos aparecerán aquí cuando estén disponibles en el registro." /></td></tr>}{visibleItems.map(item => <tr key={item.id}><td><div className="flex items-center gap-3">{item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<div><strong className="font-medium">{item.product.name}</strong><small className="block text-muted-foreground">{[item.product.brand,item.product.size].filter(Boolean).join(' · ')}</small></div></div></td><td>{item.product.barcode || '—'}</td><td>{item.quantity} {item.unit_label}{item.unit_metadata_version===2&&<small className="block text-muted-foreground">{item.base_qty} {item.unit_snapshot?.baseUnit.label}</small>}</td><td className="whitespace-nowrap">{item.unit_metadata_version===2?`${currencyCode} ${formatUnitDecimal(String(item.unit_cost),locale)} / ${item.unit_label}`:formatCurrency(Number(item.unit_cost))}</td><td className="whitespace-nowrap font-medium">{formatUnitMoney(String(item.line_total??item.subtotal),locale,currencyCode)}</td></tr>)}</tbody></table></div></section>
<div className="auna-pagination-outside"><Pagination currentPage={itemsPage} totalPages={Math.max(1, Math.ceil(detailData.items.length / pageSize))} onPageChange={setItemsPage} totalItems={detailData.items.length} pageSize={pageSize} onPageSizeChange={setPageSize} count={visibleItems.length} itemLabel="productos" /></div></>
          {detailData.notes && <Card className="auna-surface"><CardHeader className="pb-2"><CardTitle className="text-base">Observaciones</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{detailData.notes}</p></CardContent></Card>}
        </div><aside className="space-y-5">
          <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="text-lg">Resumen de costos</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Productos</span><span>{detailData.items.length}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Partidas recibidas</span><span>{detailData.items.length}</span></div><div className="flex justify-between border-t pt-4 font-bold"><span>Total</span><span className="text-brand-orange">{formatCurrency(detailData.totalValue)}</span></div></CardContent></Card>
          <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="text-lg">Pago al proveedor</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Aplicado (abonos + histórico)</span><span>{formatCurrency(amountPaid)}</span></div><div className="flex justify-between text-sm font-semibold"><span>Saldo pendiente</span><span>{detailData.amount_pending===null?'Por revisar':formatCurrency(amountPending)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Porcentaje pagado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(payProgressPct)}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${payProgressPct}%` }} /></div><p className="text-xs text-muted-foreground">{detailData.payment_term?.name || 'Sin término de pago'}{detailData.due_date ? ` · Vence ${formatDateShort(detailData.due_date)}` : ''}</p></CardContent></Card>
        </aside></div>
      </TabsContent>
      <TabsContent value="payments" className="mt-5"><MerchandisePaymentsPanel key={[tenant.company?.id,tenant.branch?.id,detailData.id,detailData.payment_revision].join(':')} record={detailData}/></TabsContent>
    </Tabs>
  </div></div>
}
