import {loadCheckoutAttempt,saveCheckoutAttempt,clearCheckoutAttempt,type CheckoutScope,type CheckoutAttempt} from './attemptStorage'
export type CheckoutState={attempt:CheckoutAttempt|null;pending:boolean;error:string|null}
type Lookup={state:'CONFIRMED';saleId:string;kind:'SALE'|'ORDER';orderId?:string}
type Dependencies={scope:CheckoutScope;cartOwnerId?:string;getDraftId?:()=>string|undefined;storage:Storage;isCurrent:()=>boolean;newKey:()=>string;withLock:<T>(run:()=>Promise<T>)=>Promise<T>;submit:(kind:'SALE'|'ORDER',payload:Record<string,unknown>,orderId?:string)=>Promise<{id?:string}>;lookup:(key:string)=>Promise<Lookup>;onConfirmed:(attempt:CheckoutAttempt)=>void|Promise<void>;onState:(state:CheckoutState)=>void}
export function createCheckoutFlow(d:Dependencies){
  let busy=false
  let state:CheckoutState={attempt:null,pending:false,error:null}
  let seenCompletion:string|undefined
  const emit=(patch:Partial<CheckoutState>)=>{state={...state,...patch};if(d.isCurrent())d.onState(state)}
  const read=()=>loadCheckoutAttempt(d.scope,d.storage)
  const unseenCompletion=()=>{const a=loadCheckoutAttempt(d.scope,d.storage,true);return a?.key!==seenCompletion?a:null}
  const save=(a:CheckoutAttempt)=>{saveCheckoutAttempt(d.scope,a,d.storage);emit({attempt:a})}
  const transition=(a:CheckoutAttempt)=>d.withLock(async()=>{
    if(read()?.key!==a.key){emit({attempt:read()||unseenCompletion()});return false}
    save(a);return true
  })
  const confirm=async(a:CheckoutAttempt,saleId:string)=>{
    const confirmed:CheckoutAttempt={...a,state:'CONFIRMED',saleId}
    await transition(confirmed)
    if(!d.isCurrent())return
    await d.onConfirmed(confirmed)
    await d.withLock(async()=>{
      if(read()?.key===a.key){
        saveCheckoutAttempt(d.scope,confirmed,d.storage,true)
        clearCheckoutAttempt(d.scope,a.key,d.storage)
      }
      if(loadCheckoutAttempt(d.scope,d.storage,true)?.key===a.key)seenCompletion=a.key
      emit({attempt:read()||unseenCompletion(),error:null})
    })
  }
  const recover=async(a:CheckoutAttempt)=>{
    const result=await d.lookup(a.key)
    if(result.kind!==a.kind||(a.kind==='ORDER'&&result.orderId!==a.orderId))throw Error('El resultado pertenece a otro origen de cobro')
    await confirm(a,result.saleId)
    return true
  }
  const sync=()=>{if(busy)return;try{emit({attempt:read()||unseenCompletion(),error:null})}catch(error){emit({error:(error as Error).message})}}
  const reconcile=async()=>{
    if(busy||!d.isCurrent())return
    busy=true;emit({pending:true,error:null})
    try{const a=read()||unseenCompletion();if(a){try{await recover(a)}catch(error){if(a.state!=='CONFIRMED')await transition({...a,state:'UNKNOWN'});emit({error:(error as Error).message})}}}
    catch(error){emit({error:(error as Error).message})}
    finally{busy=false;emit({pending:false})}
  }
  const submit=async(kind:'SALE'|'ORDER',payload:Record<string,unknown>,orderId?:string)=>{
    if(busy||!d.isCurrent())return
    busy=true;emit({pending:true,error:null})
    let attempt:CheckoutAttempt|undefined
    try{
      await d.withLock(async()=>{
        if(!d.isCurrent())return
        const existing=read()||unseenCompletion()
        if(existing){emit({attempt:existing});return}
        attempt={...d.scope,version:2,payload:JSON.parse(JSON.stringify(payload)),key:d.newKey(),kind,orderId,cartOwnerId:d.cartOwnerId,draftId:d.getDraftId?.(),state:'SUBMITTING'}
        save(attempt)
      })
      if(!attempt||!d.isCurrent())return
      let result:{id?:string}
      try{result=await d.submit(kind,{...attempt.payload,idempotency_key:attempt.key},orderId)}
      catch(error){
        try{await recover(attempt);return}catch(lookupError){
          if(read()?.state==='CONFIRMED'){emit({attempt:read(),error:(lookupError as Error).message});return}
          const status=(error as {status?:number}).status,code=(error as {data?:{code?:string}}).data?.code
          const definitive=(error as {data?:{checkoutRejected?:boolean}}).data?.checkoutRejected===true||[400,401,403,422].includes(status||0)
          if((lookupError as {status?:number}).status===404&&definitive&&!['CHECKOUT_CONFLICT','LEGACY_ATTEMPT_REQUIRES_RECOVERY'].includes(code||'')){
            await d.withLock(async()=>{clearCheckoutAttempt(d.scope,attempt!.key,d.storage);emit({attempt:read()||unseenCompletion(),error:(error as Error).message})});return
          }
          await transition({...attempt,state:'UNKNOWN'});emit({error:'Estamos comprobando el cobro. No vuelvas a cobrar esta operación.'});return
        }
      }
      if(!result.id){await transition({...attempt,state:'UNKNOWN'});return}
      await confirm(attempt,result.id)
    }catch(error){emit({error:(error as Error).message})}
    finally{busy=false;emit({pending:false})}
  }
  try{state.attempt=read();seenCompletion=loadCheckoutAttempt(d.scope,d.storage,true)?.key}catch(error){state.error=(error as Error).message}
  return {submit,reconcile,sync,getState:()=>state}
}
