import {useEffect,useMemo,useReducer,useRef,useState,type KeyboardEvent,type PointerEvent,type ReactNode} from 'react'
import {Undo2,Redo2,Type,Square,Circle,Star,Badge,Minus,AlignStartVertical,AlignCenterVertical,AlignEndVertical,AlignStartHorizontal,AlignCenterHorizontal,AlignEndHorizontal,ArrowUp,ArrowDown,Lock,Unlock,Eye,EyeOff,Copy,Trash2,RotateCcw,Eraser,ImagePlus,ArrowLeft,CodeXml,MousePointer2,CircleCheck,CircleAlert} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select'
import {ImageUploadDropzone} from '@/components/ui/image-upload-dropzone'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {ModuleTabBar} from '@/components/shared/ModuleTabs'
import {CouponCanvas,type CouponAssets,type CouponAsset} from './CouponCanvas'
import {CouponProperties,GradientFields} from './CouponProperties'
import {CouponSheetPreview} from './CouponSheetPreview'
import {CouponCodePanel} from './CouponCodePanel'
import {COUPON_ASPECT,COUPON_FIELD_LABELS,textStyle,couponAssetIds,couponHeight,type CouponDesign,type CouponElement,type CouponField,type CouponShape} from './couponDesign'
import {COUPON_CODE_FIELDS,COUPON_CODE_SCHEMA,COUPON_CODE_VALUES,couponCodeStyleProperties,parseCouponCode,serializeCouponDesign,type CouponCodeRange,type CouponCodeResult} from './couponCode'
import {prepareCouponScene,getCouponPrintLayout,type CouponData} from './couponPresentation'
import {useCouponMeasure} from './useCouponMeasure'
import {couponEditorReducer,pointerDelta,moveCouponBox,type CouponEditorAction} from './couponEditorState'
import './couponEditor.css'

type Mode='visual'|'code'
type CodeState={text:string;result:CouponCodeResult;dirty:boolean}
interface Props{value:CouponDesign;onChange:(value:CouponDesign)=>void;data:CouponData;assets:CouponAssets;logoUrl?:string;onUpload:(file:File)=>Promise<CouponAsset>;onBack:()=>void;banner?:ReactNode;disabled?:boolean}
const MODES=[{value:'visual' as const,label:'Visual',icon:MousePointer2},{value:'code' as const,label:'Código',icon:CodeXml}]
const PREFIX={text:'texto',image:'imagen',shape:'forma'} as const
const SHAPE_LABELS:Record<CouponShape,string>={rect:'Rectángulo',line:'Línea',ellipse:'Elipse',star:'Estrella',badge:'Sello'}

