import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {ScannerField} from '@/components/shared/ScannerField'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useModules} from '@/context/useModules'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {resolveContextScan,scannerIdentity,type StockScanAction} from '@/services/contextScannerService'
import {formatMoney} from '@/utils/formatters'
import type {ApiProduct} from '@/types/product'
export function QuickProductScan({label='Consultar un producto por código'}:{label?:string}={}){
 const {company,branch,isConsolidated}=useTenant(),{hasPermission}=useAuthPermissions(),{isEnabled}=useModules(),navigate=useNavigate(),{locale,currencyCode}=useSystemSettings()
 const [result,setResult]=useState<{key:string;product:ApiProduct;code:string}|null>(null),key=JSON.stringify([company?.id,branch?.id,isConsolidated,scannerIdentity()])
 const visible=result?.key===key?result:null,allowed=!isConsolidated&&!!branch&&hasPermission('products.view')&&isEnabled('inventory')
 if(!allowed)return null
 const open=(path:string,state?:unknown)=>{setResult(null);navigate(path,{state})}
 const stockAction=(action:StockScanAction)=>{
  if(!visible||visible.key!==JSON.stringify([company?.id,branch?.id,isConsolidated,scannerIdentity()]))return
  open('/inventario/movimientos',{stockScan:{action,code:visible.code,productId:String(visible.product.id),identity:scannerIdentity()}})
 }
 return <>
  <ScannerField scopeKey={key} enabled={!visible} onScan={async(code,signal)=>{const identity=scannerIdentity(),value=await resolveContextScan(code,'LOOKUP',signal);if(!signal.aborted&&identity===scannerIdentity())setResult({key,product:value.product,code})}} label={label}/>
  <Dialog open={!!visible} onOpenChange={open=>{if(!open)setResult(null)}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{visible?.product.name||'Producto'}</DialogTitle><DialogDescription>Consulta rápida de la sucursal activa. Ninguna acción se registra automáticamente.</DialogDescription></DialogHeader>
   {visible&&<div className="space-y-5"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Precio normal</dt><dd className="font-semibold">{formatMoney(Number(visible.product.price),locale,currencyCode)}</dd></div><div><dt className="text-muted-foreground">Existencias</dt><dd className="font-semibold">{String(visible.product.stock??0)}</dd></div>{visible.product.price_wholesale!=null&&<div><dt className="text-muted-foreground">Mayoreo</dt><dd>{formatMoney(Number(visible.product.price_wholesale),locale,currencyCode)}</dd></div>}{visible.product.price_promotion!=null&&(!visible.product.promotion_valid_until||new Date(visible.product.promotion_valid_until)>=new Date())&&<div><dt className="text-muted-foreground">Promoción vigente</dt><dd>{formatMoney(Number(visible.product.price_promotion),locale,currencyCode)}</dd></div>}</dl>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>open(`/inventario/${visible.product.id}`)}>Ver producto y existencias</Button>{hasPermission('products.register_incoming')&&isEnabled('merchandise')&&visible.product.kind!=='SERVICE'&&<Button onClick={()=>open(`/inventario/registrar-ingreso?${new URLSearchParams({codigo:visible.code,empresa:company!.id,sucursal:branch!.id})}`)}>Preparar ingreso</Button>}{(hasPermission('products.export')||hasPermission('reports.view'))&&visible.product.kind!=='SERVICE'&&visible.product.available_for_sale!==false&&<Button variant="outline" onClick={()=>open('/inventario/etiquetas-de-precio',{selectedIds:[visible.product.id],companyId:company!.id,filters:{branchId:branch!.id,inBranch:false}})}>Preparar etiquetas de precio</Button>}</div>
    {visible.product.kind!=='SERVICE'&&<section className="space-y-3 border-t pt-4" aria-label="Movimientos internos"><div><h3 className="text-sm font-semibold">Movimientos internos</h3><p className="text-xs text-muted-foreground">Elige qué preparar para este producto en la sucursal activa.</p></div><div className="grid gap-2 sm:grid-cols-2">
     {hasPermission('stock_moves.create')&&<><Button className="min-h-11" variant="outline" onClick={()=>stockAction('move')}>Mover entre ubicaciones</Button><Button className="min-h-11" variant="outline" onClick={()=>stockAction('replenishment')}>Reponer estante</Button></>}
     {hasPermission('stock_moves.adjust')&&<><Button className="min-h-11" variant="outline" onClick={()=>stockAction('loss')}>Registrar merma</Button><Button className="min-h-11" variant="outline" onClick={()=>stockAction('surplus')}>Registrar sobrante</Button></>}
     <Button className="min-h-11" variant="outline" onClick={()=>stockAction('history')}>Ver movimientos</Button>
    </div><p className="text-xs text-muted-foreground">Mover y reponer conservan el total. Una merma o un sobrante lo modifican; siempre confirmarás antes de guardar.</p></section>}
   </div>}
  </DialogContent></Dialog>
 </>
}
