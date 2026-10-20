import type {PrintSource,PrintOptions,PrintJob,PrintState,RenderedPrint} from './types'
type Dependencies={current:()=>boolean;create:(source:PrintSource,options:PrintOptions)=>Promise<PrintJob>;document:(id:string)=>Promise<unknown>;event:(id:string,event:'PREPARED'|'DOWNLOAD_REQUESTED'|'FAILED',errorCode?:string)=>Promise<PrintJob>;reprint:(id:string,reason:string,pdfOnly:boolean)=>Promise<PrintJob>;render:(snapshot:unknown,document:'MAIN'|'GUIDE')=>Promise<RenderedPrint>;save:(blob:Blob,filename:string)=>void;update:(state:PrintState)=>void}
export function mayUseUntrackedPdf(error:unknown){const status=(error as {status?:number})?.status;return status===undefined||status>=500}
export function createPrintFlow(d:Dependencies){
 let value:PrintState={pending:false,job:null,blob:null,filename:'',error:'',fallbackAvailable:false},busy=false,cancelled=false
 const current=()=>!cancelled&&d.current()
 const check=()=>{if(!current())throw new DOMException('Cambió la sesión o sucursal','AbortError')}
 const update=(patch:Partial<PrintState>)=>{if(current()){value={...value,...patch};d.update(value)}}
 const build=async(job:PrintJob)=>{
  update({job});const snapshot=await d.document(job.id);check()
  const result=await d.render(snapshot,job.document||'MAIN');check()
  const prepared=await d.event(job.id,'PREPARED');check();update({...result,job:prepared})
 }
 const run=async(action:()=>Promise<PrintJob>)=>{
  if(busy||!current())return false
  busy=true;update({pending:true,blob:null,error:'',job:null,fallbackAvailable:false})
  try{const job=await action();check();await build(job);return true}
  catch(e){if(current()){const error=e instanceof Error?e.message:'No se pudo preparar el PDF';if(value.job)await d.event(value.job.id,'FAILED','RENDER_FAILED').catch(()=>{});update({error,blob:null,fallbackAvailable:!value.job&&mayUseUntrackedPdf(e)})}return false}
  finally{busy=false;update({pending:false})}
 }
 return{
  prepare:(source:PrintSource,options:PrintOptions)=>run(()=>d.create(source,options)),
  retry:(id:string,reason:string,pdfOnly=false)=>run(()=>d.reprint(id,reason,pdfOnly)),
  download:async()=>{if(busy||!current()||!value.blob||!value.job)return;busy=true;update({pending:true,error:''});try{const job=await d.event(value.job.id,'DOWNLOAD_REQUESTED');check();d.save(value.blob,value.filename);update({job})}catch(e){update({error:e instanceof Error?e.message:'No se pudo solicitar la descarga'})}finally{busy=false;update({pending:false})}},
  state:()=>value,cancel:()=>{cancelled=true;value={pending:false,job:null,blob:null,filename:'',error:'',fallbackAvailable:false}},
 }
}
