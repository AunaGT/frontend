import {useEffect,useMemo,useReducer,useRef,useState,type PointerEvent} from 'react'
import {ArrowLeft,Undo2,Redo2,ArrowUp,ArrowDown,Lock,Unlock,Eye,EyeOff,Trash2,Save,Type,Square} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {createCouponMeasure} from '@/modules/promotions/coupons/couponFonts'
import type {CouponMeasure} from '@/modules/promotions/coupons/couponPresentation'
import {pointerDelta,moveCouponBox} from '@/modules/promotions/coupons/couponEditorState'
import {createLabelTemplate,createShelfLabelTemplate,textStyle} from './labelDesign'
import {labelEditorReducer} from './labelEditorState'
import {prepareLabelScene} from './labelScene'
import {BarcodeLabelCanvas} from './BarcodeLabelCanvas'
import {BarcodeLabelProperties,LabelNumberInput} from './BarcodeLabelProperties'
import type {CouponFontId} from '@/modules/promotions/coupons/couponDesign'
import type {LabelDesign,LabelProduct,LabelElement,LabelField,LabelBox,PriceTier} from './types'
import './barcodeLabels.css'
const fieldNames:Record<LabelField,string>={name:'Producto',barcode:'Código legible',price:'Precio principal',brand:'Marca',size:'Presentación',company:'Empresa',price_label:'Nombre de tarifa principal',price_secondary:'Segundo precio',price_secondary_label:'Nombre segunda tarifa',price_tertiary:'Tercer precio',price_tertiary_label:'Nombre tercera tarifa',promotion_until:'Vigencia de promoción'}
const layerName=(e:LabelElement)=>e.kind==='barcode'?'Código de barras':e.kind==='field'?fieldNames[e.field]:e.kind==='text'?'Texto':e.shape==='line'?'Línea':'Forma'
export function BarcodeLabelEditor({design,onChange,product,branding,onSave,onBack,canSave,saving,error='',onReload,reloadVersion=0}:{design:LabelDesign;onChange:(design:LabelDesign)=>void;product:LabelProduct;branding:{companyName:string;currencyCode:string;locale:string;timezone?:string};onSave:(design:LabelDesign)=>Promise<void>;onBack:()=>void;canSave:boolean;saving:boolean;error?:string;onReload?:()=>void;reloadVersion?:number}){
  const [state,send]=useReducer(labelEditorReducer,{design,past:[],future:[],selectedId:null,zoom:1,error:''}),[measure,setMeasure]=useState<CouponMeasure|null>(null),[fontError,setFontError]=useState(''),[confirm,setConfirm]=useState<'essential'|'product'|'price'|'blank'|'back'|null>(null),[saveError,setSaveError]=useState(''),[saved,setSaved]=useState(design)
  const reloaded=useRef(reloadVersion)
  useEffect(()=>{if(reloaded.current!==reloadVersion){reloaded.current=reloadVersion;send({type:'DESIGN',design});setSaved(design);setSaveError('')}},[design,reloadVersion])
  const shelf=state.design.purpose==='shelf',makeTemplate=shelf?createShelfLabelTemplate:createLabelTemplate
  const committed=useRef(design),gesture=useRef<{id:string;box:LabelElement;start:{x:number;y:number};rect:{width:number;height:number};resize:boolean;patch:Partial<LabelBox>;svg:SVGSVGElement;pointerId:number}|null>(null)
  const [transient,setTransient]=useState<Partial<LabelBox>|null>(null),selected=state.design.elements.find(e=>e.id===state.selectedId),dirty=JSON.stringify(state.design)!==JSON.stringify(saved)
  useEffect(()=>{if(committed.current!==state.design){committed.current=state.design;onChange(state.design)}},[state.design,onChange])
  const fonts=state.design.elements.flatMap(e=>e.kind==='field'||e.kind==='text'?[e.style.font]:[]).sort().join(',')
  const fontIds=useMemo(()=>fonts.split(',').filter(Boolean) as CouponFontId[],[fonts])
  useEffect(()=>{let active=true;setFontError('');void createCouponMeasure(fontIds).then(m=>{if(active)setMeasure(()=>m)}).catch(e=>{if(active)setFontError(e.message)});return()=>{active=false}},[fontIds])
  const display=useMemo(()=>transient&&gesture.current?{...state.design,elements:state.design.elements.map(e=>e.id===gesture.current!.id?{...e,...transient}:e)}:state.design,[state.design,transient])
  const preview=useMemo(()=>{if(!measure)return{scene:null,error:''};try{return{scene:prepareLabelScene(product,display,measure,branding),error:''}}catch(e){return{scene:null,error:e instanceof Error?e.message:'Revisa la etiqueta'}}},[measure,product,display,branding])
  const begin=(id:string,event:PointerEvent<SVGGElement|SVGRectElement>,resize=false)=>{
    const box=state.design.elements.find(e=>e.id===id),svg=event.currentTarget.ownerSVGElement
    send({type:'SELECT',id});if(!box||box.locked||!svg)return
    event.preventDefault();svg.focus();svg.setPointerCapture(event.pointerId)
    gesture.current={id,box,start:{x:event.clientX,y:event.clientY},rect:svg.getBoundingClientRect(),resize,patch:{},svg,pointerId:event.pointerId}
  }
  const cancel=()=>{const g=gesture.current;if(g&&g.svg.hasPointerCapture(g.pointerId))g.svg.releasePointerCapture(g.pointerId);gesture.current=null;setTransient(null)}
  const move=(event:PointerEvent<SVGSVGElement>)=>{const g=gesture.current;if(!g)return;const delta=pointerDelta(g.start,{x:event.clientX,y:event.clientY},g.rect)
    g.patch=g.resize?{width:Math.max(.01,Math.min(1-g.box.x,g.box.width+delta.x)),height:Math.max(.01,Math.min(1-g.box.y,g.box.height+delta.y))}:moveCouponBox(g.box,delta.x,delta.y,false)
    setTransient(g.patch)
  }
  const finish=()=>{const g=gesture.current;if(g)send({type:'PATCH',id:g.id,patch:g.patch});cancel()}
  const applyTemplate=(name:'essential'|'product'|'price'|'blank')=>{if(dirty)setConfirm(name);else send({type:'DESIGN',design:makeTemplate(name==='blank'?'essential':name)})}
  const add=(kind:'text'|'shape'|LabelField)=>{
    const base={id:crypto.randomUUID(),x:.03,y:.03,width:.4,height:.15,visible:true,locked:false}
    const element:LabelElement=kind==='text'?{...base,kind,text:'Texto personalizado',style:textStyle()}:kind==='shape'?{...base,kind,shape:'rect',color:'#eeeeee',borderColor:'#111111',borderWidth:0}:{...base,kind:'field',field:kind,style:textStyle()}
    send({type:'ADD',element})
  }
  const toggleBarcode=()=>{
    if(state.design.elements.some(e=>e.kind==='barcode')){send({type:'DESIGN',design:{...state.design,elements:state.design.elements.filter(e=>e.kind!=='barcode'&&!(e.kind==='field'&&e.field==='barcode'))}});return}
    const oldHeight=state.design.heightMm,contentHeight=Math.ceil(Math.max(...state.design.elements.map(e=>(e.y+e.height)*oldHeight))-1e-8),barHeight=state.design.barcodeType==='code128'?12:24,height=Math.max(oldHeight,contentHeight+barHeight+10)
    if(height>200){setFontError('Reduce la altura antes de añadir el código de barras');return}
    const elements=state.design.elements.map(e=>({...e,y:e.y*oldHeight/height,height:e.height*oldHeight/height}))
    elements.push({id:'bars',kind:'barcode',x:.04,y:(contentHeight+1)/height,width:.92,height:barHeight/height,visible:true,locked:false})
    elements.push({id:'value',kind:'field',field:'barcode',style:{...textStyle(false,7),align:'center'},x:.04,y:(contentHeight+barHeight+3)/height,width:.92,height:4/height,visible:true,locked:false})
    send({type:'DESIGN',design:{...state.design,heightMm:height,elements}})
  }
  const icon=(label:string,Icon:typeof Save,onClick:()=>void,disabled=false)=><Button type="button" size="icon" variant="outline" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={16}/></Button>
  const saveCurrent=async()=>{setSaveError('');try{await onSave(state.design);setSaved(state.design)}catch(e){setSaveError(e instanceof Error?e.message:'No se pudo guardar')}}
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>dirty?setConfirm('back'):onBack()}><ArrowLeft size={16}/>Volver a impresión</Button>{icon('Deshacer',Undo2,()=>send({type:'UNDO'}),!state.past.length)}{icon('Rehacer',Redo2,()=>send({type:'REDO'}),!state.future.length)}<Label className="flex items-center gap-2">Zoom<select className="barcode-select !w-24" value={state.zoom} onChange={e=>send({type:'ZOOM',zoom:Number(e.target.value)})}>{[.5,1,1.5,2,3].map(n=><option key={n} value={n}>{n*100}%</option>)}</select></Label></div><Button disabled={!canSave||saving||!measure||!!preview.error||!!fontError} onClick={saveCurrent}><Save size={16}/>{saving?'Guardando…':'Guardar para la empresa'}</Button></div>
    {!canSave&&<p className="text-sm text-muted-foreground">Podés usar este diseño temporalmente. Guardarlo para toda la empresa requiere una sucursal seleccionada y permiso de configuración.</p>}
    {(state.error||preview.error||fontError||saveError||error)&&<div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{state.error||preview.error||fontError||saveError||error}{onReload&&<Button size="sm" variant="outline" className="ml-3" onClick={onReload}>Recargar diseño guardado</Button>}</div>}
    <div className="barcode-editor-grid">
      <section className="barcode-panel space-y-4"><h2 className="font-semibold">Etiqueta</h2><div className="grid grid-cols-2 gap-2">{(['widthMm','heightMm'] as const).map(k=><Label key={k} className="space-y-1 text-xs">{k==='widthMm'?'Ancho':'Alto'} (mm)<LabelNumberInput step="1" value={state.design[k]} onCommit={value=>send({type:'DESIGN',design:{...state.design,[k]:value}})}/></Label>)}</div>
        {shelf&&<><Label className="block space-y-1">Precio destacado<select className="barcode-select" value={state.design.primaryTier||'LIST'} onChange={e=>send({type:'DESIGN',design:{...state.design,primaryTier:e.target.value as PriceTier}})}><option value="LIST">Normal, si está seleccionado</option><option value="WHOLESALE">Mayoreo, si está seleccionado</option><option value="PROMOTION">Promoción vigente, si está seleccionada</option></select></Label><Button variant="outline" onClick={toggleBarcode}>{state.design.elements.some(e=>e.kind==='barcode')?'Quitar código de barras':'Añadir código de barras'}</Button><p className="text-xs text-muted-foreground">Opcional: utiliza el código existente. No se asignarán códigos a productos sin uno.</p></>}
        <Label className="block space-y-1">Tipo de código<select className="barcode-select" value={state.design.barcodeType} onChange={e=>send({type:'DESIGN',design:{...state.design,barcodeType:e.target.value as LabelDesign['barcodeType']}})}>{[['code128','Code 128 · interno'],['ean13','EAN-13'],['ean8','EAN-8'],['upca','UPC-A']].map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></Label>
        <div className="space-y-2"><h3 className="text-sm font-medium">Plantillas</h3>{(['essential','product','price','blank'] as const).map(name=><Button key={name} variant="outline" className="w-full justify-start" onClick={()=>applyTemplate(name)}>{(shelf?{essential:'Precio sencillo',product:'Normal + mayoreo',price:'Comparativa con promoción',blank:'Diseñar mi etiqueta'}:{essential:'Esencial',product:'Producto',price:'Producto con precio',blank:'Diseñar mi etiqueta'})[name]}</Button>)}</div>
        <div className="space-y-2"><h3 className="text-sm font-medium">Agregar</h3><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>add('text')}><Type size={14}/>Texto</Button><Button size="sm" variant="outline" onClick={()=>add('shape')}><Square size={14}/>Forma</Button></div><select aria-label="Agregar campo" className="barcode-select" value="" onChange={e=>{if(e.target.value)add(e.target.value as LabelField)}}><option value="">Campo del producto…</option>{Object.entries(fieldNames).filter(([field])=>(shelf?field!=='barcode':['name','barcode','price','brand','size','company'].includes(field))&&!state.design.elements.some(e=>e.kind==='field'&&e.field===field)).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
        <div className="space-y-1"><h3 className="text-sm font-medium">Capas</h3>{[...state.design.elements].reverse().map(e=><button key={e.id} type="button" className={`block w-full rounded-md px-2 py-2 text-left text-sm ${e.id===state.selectedId?'bg-primary/10 text-primary':'hover:bg-muted'}`} aria-pressed={e.id===state.selectedId} onClick={()=>send({type:'SELECT',id:e.id})}>{layerName(e)}{e.locked?' · bloqueada':''}{!e.visible?' · oculta':''}</button>)}</div>
      </section>
      <section className="barcode-panel space-y-3"><div className="flex justify-between text-sm"><strong>{product.name}</strong><span className="text-muted-foreground">{state.design.widthMm} × {state.design.heightMm} mm</span></div><div className="barcode-workspace"><BarcodeLabelCanvas scene={preview.scene} design={display} selection={state.selectedId} zoom={state.zoom} onSelect={id=>send({type:'SELECT',id})} onBeginMove={(id,e)=>begin(id,e)} onBeginResize={(id,e)=>begin(id,e,true)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={e=>{if(e.key==='Escape'){cancel();return}if(!state.selectedId||!e.key.startsWith('Arrow'))return;e.preventDefault();const element=state.design.elements.find(x=>x.id===state.selectedId);if(!element)return;const step=e.shiftKey?.02:.002;send({type:'PATCH',id:element.id,patch:moveCouponBox(element,e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0,false)})}}/></div><p className="text-xs text-muted-foreground">Arrastrá las capas o usa las posiciones numéricas. Las flechas del teclado también permiten moverlas; Shift aumenta el paso.</p></section>
      <section className="barcode-panel barcode-properties space-y-3"><h2 className="font-semibold">{selected?layerName(selected):'Propiedades'}</h2>{selected?<><div className="flex flex-wrap gap-1">{icon('Subir capa',ArrowUp,()=>send({type:'ORDER',id:selected.id,direction:1}),selected.locked)}{icon('Bajar capa',ArrowDown,()=>send({type:'ORDER',id:selected.id,direction:-1}),selected.locked)}{icon(selected.locked?'Desbloquear':'Bloquear',selected.locked?Unlock:Lock,()=>send({type:'PATCH',id:selected.id,patch:{locked:!selected.locked}}))}{icon(selected.visible?'Ocultar':'Mostrar',selected.visible?EyeOff:Eye,()=>send({type:'PATCH',id:selected.id,patch:{visible:!selected.visible}}),selected.locked||selected.kind==='barcode'||selected.kind==='field'&&selected.field==='barcode')}{icon('Eliminar capa',Trash2,()=>send({type:'DELETE',id:selected.id}),selected.locked||selected.kind==='barcode'||selected.kind==='field'&&selected.field==='barcode')}</div><div className="flex flex-wrap gap-1">{(['left','center','right'] as const).map(align=><Button key={align} size="sm" variant="outline" disabled={selected.locked} onClick={()=>send({type:'PATCH',id:selected.id,patch:{x:align==='left'?0:align==='center'?(1-selected.width)/2:1-selected.width}})}>{{left:'Izquierda',center:'Centrar',right:'Derecha'}[align]}</Button>)}</div><BarcodeLabelProperties element={selected} design={state.design} onChange={patch=>send({type:'PATCH',id:selected.id,patch})}/></>:<p className="text-sm text-muted-foreground">Selecciona una capa en el lienzo o la lista.</p>}</section>
    </div>
    <ConfirmDialog open={confirm!==null} onOpenChange={open=>{if(!open)setConfirm(null)}} title={confirm==='back'?'Volver sin guardar globalmente':'Cambiar plantilla'} description={confirm==='back'?'El borrador se conserva para esta impresión, pero no reemplaza el diseño de la empresa.':'Se reemplaza tu borrador por la plantilla. Podés deshacerlo antes de guardar.'} confirmText="Continuar" onConfirm={()=>{if(confirm==='back')onBack();else if(confirm)send({type:'DESIGN',design:makeTemplate(confirm==='blank'?'essential':confirm)});setConfirm(null)}}/>
  </div>
}
