export type DrawerSource={sourceType:'SALE'|'CUSTOMER_PAYMENT'|'RETURN_SETTLEMENT';sourceId:string}
type Intent={id:string;state:string;workstationId:string}
type Attempt={attemptId:string;claimToken:string}
type State={pending:boolean;message:string;outcome:string}
export function createDrawerSimulation(d:{current:()=>boolean;find:(source:DrawerSource)=>Promise<{items:Intent[];reason?:string}>;claim:(id:string,station:string)=>Promise<Attempt>;result:(id:string,attempt:Attempt)=>Promise<unknown>;update:(state:State)=>void}){
 let state:State={pending:false,message:'',outcome:''},busy=false,dispatched=false
 const update=(patch:Partial<State>)=>{if(d.current()){state={...state,...patch};d.update(state)}}
 return{state:()=>state,simulateForSource:async(source:DrawerSource,workstationId?:string)=>{
  if(busy||dispatched||!d.current())return
  busy=true;update({pending:true,message:'Revisando la simulación autorizada…'})
  try{
   const result=await d.find(source);if(!d.current())return
   const intent=result.items.find(i=>i.state==='PENDING'&&(!workstationId||i.workstationId===workstationId))
   if(!intent){update({outcome:'UNAVAILABLE',message:result.reason||'No hay una intención vigente para este movimiento. No se abrirá ninguna gaveta.'});return}
   dispatched=true
   const attempt=await d.claim(intent.id,workstationId||intent.workstationId);if(!d.current())return
   await d.result(intent.id,attempt);if(!d.current())return
   update({outcome:'SIMULATED',message:'Apertura simulada; no se envió ningún pulso.'})
  }catch{update({outcome:dispatched?'UNKNOWN':'UNAVAILABLE',message:dispatched?'Resultado desconocido. El pago sigue registrado; no se reintentará automáticamente.':'No se pudo revisar la simulación. El movimiento de dinero sigue registrado.'})}
  finally{busy=false;update({pending:false})}
 }}
}
