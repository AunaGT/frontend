import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useModules } from '@/context/useModules'
import { shouldSubmitScan } from '@/services/scannerService'
import { simulateDiagnostic } from './adapters'
import { rememberedWorkstation } from './model'
import { HardwareHistory } from './HardwareHistory'
import type { HardwareWorkspace } from './useHardwareWorkspace'
import type { HardwareTestInput, TestKind } from './types'
const kinds: Record<string,TestKind> = { SCANNER:'SCAN_INPUT', RECEIPT_PRINTER:'TICKET_SAMPLE', LABEL_PRINTER:'LABEL_SAMPLE', OFFICE_PRINTER:'OFFICE_SAMPLE', CASH_DRAWER:'DRAWER_SIMULATION' }
export function HardwareDiagnostics({ hardware: h }: { hardware: HardwareWorkspace }) {
  const [stationId,setStationId]=useState(()=>{
    try{const remembered=rememberedWorkstation({companyId:h.companyId,branchId:h.branchId,userId:h.userId},h.workspace?.workstations||[]);if(remembered)return remembered}catch{/* Storage may be unavailable in a private browser. */}
    return h.workspace?.workstations.find(w=>w.state!=='DISABLED')?.id||''
  }),[deviceId,setDeviceId]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false),[refresh,setRefresh]=useState(0)
  const busy=useRef(false),contextKey=JSON.stringify([h.companyId,h.branchId,h.userId,h.canTestPrint,h.canTestDrawer]),live=useRef(contextKey);live.current=contextKey
  useEffect(()=>{live.current=contextKey;return()=>{live.current=''}},[contextKey])
  const { hasPermission }=useAuthPermissions(),{enabledModuleCodes}=useModules()
  const devices=h.workspace?.devices.filter(d=>d.state!=='DISABLED'&&h.workspace?.assignments.some(a=>a.workstationId===stationId&&a.deviceId===d.id))||[]
  const device=devices.find(d=>d.id===deviceId),kind=device?kinds[device.kind]:null
  const allowed=kind==='DRAWER_SIMULATION'?h.canTestDrawer:h.canTestPrint
  async function run(simulate=false){
    if(!device||!kind||!allowed||h.disabled||h.pending||busy.current)return
    if(!window.confirm(kind==='DRAWER_SIMULATION'?'Se registrará una simulación. No se abrirá ninguna gaveta. ¿Continuar?':simulate?'Se registrará una simulación sin contactar equipos. ¿Continuar?':kind==='SCAN_INPUT'?'Se registrará el código recibido, sin verificar conexión física. ¿Continuar?':'Se preparará un PDF de prueba para descargar e imprimir manualmente. No confirma impresión física. ¿Continuar?'))return
    busy.current=true;setPending(true);setMessage('')
    const capturedKey=contextKey
    try{
      const input:HardwareTestInput={requestKey:crypto.randomUUID(),workstationId:stationId,deviceId:device.id,kind,mode:simulate||kind==='DRAWER_SIMULATION'?'SIMULATED':'BROWSER',outcome:simulate||kind==='DRAWER_SIMULATION'?'SIMULATED':kind==='SCAN_INPUT'?'INPUT_RECEIVED':'PREPARED'}
      let blob:Blob|null=null
      if(kind==='SCAN_INPUT'&&!simulate){if(!code.length||code.length<(device.profile.scannerMinLength??1)||code.length>(device.profile.scannerMaxLength??128))throw new Error('El código no cumple la longitud configurada');input.sampleCode=code}
      else if(kind!=='DRAWER_SIMULATION'&&!simulate){const{prepareDiagnosticPdf}=await import('./diagnosticPdf');blob=await prepareDiagnosticPdf(kind as 'TICKET_SAMPLE'|'LABEL_SAMPLE'|'OFFICE_SAMPLE',device.profile)}
      if(live.current!==capturedKey)return
      const result=await h.recordTest(input)
      if(!result||live.current!==capturedKey)return
      if(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`auna-prueba-${kind.toLowerCase()}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
      setMessage(input.mode==='SIMULATED'?simulateDiagnostic({kind}).message:kind==='SCAN_INPUT'?'Entrada recibida. Esto no verifica conexión, marca ni modelo del lector.':'PDF preparado. Imprime manualmente al 100 %, sin ajustar, y revisa el resultado físico.');setRefresh(n=>n+1)
    }catch(e){if(live.current===capturedKey)setMessage((e as Error).message||'No se pudo preparar la prueba')}
    finally{busy.current=false;if(live.current===capturedKey)setPending(false)}
  }
  return <div className="space-y-5"><p className="max-w-2xl text-sm text-muted-foreground">Estas herramientas preparan documentos o registran entradas. Una simulación o un PDF no sustituye una prueba física. No se modifican ventas, pagos ni existencias.</p>
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm" htmlFor="hardware-test-station">Puesto<select id="hardware-test-station" className="auna-control auna-control-select w-full" value={stationId} disabled={h.pending||pending} onChange={e=>{setStationId(e.target.value);setDeviceId('');setMessage('')}}><option value="">Selecciona un puesto</option>{h.workspace?.workstations.filter(w=>w.state!=='DISABLED').map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-2 text-sm" htmlFor="hardware-test-device">Equipo asignado<select id="hardware-test-device" className="auna-control auna-control-select w-full" value={deviceId} disabled={h.pending||pending} onChange={e=>{setDeviceId(e.target.value);setMessage('')}}><option value="">Selecciona un equipo</option>{devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
    {!devices.length&&<p className="text-sm text-muted-foreground">Asigna equipos al puesto para preparar sus pruebas.</p>}
    {kind==='SCAN_INPUT'&&<label className="grid max-w-md gap-2 text-sm" htmlFor="hardware-test-code">Código de prueba<Input id="hardware-test-code" autoComplete="off" maxLength={device?.profile.scannerMaxLength??128} value={code} disabled={h.pending||pending||!allowed} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(shouldSubmitScan(e,device?.profile.scannerSuffix??'ENTER')){e.preventDefault();void run()}}}/></label>}
    {device&&<div className="flex flex-wrap gap-3">{allowed&&<Button disabled={h.disabled||h.pending||pending} onClick={()=>void run()}>{pending?'Preparando…':kind==='DRAWER_SIMULATION'?'Simular gaveta':kind==='SCAN_INPUT'?'Registrar entrada':'Descargar PDF de prueba'}</Button>}{allowed&&kind!=='DRAWER_SIMULATION'&&<Button variant="outline" disabled={h.disabled||h.pending||pending} onClick={()=>void run(true)}>Solo simular</Button>}{!allowed&&<p className="text-sm text-muted-foreground">Necesitas permiso para ejecutar esta prueba.</p>}</div>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {hasPermission('products.view')&&enabledModuleCodes?.has('inventory')&&<Link className="inline-block text-sm text-primary underline" to="/scanner">Consultar un código en el catálogo real</Link>}
    <div className="border-t border-border pt-4"><h3 className="mb-3 font-semibold">Últimas pruebas</h3><HardwareHistory scope={{companyId:h.companyId,branchId:h.branchId,userId:h.userId}} tests refresh={refresh}/></div>
  </div>
}
