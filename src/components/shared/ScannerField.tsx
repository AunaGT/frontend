import {useEffect,useMemo,useRef,useState,useId} from 'react'
import {Loader2,ScanLine,X} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover'
import {authSessionIdentity} from '@/services/authSession'
import {operationalScanner} from '@/services/contextScannerService'
import {createScanQueue,createPrefixedReader,defaultScanProfile,scanCode,type ScanProfile} from '@/lib/scannerFlow'

export function ScannerField({scopeKey,enabled=true,onScan,label='Leer código'}:{scopeKey:string;enabled?:boolean;onScan:(code:string,signal:AbortSignal)=>Promise<unknown>;label?:string;compact?:boolean}){
 const id=useId(),session=authSessionIdentity(),key=JSON.stringify([scopeKey,enabled,session]),live=useRef(key);live.current=key
 const inputRef=useRef<HTMLInputElement>(null)
 const triggerRef=useRef<HTMLButtonElement>(null),interactedOutside=useRef(false)
 const callback=useRef(onScan);callback.current=onScan
 const [code,setCode]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[profile,setProfile]=useState<ScanProfile>(defaultScanProfile),[manualOpen,setManualOpen]=useState(false)
 const owner=useMemo(()=>{
  const abort=new AbortController(),current=()=>!abort.signal.aborted&&live.current===key&&enabled&&authSessionIdentity()===session
  const queue=createScanQueue({current,handle:value=>callback.current(value,abort.signal),error:e=>{if(current()){setError(e.message);setManualOpen(true)}},busy:value=>{if(current())setPending(value)}})
  return{abort,current,queue}
 },[key])
 useEffect(()=>{setCode('');setError('');setPending(false);setManualOpen(false);setProfile(defaultScanProfile)
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
   try{const value=reader.key(event.key);if(value!==null){event.preventDefault();void submit(value,false)}}catch(e){setError((e as Error).message);setManualOpen(true)}
  }
  document.addEventListener('keydown',listen);return()=>document.removeEventListener('keydown',listen)
 },[owner,profile,enabled])
 return <div className="inline-flex max-w-full shrink-0 items-center" data-scanner-field>
  <Popover open={enabled&&manualOpen} onOpenChange={open=>{setManualOpen(open&&enabled);if(!open){setCode('');setError('')}}}>
   <PopoverTrigger asChild><Button ref={triggerRef} type="button" variant="outline" className="min-h-11" disabled={!enabled} aria-label={`Ingresar código: ${label}`} title={label} aria-busy={pending} data-scanner-trigger>{pending?<Loader2 className="h-4 w-4 animate-spin" aria-hidden/>:<ScanLine className="h-4 w-4" aria-hidden/>}Ingresar código</Button></PopoverTrigger>
   {enabled&&manualOpen&&<PopoverContent align="end" collisionPadding={16} className="w-[min(24rem,calc(100vw-2rem))] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-3" aria-label={label} onOpenAutoFocus={event=>{event.preventDefault();interactedOutside.current=false;inputRef.current?.focus({preventScroll:true})}} onInteractOutside={()=>{interactedOutside.current=true}} onCloseAutoFocus={event=>{event.preventDefault();if(!interactedOutside.current&&owner.current()&&!document.querySelector('[role="dialog"],[role="alertdialog"]'))triggerRef.current?.focus({preventScroll:true})}}>
    <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Cerrar entrada de código" onClick={()=>{setManualOpen(false);setCode('');setError('')}}><X className="h-4 w-4" aria-hidden/></Button></div>
    <div className="flex gap-2"><div className="relative min-w-0 flex-1"><ScanLine className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden/><Input ref={inputRef} id={id} aria-label={label} aria-describedby={`${id}-hint`} aria-invalid={!!error} autoComplete="off" spellCheck={false} maxLength={profile.max+profile.prefix.length} value={code} className="min-h-11 pl-9" placeholder="Escanea o escribe el código…" onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.nativeEvent.isComposing||e.repeat)return;if(e.key===(profile.suffix==='TAB'?'Tab':profile.suffix==='ENTER'?'Enter':'')){e.preventDefault();e.stopPropagation();void submit(code)}}}/></div><Button type="button" variant="outline" className="min-h-11" disabled={!code} onClick={()=>void submit(code)}>Leer</Button></div>
    {error?<p id={`${id}-hint`} role="alert" className="mt-2 break-words text-xs text-destructive">{error}</p>:<p id={`${id}-hint`} role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">{pending?'Procesando lecturas…':profile.prefix?'La lectura automática está activa fuera de otros campos y diálogos.':'Coloca aquí el cursor para escanear, o escribe el código y pulsa Leer. Para leer sin abrir este campo, configura el prefijo del lector.'}</p>}
   </PopoverContent>}
  </Popover>
  {!manualOpen&&<span role="status" aria-live="polite" className="sr-only">{pending?'Procesando lecturas…':''}</span>}
 </div>
}