export function CouponEditor({value,onChange,data,assets,logoUrl,onUpload,onBack,banner,disabled=false}:Props){
  const [state,dispatch]=useReducer((state,action:CouponEditorAction)=>couponEditorReducer(state,action,data.requiredFields),{design:value,past:[],future:[],selectedId:null,zoom:1})
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[uploading,setUploading]=useState(false),[reset,setReset]=useState<'template'|'blank'|null>(null),[preview,setPreview]=useState(false),[panel,setPanel]=useState('canvas')
  const [moving,setMoving]=useState<CouponDesign|null>(null)
  const [mode,setMode]=useState<Mode>('visual'),[code,setCode]=useState<CodeState|null>(null),[reveal,setReveal]=useState<CouponCodeRange|null>(null),[leave,setLeave]=useState<Mode|'back'|null>(null)
  const drag=useRef<{id:string;resize:boolean;start:{x:number;y:number};rect:DOMRect;design:CouponDesign;target:SVGSVGElement;pointerId:number}|null>(null)
  const alive=useRef(true),committed=useRef(value),applied=useRef<CouponDesign|null>(null),clipboard=useRef<Exclude<CouponElement,{kind:'field'}>|null>(null)
  const liveState=useRef(state);liveState.current=state
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  // La vista trabaja sobre el borrador de la promoción: cada cambio aceptado llega al formulario.
  useEffect(()=>{if(state.design!==committed.current){committed.current=state.design;onChange(state.design)}},[state.design,onChange])
  const parse=(text:string,dirty:boolean):CodeState=>({text,dirty,result:parseCouponCode(text,{requiredFields:data.requiredFields})})
  // Deshacer/rehacer o restaurar con el código abierto regeneran el texto desde el modelo.
  useEffect(()=>{if(mode==='code'&&state.design!==applied.current)setCode(parse(serializeCouponDesign(state.design),false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.design])
  // Lo escrito se aplica tras una pausa, como un solo paso de deshacer.
  useEffect(()=>{
    if(mode!=='code'||!code?.dirty||!code.result.ok)return
    const design=code.result.design,timer=setTimeout(()=>{applied.current=design;dispatch({type:'DESIGN',design})},300)
    return()=>clearTimeout(timer)
  },[code,mode])
  const current=moving||state.design,selected=current.elements.find(e=>e.id===state.selectedId)
  // El lienzo espera las fuentes que usa el diseño: nunca se mide con una fuente de reemplazo.
  const {measure,error:fontError}=useCouponMeasure(current)
  const scene=useMemo(()=>measure?prepareCouponScene(current,data,measure):null,[current,data,measure])
  const guides:{axis:'x'|'y';position:number}[]=selected&&moving?(['x','y']as const).flatMap(axis=>{
    const size=axis==='x'?selected.width:selected.height,position=selected[axis]
    const anchor=[.025,.5-size/2,.975-size].find(a=>Math.abs(a-position)<.00001)
    return anchor===undefined?[]:[{axis,position:(anchor===.5-size/2?.5:anchor===.975-size?.975:.025)*(axis==='x'?1000:couponHeight(current))}]
  }):[]
  const send=(action:CouponEditorAction)=>{setError('');setNotice('');dispatch(action)}
  const add=(element:CouponElement)=>{if(current.elements.length>=30){setError('El diseño admite hasta 30 elementos.');return}send({type:'ADD',element})}
  // Ids legibles (texto-1, imagen-2…) para que el código sea fácil de leer.
  const nextId=(prefix:string)=>{const used=new Set(current.elements.map(e=>e.id));let n=1;while(used.has(`${prefix}-${n}`))n++;return`${prefix}-${n}`}
  const base=(prefix:string)=>({id:nextId(prefix),x:.1,y:.2,width:.5,height:.1,visible:true,locked:false,opacity:1})
  const addShape=(shape:CouponShape)=>add({...base(PREFIX.shape),...(shape==='line'?{height:.02}:shape==='rect'?{}:{width:.18,height:.25}),kind:'shape',shape,color:shape==='line'?'#0c203a':shape==='rect'?'#ffffff':'#ff6f00',borderColor:'#0c203a',borderWidth:shape==='line'?2:shape==='rect'?1:0,radius:shape==='rect'?12:0})
  // Alinea respecto al cupón dejando el margen seguro de 2,5 %.
  const alignTo=(axis:'x'|'y',where:'start'|'center'|'end')=>{if(!selected)return;const size=axis==='x'?selected.width:selected.height
    send({type:'PATCH',id:selected.id,patch:{[axis]:where==='start'?Math.min(.025,1-size):where==='center'?(1-size)/2:Math.max(0,.975-size)}})}
  const start=(id:string,event:PointerEvent<SVGElement>,resize:boolean)=>{
    if(disabled||preview||mode==='code')return
    const element=current.elements.find(e=>e.id===id);if(!element||element.locked)return
    const svg=event.currentTarget.ownerSVGElement!;svg.focus();svg.setPointerCapture(event.pointerId)
    drag.current={id,resize,start:{x:event.clientX,y:event.clientY},rect:svg.getBoundingClientRect(),design:state.design,target:svg,pointerId:event.pointerId}
    event.preventDefault()
  }
  const cancel=()=>{if(drag.current?.target.hasPointerCapture(drag.current.pointerId))drag.current.target.releasePointerCapture(drag.current.pointerId);drag.current=null;setMoving(null)}
  const upload=async(file:File,target:'layer'|'background'|'replace'|'design')=>{
    if(couponAssetIds(current).length>=5 && target==='layer'){setError('El diseño admite hasta cinco imágenes propias.');return}
    setUploading(true);setError('')
    try{
      const asset=await onUpload(file);if(!alive.current)return
      if(target==='design'){
        // El cupón toma la proporción de la imagen, dentro de 1:2…3:1; si hubo que limitarla se avisa.
        const ratio=asset.width/asset.height,aspect=Math.round(Math.min(COUPON_ASPECT.max,Math.max(COUPON_ASPECT.min,ratio))*1000)/1000
        send({type:'IMAGE_DESIGN',assetId:asset.id,aspect})
        if(ratio>COUPON_ASPECT.max)setNotice('Tu imagen es más alargada que 3:1: el cupón usa 3:1 y la imagen se recorta lo mínimo a los lados.')
        else if(ratio<COUPON_ASPECT.min)setNotice('Tu imagen es más alta que 1:2: el cupón usa 1:2 y la imagen se recorta lo mínimo arriba y abajo.')
      }
      else if(target==='background')send({type:'DESIGN',design:{...liveState.current.design,background:{kind:'image',assetId:asset.id,fit:'cover',focalX:.5,focalY:.5}}})
      else if(target==='replace'&&selected?.kind==='image')send({type:'PATCH',id:selected.id,patch:{assetId:asset.id} as Partial<CouponElement>})
      else add({...base(PREFIX.image),kind:'image',assetId:asset.id,fit:'contain',focalX:.5,focalY:.5,width:.3,height:.3})
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'No se pudo cargar la imagen')}finally{if(alive.current)setUploading(false)}
  }
  const dropzone=(target:'layer'|'background'|'replace'|'design')=><ImageUploadDropzone accept="image/png,image/jpeg,image/webp" fileLabel={target==='design'?'diseño del cupón':'imagen del cupón'} disabled={disabled||uploading} isUploading={uploading} onFileSelect={file=>void upload(file,target)} onReject={setError} helperText="PNG, JPG o WebP · Máx. 5 MB"/>
  const layerLabel=(e:CouponElement)=>e.kind==='field'?COUPON_FIELD_LABELS[e.field]:e.kind==='text'?e.text.slice(0,30)||'Texto':e.kind==='image'?'Imagen':SHAPE_LABELS[e.shape]
  const iconButton=(label:string,Icon:typeof Undo2,action:()=>void,blocked=false,className?:string)=><Button type="button" size="icon" variant="outline" className={className} aria-label={label} title={label} disabled={disabled||blocked} onClick={action}><Icon className="h-4 w-4" aria-hidden="true"/></Button>

  // Aplica de inmediato lo escrito y aún no aplicado, para no perderlo al salir del código.
  const flush=()=>{
    if(!code?.dirty||!code.result.ok||code.result.design===applied.current)return
    const design=code.result.design;applied.current=design;committed.current=design;onChange(design);dispatch({type:'DESIGN',design})
  }
  // Atajos comunes de editor; nunca mientras se escribe en un campo ni en el modo código.
  const shortcut=(event:KeyboardEvent<Element>)=>{
    const target=event.target as HTMLElement|null,mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase()
    if(event.defaultPrevented||mode==='code'||preview||disabled||target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName??''))return
    const run=(action:()=>void)=>{event.preventDefault();action()}
    const free=selected&&selected.kind!=='field'?selected:null,textSelected=typeof window!=='undefined'&&!!window.getSelection?.()?.toString()
    if(event.key==='Escape')return run(()=>{cancel();send({type:'SELECT',id:null})})
    if(mod&&key==='z')return run(()=>send({type:event.shiftKey?'REDO':'UNDO'}))
    if(mod&&key==='y')return run(()=>send({type:'REDO'}))
    if(mod&&key==='v'&&clipboard.current){const e=clipboard.current;return run(()=>add({...structuredClone(e),id:nextId(PREFIX[e.kind]),locked:false,x:Math.min(e.x+.02,1-e.width),y:Math.min(e.y+.02,1-e.height)}))}
    if(!selected)return
    if(event.key==='Delete'||event.key==='Backspace')return run(()=>send({type:'DELETE',id:selected.id}))
    if(mod&&key==='d'&&free)return run(()=>send({type:'DUPLICATE',id:free.id,newId:nextId(PREFIX[free.kind])}))
    if(mod&&key==='c'&&free&&!textSelected)return run(()=>{clipboard.current=structuredClone(free)})
    if(mod&&(event.key===']'||event.key==='['))return run(()=>send({type:'ORDER',id:selected.id,direction:event.key===']'?1:-1}))
    const step=event.shiftKey?.01:.001,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0
    if(!mod&&(dx||dy))run(()=>send({type:'MOVE',id:selected.id,dx,dy}))
  }
  const invalidCode=mode==='code'&&!!code&&!code.result.ok
  const switchMode=(next:Mode)=>{
    if(next===mode)return
    if(next==='code'){cancel();setCode(parse(serializeCouponDesign(state.design),false));setMode('code');return}
    if(invalidCode){setLeave(next);return}
    flush();setMode('visual');setCode(null)
  }
  const back=()=>{if(uploading)return;if(invalidCode){setLeave('back');return};cancel();flush();onBack()}
  const onCursor=(offset:number)=>{
    if(!code?.result.ok)return
    const hit=Object.entries(code.result.ranges).find(([,range])=>offset>=range.from&&offset<=range.to)
    if(hit&&hit[0]!==state.selectedId)dispatch({type:'SELECT',id:hit[0]})
  }
  const select=(id:string)=>{send({type:'SELECT',id});if(mode==='code'&&code?.result.ok&&code.result.ranges[id])setReveal({...code.result.ranges[id]})}

  const workspace=<section className="coupon-editor-workspace" data-mobile-hidden={mode==='visual'&&panel!=='canvas'} aria-label="Área de diseño"><div className="mx-auto max-w-[780px] bg-white shadow-sm" style={current.aspect?{maxWidth:Math.min(780,Math.round(560*current.aspect))}:undefined}>
    {preview&&measure?<CouponSheetPreview design={current} data={[data]} assets={assets} logoUrl={logoUrl} measure={measure}/>:scene?<CouponCanvas scene={scene} assets={assets} logoUrl={logoUrl} selectedId={state.selectedId} zoom={state.zoom} previewOnly={preview} guides={guides} onSelect={select} onBeginMove={(id,e)=>start(id,e,false)} onBeginResize={(id,e)=>start(id,e,true)} onPointerCancel={cancel} onPointerMove={event=>{
      const d=drag.current;if(!d)return;const delta=pointerDelta(d.start,{x:event.clientX,y:event.clientY},d.rect),next=structuredClone(d.design),e=next.elements.find(e=>e.id===d.id)!
      if(d.resize&&e.kind==='image'){
        // Las imágenes conservan su proporción: manda el eje que más se movió (ancho y alto exactos se escriben en Propiedades).
        const ratio=e.height/e.width,scale=Math.abs(delta.x/e.width)>=Math.abs(delta.y/e.height)?1+delta.x/e.width:1+delta.y/e.height
        e.width=Math.max(.02,.02/ratio,Math.min(e.width*scale,1-e.x,(1-e.y)/ratio));e.height=e.width*ratio
      }else if(d.resize){e.width=Math.max(.02,Math.min(1-e.x,e.width+delta.x));e.height=Math.max(.02,Math.min(1-e.y,e.height+delta.y))}else Object.assign(e,moveCouponBox(e,delta.x,delta.y))
      setMoving(next)
    }} onPointerUp={()=>{if(moving)send({type:'DESIGN',design:moving});cancel()}} onKeyDown={shortcut}/>:<div className="grid place-items-center text-sm text-muted-foreground" style={{aspectRatio:'1000/720'}} aria-busy={!fontError}>{fontError?'No se pudo cargar la fuente. Deshaz el cambio o elige otra fuente.':'Cargando fuentes del cupón…'}</div>}
  </div><p className="mt-3 text-xs text-muted-foreground">{preview?'El PDF conserva esta composición, sin guías.':mode==='code'?'Haz clic en una capa para ubicarla en el código.':'Arrastra una capa · Flechas: mover (Shift: más) · Supr: eliminar · Ctrl+Z / Ctrl+Y: deshacer / rehacer · Ctrl+D: duplicar · Ctrl+C / Ctrl+V: copiar / pegar · Ctrl+[ / Ctrl+]: orden · Esc: soltar'}</p>
    {!!scene?.issues.length&&<ul className="mt-3 space-y-1 text-xs" aria-live="polite">{scene.issues.map((issue,i)=><li key={i} className={issue.severity==='error'?'text-destructive':'text-muted-foreground'}>{issue.message}</li>)}</ul>}
    {scene?.nodes.filter(n=>n.kind==='image'&&'assetId'in n.source&&assets.has(n.source.assetId)).map(n=>{
      if(n.kind!=='image'||!('assetId'in n.source))return null
      const asset=assets.get(n.source.assetId)!,mm=getCouponPrintLayout(current.printPreset,current.aspect).tileWidth,dpi=Math.min(asset.width/(n.width*mm/1000/25.4),asset.height/(n.height*mm/1000/25.4))
      return dpi<150?<p key={n.id} className="mt-2 text-xs text-muted-foreground">Imagen de baja resolución para este tamaño. Usa una imagen más grande para imprimir con nitidez.</p>:null
    })}
  </section>

  const errors=code?.result.ok===false?code.result.errors:[]
  // Los eventos de diálogos y menús (portales) no cuentan: solo lo que ocurre dentro del diseñador.
  return <div className="coupon-designer" onKeyDown={event=>{if(event.currentTarget.contains(event.target as Node))shortcut(event)}}>
    <h1 className="sr-only">Diseño del cupón</h1>
    <div className="auna-page-toolbar coupon-designer-toolbar">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={uploading} onClick={back}><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Volver a la promoción</Button>
        <ModuleTabBar items={MODES} value={mode} onValueChange={switchMode} ariaLabel="Modo de edición"/>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {iconButton('Deshacer',Undo2,()=>send({type:'UNDO'}),!state.past.length)}{iconButton('Rehacer',Redo2,()=>send({type:'REDO'}),!state.future.length)}
        <Label className="sr-only" htmlFor="coupon-zoom">Zoom</Label><Select value={String(state.zoom)} onValueChange={zoom=>send({type:'ZOOM',zoom:Number(zoom)})}><SelectTrigger id="coupon-zoom" className="w-24"><SelectValue/></SelectTrigger><SelectContent>{[.5,.75,1,1.5,2].map(z=><SelectItem key={z} value={String(z)}>{z*100}%</SelectItem>)}</SelectContent></Select>
        <Button type="button" variant="outline" onClick={()=>send({type:'ZOOM',zoom:1})}>Ajustar</Button>
        <Button type="button" variant="outline" aria-pressed={preview} onClick={()=>setPreview(!preview)}><Eye className="h-4 w-4"/>Vista de impresión</Button>
        <Select value={current.printPreset} disabled={disabled} onValueChange={printPreset=>send({type:'DESIGN',design:{...state.design,printPreset:printPreset as CouponDesign['printPreset']}})}><SelectTrigger className="w-44" aria-label="Tamaño de impresión"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="standard">Estándar · 4 por hoja</SelectItem><SelectItem value="large">Grande · 2 por hoja</SelectItem></SelectContent></Select>
        <Button type="button" variant="ghost" disabled={disabled} onClick={()=>setReset('blank')}><Eraser className="h-4 w-4"/>Empezar en blanco</Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={()=>setReset('template')}><RotateCcw className="h-4 w-4"/>Restaurar</Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Los datos del cupón se actualizan con la promoción. El diseño se guarda con «Guardar promoción».</p>
    {banner}
    {(error||fontError)&&<p role="alert" className="text-sm text-destructive">{error||fontError}</p>}
    {notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {mode==='visual'?<>
      <div className="coupon-editor-mobile-tabs gap-2">{[['tools','Herramientas'],['canvas','Lienzo'],['properties','Propiedades']].map(([id,label])=><Button key={id} type="button" variant={panel===id?'default':'outline'} aria-pressed={panel===id} onClick={()=>setPanel(id)}>{label}</Button>)}</div>
      <div className="coupon-editor-grid">
        <section className="coupon-editor-panel space-y-4" data-mobile-hidden={panel!=='tools'} aria-label="Herramientas y capas">
          <h2 className="text-sm font-semibold">Agregar al cupón</h2>
          <Select value="" disabled={disabled} onValueChange={field=>add({...base('campo'),id:'field-'+field,kind:'field',field:field as CouponField,style:textStyle({fontSize:26,color:'#0c203a'})})}><SelectTrigger aria-label="Agregar campo"><SelectValue placeholder="Agregar campo…"/></SelectTrigger><SelectContent>{Object.entries(COUPON_FIELD_LABELS).map(([field,label])=>{
            // Cada campo va una sola vez: los que ya están se listan deshabilitados en vez de dejar el menú vacío.
            const present=current.elements.some(e=>e.kind==='field'&&e.field===field)
            return <SelectItem key={field} value={field} disabled={present}>{label}{present?' · ya está en el cupón':''}</SelectItem>
          })}</SelectContent></Select>
          <div className="flex flex-wrap gap-2">{iconButton('Agregar texto',Type,()=>add({...base(PREFIX.text),kind:'text',text:'Tu texto',style:textStyle({fontSize:26,color:'#0c203a'})}))}{iconButton('Agregar rectángulo',Square,()=>addShape('rect'))}{iconButton('Agregar elipse',Circle,()=>addShape('ellipse'))}{iconButton('Agregar estrella',Star,()=>addShape('star'))}{iconButton('Agregar sello',Badge,()=>addShape('badge'))}{iconButton('Agregar línea',Minus,()=>addShape('line'))}</div>
          <details><summary className="cursor-pointer text-sm font-medium">Diseño desde mi imagen</summary><div className="mt-2 space-y-2"><p className="text-xs text-muted-foreground">El cupón toma la forma de tu imagen y quedan solo los campos obligatorios, para que agregues los que necesites. Se puede deshacer.</p>{dropzone('design')}</div></details>
          <details><summary className="cursor-pointer text-sm font-medium">Imagen propia</summary><div className="mt-2">{dropzone('layer')}</div></details>
          <details><summary className="cursor-pointer text-sm font-medium">Fondo</summary><div className="mt-2 space-y-2">
            {current.aspect&&<div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>Proporción {current.aspect.toLocaleString('es-GT')} : 1 (ancho : alto)</span><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={()=>{const {aspect:_aspect,...standard}=state.design;send({type:'DESIGN',design:standard})}}>Proporción estándar</Button></div>}
            <Select value={current.background.kind} disabled={disabled} onValueChange={kind=>{if(kind==='image')return;send({type:'DESIGN',design:{...state.design,background:kind==='solid'?{kind:'solid',color:'#0c203a'}:{kind:'gradient',from:'#0c203a',to:'#ff6f00'}}})}}><SelectTrigger aria-label="Tipo de fondo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="solid">Color</SelectItem><SelectItem value="gradient">Degradado</SelectItem><SelectItem value="image">Imagen</SelectItem></SelectContent></Select>
            {current.background.kind==='solid'&&<Label className="grid gap-1 text-xs">Color<Input type="color" disabled={disabled} value={current.background.color} onChange={event=>send({type:'DESIGN',design:{...state.design,background:{kind:'solid',color:event.target.value}}})}/></Label>}
            {current.background.kind==='gradient'&&<GradientFields classic value={current.background} disabled={disabled} onChange={({from,to,via,angle})=>send({type:'DESIGN',design:{...state.design,background:{kind:'gradient',from,to,...(via?{via}:{}),...(angle===undefined?{}:{angle})}}})}/>}
            {dropzone('background')}
            {current.background.kind==='image'&&<><Select value={current.background.fit} onValueChange={fit=>send({type:'DESIGN',design:{...state.design,background:{...current.background,fit} as CouponDesign['background']}})}><SelectTrigger aria-label="Ajuste de fondo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="contain">Imagen completa</SelectItem><SelectItem value="cover">Llenar / recortar</SelectItem></SelectContent></Select>{(['focalX','focalY']as const).map(key=><Label key={key} className="grid gap-1">{key==='focalX'?'Foco horizontal':'Foco vertical'} (%)<Input type="number" min={0} max={100} value={current.background.kind==='image'?current.background[key]*100:50} onChange={event=>send({type:'DESIGN',design:{...state.design,background:{...current.background,[key]:Number(event.target.value)/100}}})}/></Label>)}</>}
          </div></details>
          <Label className="grid gap-1 text-xs">Condiciones adicionales (opcionales)<Textarea maxLength={500} disabled={disabled} value={current.terms} onChange={event=>send({type:'DESIGN',design:{...state.design,terms:event.target.value}})}/><span className="text-muted-foreground">{current.terms.length}/500 · No modifica las reglas de canje.</span></Label>
          <h2 className="text-sm font-semibold">Capas · {current.elements.length}/30</h2>
          <ul className="space-y-1">{[...current.elements].reverse().map(e=><li key={e.id}><Button type="button" variant={state.selectedId===e.id?'secondary':'ghost'} className="w-full justify-start gap-2 text-left" onClick={()=>send({type:'SELECT',id:e.id})}>{e.locked?<Lock className="h-3 w-3"/>:e.kind==='image'?<ImagePlus className="h-3 w-3"/>:null}<span className="truncate">{layerLabel(e)}</span>{!e.visible&&<EyeOff className="ml-auto h-3 w-3"/>}</Button></li>)}</ul>
        </section>
        {workspace}
        <section className="coupon-editor-panel" data-mobile-hidden={panel!=='properties'} aria-label="Propiedades de la capa">
          {selected?<><h2 className="mb-3 text-sm font-semibold">{layerLabel(selected)}</h2><div className="mb-1 grid grid-cols-6 gap-1">
            {iconButton('Subir capa',ArrowUp,()=>send({type:'ORDER',id:selected.id,direction:1}),selected.locked,'w-full')}{iconButton('Bajar capa',ArrowDown,()=>send({type:'ORDER',id:selected.id,direction:-1}),selected.locked,'w-full')}
            {iconButton(selected.locked?'Desbloquear':'Bloquear',selected.locked?Unlock:Lock,()=>send({type:'PATCH',id:selected.id,patch:{locked:!selected.locked}}),false,'w-full')}
            {iconButton(selected.visible?'Ocultar':'Mostrar',selected.visible?EyeOff:Eye,()=>send({type:'PATCH',id:selected.id,patch:{visible:!selected.visible}}),selected.kind==='field'&&data.requiredFields.includes(selected.field),'w-full')}
            {iconButton('Duplicar',Copy,()=>{if(selected.kind!=='field')send({type:'DUPLICATE',id:selected.id,newId:nextId(PREFIX[selected.kind])})},selected.kind==='field','w-full')}{iconButton('Eliminar',Trash2,()=>send({type:'DELETE',id:selected.id}),selected.locked||selected.kind==='field'&&data.requiredFields.includes(selected.field),'w-full')}
          </div><div className="mb-3 grid grid-cols-6 gap-1" role="group" aria-label="Alinear en el cupón">
            {iconButton('Alinear a la izquierda',AlignStartVertical,()=>alignTo('x','start'),selected.locked,'w-full')}{iconButton('Centrar horizontalmente',AlignCenterVertical,()=>alignTo('x','center'),selected.locked,'w-full')}{iconButton('Alinear a la derecha',AlignEndVertical,()=>alignTo('x','end'),selected.locked,'w-full')}
            {iconButton('Alinear arriba',AlignStartHorizontal,()=>alignTo('y','start'),selected.locked,'w-full')}{iconButton('Centrar verticalmente',AlignCenterHorizontal,()=>alignTo('y','center'),selected.locked,'w-full')}{iconButton('Alinear abajo',AlignEndHorizontal,()=>alignTo('y','end'),selected.locked,'w-full')}
          </div><CouponProperties element={selected} disabled={disabled} onChange={patch=>send({type:'PATCH',id:selected.id,patch})}/>{selected.kind==='image'&&<details className="mt-3"><summary>Reemplazar imagen</summary>{dropzone('replace')}</details>}</>:<p className="text-sm text-muted-foreground">Selecciona una capa en el lienzo o la lista para editarla.</p>}
        </section>
      </div>
    </>:<div className="coupon-code-grid">
      <section className="coupon-editor-panel coupon-code-pane" aria-label="Código del cupón">
        <p className={`coupon-code-status ${errors.length?'text-destructive':'text-muted-foreground'}`} role="status">
          {errors.length?<><CircleAlert className="h-4 w-4" aria-hidden="true"/>{errors.length===1?'1 error':`${errors.length} errores`} · el lienzo muestra la última versión válida</>:<><CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true"/>Código válido · se aplica al lienzo al dejar de escribir</>}
        </p>
        <CouponCodePanel value={code?.text??''} onChange={text=>setCode(parse(text,true))} onCursor={onCursor} diagnostics={errors} reveal={reveal} disabled={disabled}/>
        {errors.length>0&&<ul className="coupon-code-errors">{errors.map((e,i)=><li key={i}><button type="button" className="text-left hover:underline" onClick={()=>setReveal({from:e.from,to:e.to})}>Línea {e.line}, columna {e.column}: {e.message}</button></li>)}</ul>}
        <details className="coupon-code-reference"><summary className="cursor-pointer font-medium">Referencia del código</summary>
          <p className="mt-2">La primera capa queda al fondo. Posiciones y tamaños en % del cupón; <code>oculto</code> y <code>bloqueado</code> van sin valor. Las imágenes se suben en modo Visual y aquí se usan por su <code>recurso</code>. Los comentarios no se guardan.</p>
          <dl className="mt-2 grid gap-1">{Object.entries(COUPON_CODE_SCHEMA).map(([tag,spec])=><div key={tag}><dt className="font-mono font-semibold">&lt;{tag}&gt;</dt><dd className="text-muted-foreground">{spec.attrs.length?`Atributos: ${spec.attrs.join(', ')}.`:'Solo texto.'}{tag==='forma'?' Estilos según tipo (ver abajo).':spec.props.length?` Estilos: ${spec.props.join(', ')}.`:''}</dd></div>)}</dl>
          <p className="mt-2 text-muted-foreground">Datos de <code>campo</code>: {Object.values(COUPON_CODE_FIELDS).join(', ')}.</p>
          <p className="mt-3 font-medium">Formas: valores de <code>tipo</code> y estilos admitidos</p>
          <dl className="mt-1 grid gap-1">{COUPON_CODE_VALUES.tipo.map(type=><div key={type}><dt className="font-mono">{type}</dt><dd className="text-muted-foreground">{couponCodeStyleProperties('forma',type).join(', ')}.</dd></div>)}</dl>
          <p className="mt-2 text-muted-foreground">En <code>linea</code>, <code>stroke</code> es el color (#rrggbb), <code>stroke-width</code> admite 0–20px y <code>border-style</code> admite solid, dashed o dotted. En las demás formas usa <code>border: 2px dashed #ff6f00</code> (también solid o dotted, 0–20px); <code>border-radius</code> solo aplica a rect.</p>
          <p className="mt-3 font-medium">Texto y campos</p>
          <p className="mt-1 text-muted-foreground"><code>font-family</code>: {COUPON_CODE_VALUES['font-family'].join(', ')}. Los nombres con espacios van entre comillas simples dentro de style. Las variantes de negrita y cursiva dependen de la fuente.</p>
          <p className="mt-2 text-muted-foreground"><code>padding</code>: 0–30px. <code>font-size</code>: 10–96px. <code>line-height</code>: 1–2. <code>border</code> en campo y texto: none o <code>1px solid #rrggbb</code> (0–20px); no admite dashed ni dotted. <code>border-radius</code>: 0–100px.</p>
        </details>
      </section>
      {workspace}
    </div>}
    <ConfirmDialog open={reset!==null} onOpenChange={open=>{if(!open)setReset(null)}} title={reset==='blank'?'Empezar en blanco':'Restaurar plantilla'} description={reset==='blank'?'Se quitan el fondo y todas las capas opcionales; quedan solo los campos obligatorios de esta promoción sobre fondo blanco. Puedes deshacerlo antes de guardar.':'Se restaurará el diseño original en este borrador. Puedes deshacerlo antes de guardar.'} confirmText={reset==='blank'?'Empezar en blanco':'Restaurar'} onConfirm={()=>{send({type:reset==='blank'?'BLANK':'RESET'});setReset(null)}}/>
    <ConfirmDialog open={leave!==null} onOpenChange={open=>{if(!open)setLeave(null)}} title="El código tiene errores" description="Si continúas, se descartan los cambios con errores y se conserva la última versión válida del cupón." confirmText="Descartar y continuar" onConfirm={()=>{const target=leave;setLeave(null);setCode(null);setMode('visual');if(target==='back')onBack()}}/>
  </div>
}
