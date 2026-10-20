import {useEffect,useMemo,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {ArrowLeft,ArrowRight,Printer,FileText,Palette,Loader2,Download} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {MetricStrip} from '@/components/shared/MetricStrip'
import {ModuleTabBar} from '@/components/shared/ModuleTabs'
import {LoadingState} from '@/components/shared/LoadingState'
import {PdfDocumentPreview} from '@/components/shared/pdf/PdfDocumentPreview'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {createCouponMeasure} from '@/modules/promotions/coupons/couponFonts'
import {labelSelectionKey} from './types'
import type {CouponMeasure} from '@/modules/promotions/coupons/couponPresentation'
import {useBarcodePrint} from './useBarcodePrint'
import {BarcodeProductsStep} from './BarcodeProductsStep'
import {BarcodePrintSettings} from './BarcodePrintSettings'
import {BarcodeLabelEditor} from './BarcodeLabelEditor'
import {BarcodeLabelCanvas} from './BarcodeLabelCanvas'
import {createLabelTemplate,createShelfLabelTemplate} from './labelDesign'
import {PriceTierPicker} from './PriceTierPicker'
import {prepareLabelScene,shelfPreviewProduct} from './labelScene'
import type {LabelProduct,PrintScope,LabelPurpose,LabelCandidate} from './types'
import './barcodeLabels.css'
import {usePrintJob,usePrintDestination,PrintDestination} from '@/modules/config/hardware/public'
import {renderPrintSource} from '@/services/printRenderers'
const steps=[{value:'products',label:'1. Productos',icon:FileText},{value:'settings',label:'2. Impresión',icon:Palette},{value:'preview',label:'3. Vista previa',icon:Printer}]
export default function BarcodePrintPage({purpose='barcode'}:{purpose?:LabelPurpose}={}){
  const shelf=purpose==='shelf',makeTemplate=shelf?createShelfLabelTemplate:createLabelTemplate,title=shelf?'Imprimir etiquetas de precio':'Imprimir códigos de barras',path=shelf?'/inventario/etiquetas-de-precio':'/inventario/codigos-de-barras'
  const navigate=useNavigate(),location=useLocation(),{company,branch,branches,setBranch}=useTenant(),{user,hasPermission}=useAuthPermissions(),{companyName,currencyCode,locale,timezone}=useSystemSettings()
  const initial=location.state as {companyId?:string;selectedIds?:string[];filters?:Partial<PrintScope>}|null
  const inherited=initial?.companyId===company?.id?initial:null
  const printBranch=branches.find(b=>b.id===inherited?.filters?.branchId)||branch
  const filters={...inherited?.filters,branchId:printBranch?.id}
  const flow=useBarcodePrint({companyId:company?.id||'',userId:user?.id||'',branchId:printBranch?.id||null,initialSelection:inherited?.selectedIds||[],initialFilters:filters,purpose})
  const [reloadConfirm,setReloadConfirm]=useState(false)
  const printScope={companyId:company?.id||'',branchId:printBranch?.id||'',userId:user?.id||''}
  const destination=usePrintDestination(printScope,'LABEL'),printJob=usePrintJob(printScope,renderPrintSource,hasPermission('products.export','reports.view'))
  const [printNotice,setPrintNotice]=useState('')
  const downloadTracked=async(document:'MAIN'|'GUIDE')=>{
    if(printJob.pending)return
    if(!flow.prepared?.id){setPrintNotice('Descarga sin registro de impresión.');if(document==='GUIDE')flow.downloadGuide();else flow.downloadLabels();return}
    setPrintNotice('')
    const ok=await printJob.prepare({kind:'LABEL_PREPARATION',id:flow.prepared.id},document==='GUIDE'?{document}:{...destination.options,document})
    if(!printJob.isCurrent())return
    if(ok)await printJob.download()
    else if(printJob.canUseUntrackedPdf()){setPrintNotice('Descarga sin registro de impresión. Los productos y sus códigos siguen guardados.');if(document==='GUIDE')flow.downloadGuide();else flow.downloadLabels()}
  }
  const [step,setStep]=useState('products'),[editor,setEditor]=useState(false),[confirm,setConfirm]=useState(false),[measure,setMeasure]=useState<CouponMeasure|null>(null),[inputError,setInputError]=useState(''),[sampleId,setSampleId]=useState(''),[showGuide,setShowGuide]=useState(false),[templateConfirm,setTemplateConfirm]=useState<'essential'|'product'|'price'|null>(null)
  usePageTrail([{label:title,to:path},...(editor?[{label:'Diseñar etiqueta'}]:[])])
  useEffect(()=>{let active=true;void createCouponMeasure().then(m=>{if(active)setMeasure(()=>m)}).catch(e=>{if(active)setInputError(e.message)});return()=>{active=false}},[])
  const selected=[...flow.selected.values()],total=selected.reduce((n,s)=>n+s.copies,0),missing=shelf?0:selected.filter(s=>!s.product.barcode).length,canPrint=hasPermission('products.export','reports.view'),canAssign=flow.layout?.capabilities?.canAssign||false
  const chosen=flow.selected.get(sampleId)||selected[0]
  const sample:LabelCandidate={id:'sample',name:'Producto de ejemplo',barcode:'AUNA000000000000',price:'25.00',brand:'Marca',size:'Unidad',shelfPrices:[{tier:'LIST',label:'Normal',amount:'25.00'},{tier:'WHOLESALE',label:'Mayoreo',amount:'22.00'},{tier:'PROMOTION',label:'Promoción',amount:'20.00'}]}
  const product:LabelProduct=shelf?{...shelfPreviewProduct(chosen?.product||sample,flow.design,chosen?.priceTiers||flow.design.priceTiers),copies:chosen?.copies||1}:chosen?{...chosen.product,copies:chosen.copies,barcode:chosen.product.barcode||chosen.assignment.value||'AUNA000000000000'}:{...sample,barcode:sample.barcode||'',copies:1}
  const branding={companyName:companyName||company?.name||'Empresa',currencyCode,locale,timezone}
  const previews=useMemo(()=>{if(!measure)return[];return(['essential','product','price'] as const).map(preset=>{const design=makeTemplate(preset),sampleProduct:LabelProduct={id:'sample',name:'Producto de ejemplo',barcode:'AUNA000000000000',price:'25.00',brand:null,size:null,copies:1,shelfPrices:[{tier:'LIST',label:'Normal',amount:'25.00'},{tier:'WHOLESALE',label:'Mayoreo',amount:'22.00'},{tier:'PROMOTION',label:'Promoción',amount:'20.00'}]};return{preset,design,scene:prepareLabelScene(shelf?shelfPreviewProduct(sampleProduct,design):sampleProduct,design,measure,{companyName:'Empresa',currencyCode,locale})}})},[measure,currencyCode,locale,makeTemplate,shelf])
  const doPrepare=async(confirmed=false)=>{setInputError('');if(await flow.prepare(confirmed)){setStep('preview');setShowGuide(false)}}
  const requestPrepare=()=>{if(missing)setConfirm(true);else void doPrepare(false)}
  const edit=()=>{setEditor(true);setSampleId(chosen?labelSelectionKey(chosen.product):'')}
  if(editor)return <div className="mx-auto w-full max-w-[1560px] min-w-0 p-4 sm:p-8 space-y-4">
    {selected.length>1&&<Label className="flex flex-wrap items-center gap-2 text-sm">Producto de muestra<select aria-label="Producto de muestra" className="auna-control auna-control-select !w-auto max-w-md" value={labelSelectionKey(product)} onChange={e=>setSampleId(e.target.value)}>{selected.map(s=><option key={labelSelectionKey(s.product)} value={labelSelectionKey(s.product)}>{s.product.name}</option>)}</select></Label>}
    <BarcodeLabelEditor key={company?.id+':'+flow.layout?.revision} design={flow.design} product={product} branding={branding} onChange={flow.setDesign} onSave={flow.saveLayout} onBack={()=>setEditor(false)} canSave={!!printBranch&&(flow.layout?.capabilities?.canSaveLayout||false)} saving={flow.saving} reloadVersion={flow.reloadVersion} error={flow.error||inputError} onReload={()=>setReloadConfirm(true)}/>
    <ConfirmDialog open={reloadConfirm} onOpenChange={setReloadConfirm} title="Recargar diseño guardado" description="Se reemplazará este borrador y se descartará la vista previa anterior. Los productos y las copias se conservan." confirmText="Recargar" onConfirm={()=>{setReloadConfirm(false);setInputError('');void flow.reloadLayout().catch(e=>setInputError(e instanceof Error?e.message:'No se pudo recargar'))}}/>
  </div>
  return <div className="mx-auto w-full max-w-[1560px] min-w-0 p-4 sm:p-8 space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={()=>navigate('/inventario')}><ArrowLeft size={16}/>Inventario</Button><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={flow.loading||flow.busy} onClick={edit}><Palette size={16}/>Editar diseño</Button><Button disabled={flow.loading||flow.busy||!flow.layout||!selected.length||!canPrint||missing>0&&!canAssign||!printBranch} onClick={requestPrepare}>{flow.busy?<Loader2 size={16} className="animate-spin"/>:<Printer size={16}/>}Preparar PDF</Button></div></div>
    <p className="text-xs text-muted-foreground">Sucursal para impresión: {printBranch?.name||'Sin seleccionar'}{filters.warehouseId?' · Alcance de almacén heredado del inventario':''}{filters.locationId?' · Ubicación seleccionada':''}</p>
    <PrintDestination route={destination.route} value={destination.destinationId} onChange={destination.onChange} disabled={flow.busy||printJob.pending}/>
    {(printNotice||printJob.error)&&<p role="status" className="text-sm text-muted-foreground">{printNotice||printJob.error}</p>}
    <MetricStrip label="Resumen de etiquetas" items={[{label:'Productos seleccionados',value:selected.length},{label:'Etiquetas',value:Number.isFinite(total)?total:'—'},{label:shelf?'Tarifas generales':'Códigos por asignar',value:shelf?flow.design.priceTiers?.length||1:missing},{label:'Diseño',value:flow.layout?.revision?'Guardado por empresa':'Plantilla inicial'}]}/>
    {!printBranch&&<div className="barcode-panel space-y-2"><p className="text-sm">La vista consolidada es de consulta. Elegí una sucursal para preparar etiquetas.</p><select aria-label="Sucursal para impresión" className="auna-control auna-control-select max-w-md" value="" onChange={e=>{if(e.target.value)setBranch(e.target.value)}}><option value="">Selecciona una sucursal…</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
    {(flow.error||inputError)&&<div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{flow.error||inputError}<Button size="sm" variant="outline" className="ml-2" disabled={flow.busy} onClick={()=>{setInputError('');void flow.refreshSelected().catch(e=>setInputError(e.message))}}>Actualizar seleccionados</Button></div>}
    {!canPrint&&<p className="text-sm text-muted-foreground">Preparar el PDF requiere permiso para exportar productos.</p>}
    {shelf&&<section className="barcode-panel space-y-2"><PriceTierPicker value={flow.design.priceTiers||['LIST']} onChange={priceTiers=>flow.setDesign({...flow.design,priceTiers})} disabled={flow.busy||flow.loading}/><p className="text-xs text-muted-foreground">Una etiqueta por producto con las tarifas elegidas. Podés personalizar cada seleccionado. Los precios se vuelven a validar al preparar el PDF; esta pantalla no los modifica.</p></section>}
    <ModuleTabBar value={step} onValueChange={setStep} items={steps} ariaLabel="Pasos de impresión de etiquetas"/>
    {flow.loading?<LoadingState variant="page" message="Cargando diseño y selección…"/>:step==='products'?<><BarcodeProductsStep purpose={purpose} defaultTiers={flow.design.priceTiers} onPriceTiers={flow.setPriceTiers} scope={filters} selected={flow.selected} errors={flow.productErrors} onSelect={flow.selectProduct} onRemove={flow.removeProduct} onCopies={flow.setCopies} onAssignment={flow.setAssignment} onRefresh={flow.refreshSelected} busy={flow.busy} canAssign={canAssign}/><div className="flex justify-end"><Button disabled={!selected.length||flow.busy} onClick={()=>setStep('settings')}>Configurar impresión<ArrowRight size={16}/></Button></div></>:step==='settings'?<>
      <BarcodePrintSettings paper={flow.paper} design={flow.design} onChange={paper=>{setInputError('');try{flow.setPaper(paper)}catch(e){setInputError(e instanceof Error?e.message:'Revisa el papel')}}} onEdit={edit} disabled={flow.busy}/>
      <section className="space-y-3"><h2 className="font-semibold">Usar una plantilla o diseñar la tuya</h2><div className="grid gap-3 sm:grid-cols-3">{previews.map(p=><button key={p.preset} type="button" className="barcode-template space-y-2" disabled={flow.busy} onClick={()=>setTemplateConfirm(p.preset)}><span className="block font-medium">{(shelf?{essential:'Precio sencillo',product:'Normal + mayoreo',price:'Comparativa con promoción'}:{essential:'Esencial',product:'Producto',price:'Producto con precio'})[p.preset]}</span><div className="flex h-28 items-center justify-center overflow-hidden"><BarcodeLabelCanvas design={p.design} scene={p.scene} zoom={.5}/></div></button>)}</div><Button variant="outline" disabled={flow.busy} onClick={edit}>Diseñar mi etiqueta</Button></section>
    </>:<section className="space-y-3">{flow.pdf?<>{shelf&&flow.prepared?.products.some(p=>p.warnings?.length)&&<div role="status" className="barcode-panel text-sm space-y-1">{flow.prepared.products.flatMap(p=>(p.warnings||[]).map((warning,i)=><p key={p.id+':'+i}>{p.name}: {warning}</p>))}</div>}<p className="text-sm text-muted-foreground">Este es el PDF que se descargará. Imprime al 100 %, sin ajustar a página.</p>{flow.pdf.guide&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setShowGuide(v=>!v)}>{showGuide?'Ver etiquetas':'Ver guía aparte'}</Button><Button variant="outline" disabled={printJob.pending} onClick={()=>void downloadTracked('GUIDE')}><Download size={16}/>Descargar guía</Button></div>}<PdfDocumentPreview pdf={showGuide&&flow.pdf.guide?flow.pdf.guide:flow.pdf.labels} onDownload={()=>void downloadTracked(showGuide&&flow.pdf?.guide?'GUIDE':'MAIN')}/><details className="barcode-panel"><summary className="cursor-pointer font-medium">Páginas por producto</summary><ul className="mt-3 grid gap-2 text-sm">{flow.pdf.plan.ranges.map(range=><li key={range.productId}>{flow.prepared?.products.find(p=>(flow.prepared?.snapshotVersion===2?labelSelectionKey(p):p.id)===range.productId)?.name} · {range.copies} copias · páginas {range.firstPage}–{range.lastPage}</li>)}</ul></details></>:<div className="barcode-panel text-sm text-muted-foreground">Seleccioná productos y prepará el PDF para revisar el documento final.</div>}</section>}
    {flow.busy&&<div role="status" className="barcode-panel flex flex-wrap items-center gap-3"><Loader2 size={18} className="animate-spin"/><span>{flow.progress.totalPages?`Generando página ${flow.progress.donePages} de ${flow.progress.totalPages}`:shelf?'Validando productos y precios…':'Preparando productos y códigos…'}</span><Button variant="outline" size="sm" onClick={flow.cancelGeneration}>Cancelar</Button></div>}
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Asignar códigos antes de imprimir" description={`Se guardará un código en ${missing} producto(s) sin código. No se cambiarán códigos existentes ni existencias. Si luego cancelas el PDF, estos códigos quedan guardados.`} confirmText="Asignar y preparar PDF" onConfirm={()=>{setConfirm(false);void doPrepare(true)}}/>
    <ConfirmDialog open={templateConfirm!==null} onOpenChange={open=>{if(!open)setTemplateConfirm(null)}} title="Usar plantilla" description="Se reemplaza el borrador para esta impresión. El diseño global de la empresa no cambia hasta que lo guardes desde el editor." confirmText="Usar plantilla" onConfirm={()=>{if(templateConfirm)flow.setDesign(makeTemplate(templateConfirm));setTemplateConfirm(null)}}/>
  </div>
}
