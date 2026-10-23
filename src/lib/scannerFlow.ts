export type ScanProfile={suffix:'ENTER'|'TAB'|'NONE';prefix:string;min:number;max:number}
export const defaultScanProfile:ScanProfile={suffix:'ENTER',prefix:'',min:1,max:100}
export function scanCode(raw:string,profile:ScanProfile){
 const code=profile.prefix&&raw.startsWith(profile.prefix)?raw.slice(profile.prefix.length):raw
 if(typeof code!=='string'||code.length<profile.min||code.length>profile.max||/[\x00-\x1f\x7f]/.test(code))throw Error(`El código debe tener entre ${profile.min} y ${profile.max} caracteres, sin saltos de línea.`)
 return code
}
export function createPrefixedReader(profile:ScanProfile){
 let buffer='',capturing=false,prefix=''
 const reset=()=>{buffer='';capturing=false;prefix=''}
 return{reset,key(key:string):string|null{
  if(!profile.prefix||profile.suffix==='NONE')return null
  if(!capturing){prefix=(prefix+key).slice(-profile.prefix.length);if(prefix===profile.prefix){capturing=true;buffer='';prefix=''};return null}
  if(key===(profile.suffix==='ENTER'?'Enter':'Tab')){const value=buffer;reset();return scanCode(value,{...profile,prefix:''})}
  if(key.length!==1||buffer.length>=profile.max){reset();return null}
  buffer+=key;return null
 }}
}
export function createScanQueue(d:{current:()=>boolean;handle:(code:string)=>Promise<unknown>;error:(error:Error)=>void;busy?:(pending:boolean)=>void},limit=20){
 const waiting:{code:string;done:(ok:boolean)=>void}[]=[];let running=false,disposed=false
 const current=()=>!disposed&&d.current()
 async function drain(){
  if(running)return;running=true;d.busy?.(true)
  while(waiting.length){const item=waiting.shift()!;if(!current()){item.done(false);continue}
   try{await d.handle(item.code);item.done(current())}catch(e){if(current())d.error(e instanceof Error?e:Error('No se pudo leer el código'));item.done(false)}
  }
  running=false;if(current())d.busy?.(false)
 }
 return{push(code:string):Promise<boolean>{if(!current())return Promise.resolve(false);if(waiting.length>=limit){d.error(Error('Hay demasiadas lecturas pendientes. Espera antes de continuar.'));return Promise.resolve(false)}const result=new Promise<boolean>(done=>waiting.push({code,done}));void drain();return result},cancel(){disposed=true;for(const item of waiting.splice(0))item.done(false)}}
}
