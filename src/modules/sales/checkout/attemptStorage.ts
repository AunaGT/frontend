export type CheckoutScope={companyId:string;branchId:string;userId:string}
export type CheckoutAttempt=CheckoutScope & {version?:2;payload?:Record<string,unknown>;key:string;kind:'SALE'|'ORDER';orderId?:string;cartOwnerId?:string;draftId?:string;state:'SUBMITTING'|'UNKNOWN'|'CONFIRMED';saleId?:string;lastError?:string}
export function canRetryCheckout(a:CheckoutAttempt|null):boolean{
  return Boolean(a && a.state!=='CONFIRMED' && a.version===2 && a.payload && typeof a.payload==='object' && !Array.isArray(a.payload) && (a.kind==='SALE'||typeof a.orderId==='string'&&a.orderId.trim()))
}
const storageKey=(scope:CheckoutScope)=>`auna:checkout:v1:${JSON.stringify([scope.companyId,scope.branchId,scope.userId])}`
export function loadCheckoutAttempt(scope:CheckoutScope,storage:Storage=localStorage,completed=false):CheckoutAttempt|null{
  const raw=storage.getItem(storageKey(scope)+(completed?':completed':''))
  if(!raw)return null
  const a=JSON.parse(raw) as CheckoutAttempt
  if(!a||a.companyId!==scope.companyId||a.branchId!==scope.branchId||a.userId!==scope.userId||typeof a.key!=='string'||!a.key||!['SALE','ORDER'].includes(a.kind)||!['SUBMITTING','UNKNOWN','CONFIRMED'].includes(a.state)||(a.state==='CONFIRMED'&&!a.saleId))throw Error('No se pudo recuperar el intento de cobro guardado. Revisa las ventas antes de continuar.')
  return a
}
export function saveCheckoutAttempt(scope:CheckoutScope,a:CheckoutAttempt,storage:Storage=localStorage,completed=false):void{
  if(a.companyId!==scope.companyId||a.branchId!==scope.branchId||a.userId!==scope.userId)throw Error('El cobro pertenece a otro ámbito')
  const {version,payload,key,kind,orderId,cartOwnerId,draftId,state,saleId,lastError}=a
  try{storage.setItem(storageKey(scope)+(completed?':completed':''),JSON.stringify({...scope,version,payload,key,kind,orderId,cartOwnerId,draftId,state,saleId,...(typeof lastError==='string'?{lastError:lastError.slice(0,500)}:{})}))}catch{throw Error('No se pudo guardar la recuperación del cobro. Habilita el almacenamiento del navegador antes de cobrar.')}
}
export function clearCheckoutAttempt(scope:CheckoutScope,key:string,storage:Storage=localStorage):void{
  if(loadCheckoutAttempt(scope,storage)?.key===key)storage.removeItem(storageKey(scope))
}
