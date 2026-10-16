import {useEffect,useRef,useState} from 'react'
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {getActiveCompanyId,getActiveBranchId} from '@/services/api'
import type {SettingsScope} from '@/services/settingsService'
import {adoptRunRates,previewRunRates,type ResolvedRates} from '../api/rateVersions'
import type {PayrollRun} from '../api/payrollService'
import {RATE_FIELDS,rateDifferences,canAdoptRunRates,runRateSource} from '../domain/rateModel'
export function RunRatesPanel({run,scope,canAdopt,onUpdated}:{run:PayrollRun;scope:SettingsScope;canAdopt:boolean;onUpdated:()=>void}){
  const [preview,setPreview]=useState<ResolvedRates|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const key=JSON.stringify([run.id,scope.companyId,scope.branchId,canAdopt]),live=useRef({key,active:true})
  if(live.current.key!==key)live.current={key,active:true}
  const owner=live.current,current=()=>live.current===owner&&owner.active&&scope.companyId===getActiveCompanyId()&&scope.branchId===getActiveBranchId()
  useEffect(()=>{owner.active=true;setPreview(null);setError('');setBusy(false);return()=>{owner.active=false}},[key])
  async function review(){
    if(!current()||busy||!canAdoptRunRates(run,canAdopt))return
    setBusy(true);setError('')
    try{const result=await previewRunRates(run.id,scope);if(current())setPreview(result)}catch(e){if(current())setError(e instanceof Error?e.message:'No se pudieron consultar los parámetros')}finally{if(current())setBusy(false)}
  }
  async function adopt(){
    if(!current()||busy||!preview||!canAdoptRunRates(run,canAdopt)||!window.confirm('¿Actualizar los parámetros y recalcular todos los recibos de este borrador?'))return
    setBusy(true);setError('')
    try{await adoptRunRates(run.id,preview,scope);if(current()){setPreview(null);onUpdated()}}catch(e){if(current()){setError(e instanceof Error?e.message:'No se pudieron actualizar los parámetros');setPreview(null)}}finally{if(current())setBusy(false)}
  }
  const differences=preview?rateDifferences(run.rates_snapshot?.rates,preview.rates):[]
  return <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="text-base">Parámetros del cálculo</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>{runRateSource(run)}</p>{run.rates_snapshot&&<><p className="text-xs text-muted-foreground">Copia capturada: {new Date(run.rates_snapshot.capturedAt).toLocaleString('es-GT')}</p><details><summary className="cursor-pointer">Consultar copia aplicada</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{RATE_FIELDS.map(f=><div key={f.key}><dt className="text-muted-foreground">{f.label}</dt><dd>{run.rates_snapshot!.rates[f.key]*(f.kind==='percent'?100:1)}{f.kind==='percent'?' %':f.kind==='factor'?' ×':''}</dd></div>)}</dl></details></>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {canAdoptRunRates(run,canAdopt)&&<><Button variant="outline" disabled={busy} onClick={()=>void review()}>{busy?'Procesando…':'Revisar parámetros disponibles'}</Button><p className="text-xs text-muted-foreground">Se comparan los parámetros disponibles para la fecha de pago, no para hoy. Recalcular normalmente conserva la copia actual.</p>{preview&&<div className="rounded-lg border p-3 space-y-2"><p className="font-semibold">Cambios para el pago {run.pay_date.slice(0,10)}</p>{differences.map(f=><p key={f.key}>{f.label}: {f.before==null?'Sin copia histórica':f.before*(f.kind==='percent'?100:1)} → {f.after*(f.kind==='percent'?100:1)}{f.kind==='percent'?' %':''}</p>)}{!differences.length&&<p>Los valores numéricos no cambian. Se conservará la procedencia de la versión seleccionada.</p>}<Button disabled={busy} onClick={()=>void adopt()}>Confirmar actualización y recalcular</Button></div>}</>}
  </CardContent></Card>
}
