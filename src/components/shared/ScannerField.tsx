import {useEffect,useMemo,useRef,useState,useId} from 'react'
import {ScanLine} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {authSessionIdentity} from '@/services/authSession'
import {operationalScanner} from '@/services/contextScannerService'
import {createScanQueue,createPrefixedReader,defaultScanProfile,scanCode,type ScanProfile} from '@/lib/scannerFlow'

export function ScannerField({scopeKey,enabled=true,onScan,label='Leer código',compact=false}:{scopeKey:string;enabled?:boolean;onScan:(code:string,signal:AbortSignal)=>Promise<unknown>;label?:string;compact?:boolean}){
 const id=useId(),session=authSessionIdentity(),key=JSON.stringify([scopeKey,enabled,session]),live=useRef(key);live.current=key
 const callback=useRef(onScan);callback.current=onScan
 const [code,setCode]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[profile,setProfile]=useState<ScanProfile>(defaultScanProfile)
 const owner=useMemo(()=>{
  const abort=new AbortController(),current=()=>!abort.signal.aborted&&live.current===key&&enabled&&authSessionIdentity()===session
  const queue=createScanQueue({current,handle:value=>callback.current(value,abort.signal),error:e=>{if(current())setError(e.message)},busy:value=>{if(current())setPending(value)}})
  return{abort,current,queue}
 },[key])
 useEffect(()=>{setCode('');setError('');setPending(false);setProfile(defaultScanProfile)
  if(enabled)void operationalScanner(owner.abort.signal).then(value=>{if(owner.current()&&value){const p=value.profile;setProfile({suffix:p.scannerSuffix??'ENTER',prefix:p.scannerPrefix??'',min:p.scannerMinLength??1,max:Math.min(100,p.scannerMaxLength??100)})}}).catch(()=>{/* An unavailable profile never enables guessing from typing speed. */})
  return()=>{owner.abort.abort();owner.queue.cancel()}
 },[owner])
 async function submit(raw:string,stripPrefix=true){if(!owner.current())return;try{const value=scanCode(raw,stripPrefix?profile:{...profile,prefix:''});setCode('');setError('');await owner.queue.push(value)}catch(e){if(owner.current())setError((e as Error).message)}}
 useEffect(()=>{
  if(!enabled||!profile.prefix||profile.suffix==='NONE')return
  const reader=createPrefixedReader(profile);let previous=0
  const listen=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement|null
   if(!owner.current()||event.defaultPrevented||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||event.repeat||target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="alertdialog"]')||document.querySelector('[role="dialog"],[role="alertdialog"]')){reader.reset();return}
   if(Date.now()-previous>1500)reader.reset();previous=Date.now()
   try{const value=reader.key(event.key);if(value!==null){event.preventDefault();void submit(value,false)}}catch(e){setError((e as Error).message)}
  }
  document.addEventListener('keydown',listen);return()=>document.removeEventListener('keydown',listen)
 },[owner,profile,enabled])
 return <div className={`min-w-0 space-y-1 ${compact?'':'max-w-lg'}`} data-scanner-field>
  <label htmlFor={id} className="block text-xs font-medium">{label}</label>
  <div className="flex gap-2"><div className="relative min-w-0 flex-1"><ScanLine className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden/><Input id={id} aria-label={label} autoComplete="off" spellCheck={false} maxLength={profile.max+profile.prefix.length} value={code} disabled={!enabled} className="pl-9" placeholder="Escanea o escribe el código…" onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.nativeEvent.isComposing||e.repeat)return;if(e.key===(profile.suffix==='TAB'?'Tab':profile.suffix==='ENTER'?'Enter':'')){e.preventDefault();e.stopPropagation();void submit(code)}}}/></div><Button type="button" variant="outline" disabled={!enabled||!code} onClick={()=>void submit(code)}>Leer</Button></div>
  {error?<p role="alert" className="text-xs text-destructive">{error}</p>:<p role="status" aria-live="polite" className="text-xs text-muted-foreground">{pending?'Procesando lecturas…':profile.prefix?`Lectura automática con prefijo ${profile.prefix}; se pausa mientras escribes o usas un diálogo.`:'Puedes probar escribiendo el código. Para leer, coloca aquí el cursor.'}</p>}
 </div>
}
