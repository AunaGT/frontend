import {useEffect,useRef,useState} from 'react'
import {fetchBarcodeLayout,fetchBarcodeCandidates,saveBarcodeLayout,prepareBarcodeLabels} from './barcodeLabelService'
import {createLabelTemplate,createShelfLabelTemplate,defaultPaper,parsePaperSettings,parseLabelDesign} from './labelDesign'
import {parsePreparationInput,parseShelfPreparationInput} from './labelContract'
import {generateBarcodeLabelPdf,type BarcodePdfResult} from './labelPdf'
import {downloadReportBlob} from '@/modules/reports/documents/reportDownload'
import {labelSelectionKey} from './types'
import type {BarcodeLabelLayout,LabelCandidate,LabelDesign,PaperSettings,PreparedLabels,PrintScope,PrintSelection,LabelPurpose,PriceTier} from './types'
export type SelectedLabel={product:LabelCandidate;copies:number;assignment:PrintSelection['assignment'];priceTiers?:PriceTier[]}
export function useBarcodePrint({companyId,userId,branchId,initialSelection=[],initialFilters={},purpose='barcode'}:{companyId:string;userId:string;branchId:string|null;initialSelection?:string[];initialFilters?:Partial<PrintScope>;purpose?:LabelPurpose}){
  const key=`${userId}:${companyId}:${branchId||'all'}:${purpose}`,context=useRef(key);context.current=key
  const template=purpose==='shelf'?createShelfLabelTemplate:createLabelTemplate,paperKey=purpose==='shelf'?'shelf-price-paper':'barcode-paper'
  const [draft,setDraft]=useState({selected:new Map<string,SelectedLabel>(),design:template(),paper:defaultPaper()})
  const value=useRef(draft);value.current=draft
  const [layout,setLayout]=useState<BarcodeLabelLayout|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[pdf,setPdf]=useState<BarcodePdfResult|null>(null),[progress,setProgress]=useState({donePages:0,totalPages:0}),[prepared,setPrepared]=useState<PreparedLabels|null>(null)
  const [reloadVersion,setReloadVersion]=useState(0),[productErrors,setProductErrors]=useState<Record<string,string>>({})
  const epoch=useRef(0),running=useRef(false),controller=useRef<AbortController|null>(null),request=useRef<{fingerprint:string;key:string}|null>(null),cache=useRef<{fingerprint:string;data:PreparedLabels}|null>(null),downloadable=useRef<{key:string;result:BarcodePdfResult}|null>(null)
  const refreshController=useRef<AbortController|null>(null)
  const filter=():PrintScope=>({branchId:branchId||'',inBranch:initialFilters.inBranch||false,...(initialFilters.warehouseId?{warehouseId:initialFilters.warehouseId}:{}),...(initialFilters.locationId?{locationId:initialFilters.locationId}:{})})
  const fingerprint=(state=value.current)=>JSON.stringify({context:key,scope:filter(),design:state.design,paper:state.paper,items:[...state.selected.values()].map(s=>({productId:s.product.id,...(s.product.unit_revision!==undefined?{presentation_id:s.product.presentation_id??null,unit_revision:s.product.unit_revision}:{}),copies:s.copies,expectedBarcode:s.product.barcode,assignment:s.assignment,...(s.priceTiers?{priceTiers:s.priceTiers}:{})}))})
  const mutate=(next:typeof draft)=>{epoch.current++;controller.current?.abort();running.current=false;setBusy(false);cache.current=null;request.current=null;downloadable.current=null;setPdf(null);setPrepared(null);setError('');setProductErrors({});value.current=next;setDraft(next)}
  const updateSelected=(id:string,change:(s:SelectedLabel)=>SelectedLabel)=>{const next=new Map(value.current.selected),item=next.get(id);if(item){next.set(id,change(item));mutate({...value.current,selected:next})}}
  const loadLayout=async(started=key,signal?:AbortSignal)=>{
    const result=await fetchBarcodeLayout(signal,purpose);if(context.current!==started||signal?.aborted)return
    let paper=result.defaultPaper
    try{const saved=globalThis.localStorage?.getItem(`${paperKey}:${userId}:${companyId}`);if(saved)paper=parsePaperSettings(JSON.parse(saved))}catch{/* blocked/invalid local preference: use validated company default */}
    setLayout(result);mutate({...value.current,design:result.design,paper});setReloadVersion(v=>v+1)
  }
  useEffect(()=>{
    const abort=new AbortController(),started=key,epochRef=epoch;epoch.current++;controller.current?.abort();running.current=false;cache.current=null;request.current=null;downloadable.current=null
    const fresh={selected:new Map<string,SelectedLabel>(),design:template(),paper:defaultPaper()};value.current=fresh;setDraft(fresh);setPdf(null);setPrepared(null);setError('');setProductErrors({});setLoading(true);setBusy(false);setLayout(null)
    void (async()=>{
      await loadLayout(started,abort.signal)
      if(initialSelection.length){const result=await fetchBarcodeCandidates({ids:initialSelection.slice(0,100).join(','),pageSize:100,...(branchId?{branch_id:branchId}:{})},abort.signal,purpose);if(context.current===started&&!abort.signal.aborted){const selected=new Map(result.items.map(p=>[p.id,{product:p,copies:1,assignment:{mode:purpose==='shelf'||p.barcode?'keep':'auto'} as PrintSelection['assignment']}]));value.current={...value.current,selected};setDraft(value.current);if(result.items.length!==initialSelection.length)setError('Algunos seleccionados ya no son bienes disponibles para venta y no se incluyeron')}}
    })().catch(e=>{if(context.current===started&&!abort.signal.aborted)setError(e.message)}).finally(()=>{if(context.current===started&&!abort.signal.aborted)setLoading(false)})
    return()=>{abort.abort();controller.current?.abort();refreshController.current?.abort();epochRef.current++;downloadable.current=null}
    // Scoped initial navigation data is read once per company/branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key])
  const selectProduct=(product:LabelCandidate)=>{const selected=new Map(value.current.selected);if(!selected.has(labelSelectionKey(product))){if(selected.size>=100){setError('Selecciona como máximo 100 productos');return}selected.set(labelSelectionKey(product),{product,copies:1,assignment:{mode:purpose==='shelf'||product.barcode?'keep':'auto'}});mutate({...value.current,selected})}}
  const removeProduct=(id:string)=>{const selected=new Map(value.current.selected);selected.delete(id);mutate({...value.current,selected})}
  const setDesign=(design:LabelDesign)=>mutate({...value.current,design:parseLabelDesign(design)})
  const setPaper=(paper:PaperSettings)=>{mutate({...value.current,paper});try{const valid=parsePaperSettings(paper);globalThis.localStorage?.setItem(`${paperKey}:${userId}:${companyId}`,JSON.stringify(valid))}catch{/* incomplete numeric input stays editable; only valid preferences are remembered */}}
  const prepare=async(confirmAssignments=false)=>{
    if(running.current)return false
    const started=key,version=epoch.current,stamp=fingerprint();setError('');setProductErrors({});downloadable.current=null;setPdf(null)
    try{
      if(!branchId)throw Error('Selecciona una sucursal en el selector superior antes de preparar la impresión')
      const input={requestKey:request.current?.fingerprint===stamp?request.current.key:crypto.randomUUID(),scope:filter(),items:[...value.current.selected.values()].map(s=>({productId:s.product.id,...(s.product.unit_revision!==undefined?{presentation_id:s.product.presentation_id??null,unit_revision:s.product.unit_revision}:{}),copies:s.copies,expectedBarcode:s.product.barcode,assignment:s.assignment,...(s.priceTiers?{priceTiers:s.priceTiers}:{})})),design:value.current.design,paper:value.current.paper,confirmAssignments}
      if(purpose==='shelf')parseShelfPreparationInput(input);else parsePreparationInput(input)
      if(!request.current||request.current.fingerprint!==stamp)request.current={fingerprint:stamp,key:input.requestKey}
      running.current=true;setBusy(true);setProgress({donePages:0,totalPages:0});controller.current=new AbortController();const signal=controller.current.signal
      let snapshot=purpose!=='shelf'&&cache.current?.fingerprint===stamp?cache.current.data:null
      if(!snapshot){snapshot=await prepareBarcodeLabels(input,signal,purpose);if(context.current!==started||epoch.current!==version||signal.aborted)return false
        const selected=new Map(value.current.selected);for(const p of snapshot.products){const identity=labelSelectionKey(p),old=selected.get(identity);if(old)selected.set(identity,{...old,product:{...old.product,barcode:p.barcode||null},assignment:{mode:'keep'}})}
        value.current={...value.current,selected};setDraft(value.current);cache.current={fingerprint:fingerprint(value.current),data:snapshot};setPrepared(snapshot)
      }
      const result=await generateBarcodeLabelPdf(snapshot,{signal,separateGuide:true,onProgress:p=>{if(context.current===started&&epoch.current===version)setProgress(p)}})
      if(context.current!==started||epoch.current!==version||signal.aborted)return false
      downloadable.current={key:started,result};setPdf(result);if(purpose==='shelf'){request.current=null;cache.current=null}return true
    }catch(e){if(context.current===started&&epoch.current===version){const cause=e as {data?:{productId?:string;field?:string};productId?:string;field?:string},id=cause?.data?.productId||cause?.productId||(value.current.selected.has(cause?.field||'')?cause.field:undefined),item=id?value.current.selected.get(id):undefined,detail=e instanceof Error?e.message:'No se pudo preparar el documento',message=item&&!detail.startsWith(item.product.name)?`${item.product.name} · ${detail}`:detail;if(item&&id)setProductErrors({[id]:detail});setError(cache.current?.data.assignedProductIds.length?`${message}. Los códigos ya quedaron guardados; podés reintentar generar el PDF.`:message)}return false}
    finally{if(context.current===started&&epoch.current===version){running.current=false;setBusy(false)}}
  }
  const saveLayout=async(design=value.current.design)=>{
    if(!layout||!layout.capabilities?.canSaveLayout)throw Error('No tienes permiso para guardar el diseño de la empresa')
    if(!branchId)throw Error('Selecciona una sucursal autorizada antes de guardar el diseño')
    const started=key;setSaving(true);setError('')
    try{const result=await saveBarcodeLayout({expectedRevision:layout.revision,design,defaultPaper:value.current.paper},undefined,branchId,purpose);if(context.current!==started)throw Error('Cambió la empresa');setLayout(result)}catch(e){if(context.current===started)setError(e instanceof Error?e.message:'No se pudo guardar');throw e}finally{if(context.current===started)setSaving(false)}
  }
  const refreshSelected=async()=>{
    const started=key,original=new Map(value.current.selected),ids=[...new Set([...original.values()].map(s=>s.product.id))]
    refreshController.current?.abort();if(!ids.length)return
    const abort=new AbortController();refreshController.current=abort
    const current=()=>context.current===started&&!abort.signal.aborted&&refreshController.current===abort
    try{
      const result=await fetchBarcodeCandidates({ids:ids.join(','),pageSize:100,...(branchId?{branch_id:branchId}:{})},abort.signal,purpose)
      if(!current())return
      const selected=new Map(value.current.selected)
      for(const [identity,old] of value.current.selected){
        const initial=original.get(identity);if(!initial)continue
        const row=result.items.find(p=>p.id===old.product.id),product=old.product.presentation_id?row?.unitOptions?.find(p=>p.presentation_id===old.product.presentation_id):row?.unitOptions?.find(p=>p.presentation_id==null)??row
        if(product)selected.set(identity,{...old,product,assignment:old.assignment!==initial.assignment?old.assignment:{mode:purpose==='shelf'||product.barcode?'keep':'auto'}})
        else selected.delete(identity)
      }
      mutate({...value.current,selected})
    }catch(error){if(current())throw error}
    finally{if(refreshController.current===abort)refreshController.current=null}
  }
  return{...draft,layout,reloadVersion,productErrors,loading,busy,saving,error,pdf:downloadable.current?.key===key?pdf:null,progress,prepared,selectProduct,removeProduct,setCopies:(id:string,copies:number)=>updateSelected(id,s=>({...s,copies})),setPriceTiers:(id:string,priceTiers:PriceTier[]|undefined)=>updateSelected(id,s=>({...s,priceTiers})),setAssignment:(id:string,assignment:PrintSelection['assignment'])=>updateSelected(id,s=>({...s,assignment})),setDesign,setPaper,saveLayout,prepare,refreshSelected,reloadLayout:()=>loadLayout(),cancelGeneration:()=>{epoch.current++;controller.current?.abort();running.current=false;setBusy(false);downloadable.current=null;setPdf(null)},downloadLabels:()=>{if(context.current===key&&downloadable.current?.key===key)downloadReportBlob(downloadable.current.result.labels,purpose==='shelf'?'etiquetas-precios-estante.pdf':'etiquetas-codigos-de-barras.pdf')},downloadGuide:()=>{if(context.current===key&&downloadable.current?.key===key&&downloadable.current.result.guide)downloadReportBlob(downloadable.current.result.guide,'guia-etiquetas.pdf')}}
}
