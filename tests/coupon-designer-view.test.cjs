const{test}=require('node:test'),assert=require('node:assert/strict')
const{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{makeCouponFixture}=require('./fixtures/couponFixtures.cjs')
const wait=ms=>new Promise(r=>setTimeout(r,ms))
async function mountEditor({design,createCouponMeasure,onUpload}={}){
  const h=hookHarness(),nodes=[],f=makeCouponFixture(),calls={changes:[],back:0}
  if(design)f.design=design
  const realFonts=loadReportModule('../promotions/coupons/couponFonts.ts')
  const hooks={...h.hooks,useReducer:(reducer,initial)=>{const[state,set]=h.hooks.useState(initial);return[state,action=>set(old=>reducer(old,action))]}}
  const{couponData}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const{serializeCouponDesign}=loadReportModule('../promotions/coupons/couponCode.ts')
  const{CouponEditor}=loadReportModule('../promotions/coupons/CouponEditor.tsx',{react:hooks,'./couponFonts':{...realFonts,createCouponMeasure:createCouponMeasure??(async()=>(text,s)=>text.length*s.fontSize*.5)},'./CouponCodePanel':{CouponCodePanel:function CouponCodePanel(){return null}}},nodes)
  const props={value:f.design,onChange:d=>calls.changes.push(d),data:couponData(f.promotion,f.codes[0],f.branding),assets:f.assets,onUpload:onUpload??(async()=>{}),onBack:()=>calls.back++}
  const render=()=>{nodes.length=0;h.render(()=>CouponEditor(props))}
  render();await new Promise(r=>setImmediate(r));render()
  const find=predicate=>nodes.find(predicate)
  const button=label=>find(n=>[n.props?.children].flat(3).includes(label)||n.props?.['aria-label']===label)
  return{h,nodes,f,calls,render,find,button,serializeCouponDesign,
    canvas:()=>find(n=>n.type?.name==='CouponCanvas').props,
    panel:()=>find(n=>n.type?.name==='CouponCodePanel')?.props,
    mode:value=>{find(n=>n.props?.ariaLabel==='Modo de edición').props.onValueChange(value);render()}}
}

test('the editor is a page view: no dialog, changes reach the promotion draft continuously and back leaves',async()=>{
  const v=await mountEditor()
  try{
    assert.ok(!v.nodes.some(n=>['Dialog','DialogContent'].includes(n.type?.name)),'no modal dialog')
    assert.ok(!v.button('Usar diseño'),'no separate commit step')
    const initial=v.f.design.elements.find(e=>e.id==='field-code').x
    v.canvas().onSelect('field-code');v.render()
    v.canvas().onKeyDown({key:'ArrowRight',shiftKey:true,preventDefault(){}});v.render()
    assert.ok(Math.abs(v.calls.changes.at(-1).elements.find(e=>e.id==='field-code').x-(initial+.01))<1e-9)
    v.button('Volver a la promoción').props.onClick();assert.equal(v.calls.back,1)
  }finally{v.h.unmount()}
})

test('code mode shows canonical code, applies valid edits after a pause and keeps the last valid design on errors',async()=>{
  const v=await mountEditor()
  try{
    v.mode('code')
    const text=v.panel().value
    assert.equal(text,v.serializeCouponDesign(v.f.design))
    v.panel().onChange(text.replace(/(<campo dato="codigo" x=")[^"]+/,'$110%'));v.render()
    await wait(350);v.render()
    assert.ok(Math.abs(v.canvas().scene.nodes.find(n=>n.id==='field-code').x-100)<1e-9,'valid code reaches the canvas')
    assert.equal(v.calls.changes.at(-1).elements.find(e=>e.id==='field-code').x,.1)
    v.panel().onChange('<cupon tamaño="estandar"><fondo color="#000000" /><div /></cupon>');v.render()
    await wait(350);v.render()
    assert.ok(v.panel().diagnostics.some(d=>/div/.test(d.message)),'errors are shown in the editor')
    assert.ok(Math.abs(v.canvas().scene.nodes.find(n=>n.id==='field-code').x-100)<1e-9,'canvas keeps the last valid design')
    v.button('Volver a la promoción').props.onClick();v.render()
    assert.equal(v.calls.back,0,'leaving with invalid code asks first')
    assert.equal(v.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open)?.props.open,true)
  }finally{v.h.unmount()}
})

test('the code cursor selects its layer and selecting on the canvas reveals it in the code',async()=>{
  const v=await mountEditor()
  try{
    v.mode('code')
    const text=v.panel().value
    v.panel().onCursor(text.indexOf('<campo dato="codigo"')+3);v.render()
    assert.equal(v.canvas().selectedId,'field-code')
    v.canvas().onSelect('field-name');v.render()
    const reveal=v.panel().reveal
    assert.ok(reveal&&text.slice(reveal.from,reveal.to).startsWith('<campo dato="nombre"'))
  }finally{v.h.unmount()}
})

test('the add-field menu lists every field and marks the ones already on the coupon instead of opening empty',async()=>{
  const v=await mountEditor()
  try{
    const{COUPON_FIELD_LABELS}=loadReportModule('../promotions/coupons/couponDesign.ts')
    const items=()=>v.nodes.filter(n=>n.props&&Object.hasOwn(COUPON_FIELD_LABELS,n.props.value)&&'disabled'in n.props)
    assert.equal(items().length,12,'every field is listed, even when all are already on the coupon')
    assert.ok(items().every(n=>n.props.disabled),'fields already on the coupon cannot be added twice')
    assert.ok(v.find(n=>n.props?.placeholder==='Agregar campo…'),'short placeholder that fits the panel')
    v.canvas().onSelect('field-terms');v.render()
    v.button('Eliminar').props.onClick();v.render()
    assert.equal(items().find(n=>n.props.value==='terms').props.disabled,false,'a removed field can be added again')
  }finally{v.h.unmount()}
})

const{createDefaultCouponDesign}=loadReportModule('../promotions/coupons/couponDesign.ts')
const image={id:'imagen-1',kind:'image',assetId:'11111111-1111-4111-8111-111111111111',fit:'contain',focalX:.5,focalY:.5,x:.6,y:.1,width:.2,height:.3,visible:true,locked:false,opacity:1}

test('the shape gallery adds ellipse, star and badge layers',async()=>{
  const v=await mountEditor()
  try{
    for(const label of ['Agregar elipse','Agregar estrella','Agregar sello']){v.button(label).props.onClick();v.render()}
    assert.deepEqual(v.calls.changes.at(-1).elements.slice(-3).map(e=>[e.kind,e.shape,e.id]),[['shape','ellipse','forma-1'],['shape','star','forma-2'],['shape','badge','forma-3']])
  }finally{v.h.unmount()}
})

test('align buttons place the selected layer relative to the coupon',async()=>{
  const v=await mountEditor()
  try{
    v.canvas().onSelect('promotion-label');v.render()
    const width=v.f.design.elements.find(e=>e.id==='promotion-label').width
    v.button('Centrar horizontalmente').props.onClick();v.render()
    assert.equal(v.calls.changes.at(-1).elements.find(e=>e.id==='promotion-label').x,(1-width)/2)
    v.button('Alinear abajo').props.onClick();v.render()
    const label=v.calls.changes.at(-1).elements.find(e=>e.id==='promotion-label')
    assert.ok(Math.abs(label.y-(.975-label.height))<1e-9)
  }finally{v.h.unmount()}
})

test('resizing an image keeps its proportions',async()=>{
  const design=createDefaultCouponDesign();design.elements.push({...image})
  const v=await mountEditor({design})
  try{
    let held=false
    const svg={focus(){},setPointerCapture(){held=true},releasePointerCapture(){held=false},hasPointerCapture(){return held},getBoundingClientRect:()=>({width:1000,height:720})}
    v.canvas().onSelect('imagen-1');v.render()
    v.canvas().onBeginResize('imagen-1',{clientX:0,clientY:0,pointerId:1,currentTarget:{ownerSVGElement:svg},preventDefault(){}})
    v.canvas().onPointerMove({clientX:100,clientY:0});v.render();v.canvas().onPointerUp({});v.render()
    const resized=v.calls.changes.at(-1).elements.find(e=>e.id==='imagen-1')
    assert.ok(Math.abs(resized.width-.3)<1e-9);assert.ok(Math.abs(resized.height/resized.width-image.height/image.width)<1e-9)
  }finally{v.h.unmount()}
})

test('the canvas waits for the fonts a design uses before measuring',async()=>{
  const requests=[];let release
  const createCouponMeasure=async ids=>{requests.push(ids);if(ids.includes('Montserrat'))await new Promise(r=>release=r);return(text,s)=>text.length*s.fontSize*.5}
  const v=await mountEditor({createCouponMeasure})
  try{
    v.canvas().onSelect('promotion-label');v.render()
    const props=v.find(n=>n.type?.name==='CouponProperties').props
    props.onChange({style:{...props.element.style,font:'Montserrat'}});v.render()
    assert.ok(requests.some(ids=>ids.includes('Montserrat')),'the new font is requested')
    assert.equal(v.find(n=>n.type?.name==='CouponCanvas'),undefined,'no scene is measured with a font that is not loaded')
    release();await new Promise(r=>setImmediate(r));v.render()
    assert.ok(v.canvas(),'the canvas returns once the font is ready')
  }finally{v.h.unmount()}
})

test('properties: fonts without bold turn it off, rotation is only for free layers',()=>{
  const nodes=[],{CouponProperties}=loadReportModule('../promotions/coupons/CouponProperties.tsx',{},nodes)
  const{textStyle}=loadReportModule('../promotions/coupons/couponDesign.ts')
  const text={id:'texto-1',kind:'text',text:'Hola',x:.1,y:.1,width:.3,height:.1,visible:true,locked:false,opacity:1,style:textStyle({bold:true,italic:true})}
  let patch;const render=element=>{nodes.length=0;CouponProperties({element,onChange:p=>patch=p})}
  render(text)
  assert.ok(nodes.some(n=>n.props?.['aria-label']==='Rotación (°)'),'free text can rotate')
  nodes.find(n=>n.props?.onValueChange&&n.props?.value===text.style.font).props.onValueChange('Pacifico')
  assert.deepEqual([patch.style.font,patch.style.bold,patch.style.italic],['Pacifico',false,false])
  render({...text,style:patch.style})
  assert.equal(nodes.find(n=>n.props?.['aria-label']==='Negrita').props.disabled,true)
  render({id:'field-code',kind:'field',field:'code',x:.1,y:.1,width:.3,height:.1,visible:true,locked:false,opacity:1,style:textStyle()})
  assert.ok(!nodes.some(n=>n.props?.['aria-label']==='Rotación (°)'),'fields never rotate')
})

test('keyboard shortcuts: delete, undo/redo, duplicate, copy/paste, order and escape, never while typing',async()=>{
  const v=await mountEditor()
  try{
    const key=(key,extra={})=>{const event={key,ctrlKey:false,metaKey:false,shiftKey:false,target:{tagName:'DIV'},currentTarget:{contains:()=>true},defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...extra};v.find(n=>n.props?.className==='coupon-designer').props.onKeyDown(event);v.render();return event}
    const ids=()=>v.calls.changes.at(-1).elements.map(e=>e.id)
    v.canvas().onSelect('promotion-label');v.render()
    key('Delete',{target:{tagName:'INPUT'}});key('Backspace',{target:{tagName:'DIV',isContentEditable:true}})
    assert.equal(v.calls.changes.length,0,'typing in a field or in the code never deletes the layer')
    assert.ok(key('Delete').defaultPrevented);assert.ok(!ids().includes('promotion-label'))
    key('z',{ctrlKey:true});assert.ok(ids().includes('promotion-label'),'Ctrl+Z restores it')
    key('y',{ctrlKey:true});assert.ok(!ids().includes('promotion-label'),'Ctrl+Y redoes')
    key('z',{metaKey:true});key('z',{ctrlKey:true,shiftKey:true});assert.ok(!ids().includes('promotion-label'),'Cmd+Z and Ctrl+Shift+Z')
    key('z',{ctrlKey:true})
    v.canvas().onSelect('promotion-label');v.render()
    key('d',{ctrlKey:true});assert.equal(ids().at(-1),'texto-1')
    key('c',{ctrlKey:true});key('v',{ctrlKey:true})
    const [copy,pasted]=v.calls.changes.at(-1).elements.slice(-2)
    assert.equal(pasted.id,'texto-2');assert.ok(Math.abs(pasted.x-(copy.x+.02))<1e-9&&Math.abs(pasted.y-(copy.y+.02))<1e-9)
    key('[',{ctrlKey:true});assert.equal(ids().at(-1),'texto-1','Ctrl+[ sends the layer back one step')
    key('Escape');assert.equal(v.canvas().selectedId,null)
    v.canvas().onSelect('field-code');v.render()
    const before=v.calls.changes.length;key('d',{ctrlKey:true});key('c',{ctrlKey:true});key('Delete')
    assert.equal(v.calls.changes.length,before,'required fields are never duplicated or deleted')
    key('v',{ctrlKey:true});assert.equal(v.calls.changes.at(-1).elements.at(-1).kind,'text','copying a field keeps the previous clipboard: fields are unique')
  }finally{v.h.unmount()}
})

test('start blank asks first, then leaves only the required fields',async()=>{
  const v=await mountEditor()
  try{
    v.button('Empezar en blanco').props.onClick();v.render()
    const dialog=v.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open)
    assert.match(dialog.props.description,/obligatorios/)
    dialog.props.onConfirm();v.render()
    const{couponData}=loadReportModule('../promotions/coupons/couponPresentation.ts')
    const required=couponData(v.f.promotion,v.f.codes[0],v.f.branding).requiredFields
    assert.deepEqual(v.calls.changes.at(-1).elements.map(e=>e.id).sort(),required.map(field=>'field-'+field).sort())
  }finally{v.h.unmount()}
})

test('phase 3: «Diseño desde mi imagen» shapes the coupon like the image, warns when it had to crop and can go back to standard',async()=>{
  const asset={id:'11111111-1111-4111-8111-111111111111',url:'blob:qa',expiresAt:'2099-01-01T00:00:00.000Z',width:2400,height:400}
  const v=await mountEditor({onUpload:async()=>asset})
  try{
    v.find(n=>n.type?.name==='ImageUploadDropzone'&&n.props.fileLabel==='diseño del cupón').props.onFileSelect({name:'cupon.png'})
    await new Promise(r=>setImmediate(r));v.render()
    const shaped=v.calls.changes.at(-1)
    assert.equal(shaped.aspect,3,'a 6:1 image is limited to 3:1')
    assert.deepEqual(shaped.background,{kind:'image',assetId:asset.id,fit:'cover',focalX:.5,focalY:.5})
    assert.ok(v.find(n=>n.props?.role==='status'&&/3:1/.test([n.props.children].flat(3).join(''))),'the crop is announced')
    assert.equal(v.canvas().scene.height,1000/3)
    let held=false
    const svg={focus(){},setPointerCapture(){held=true},releasePointerCapture(){held=false},hasPointerCapture(){return held},getBoundingClientRect:()=>({width:1000,height:1000/3})}
    const benefit=shaped.elements.find(e=>e.field==='benefit'),dy=(.5-benefit.height/2)-benefit.y
    v.canvas().onSelect(benefit.id);v.render()
    v.canvas().onBeginMove(benefit.id,{clientX:0,clientY:0,pointerId:1,currentTarget:{ownerSVGElement:svg},preventDefault(){}})
    v.canvas().onPointerMove({clientX:0,clientY:dy*1000/3});v.render()
    assert.deepEqual(v.canvas().guides.find(g=>g.axis==='y'),{axis:'y',position:.5*1000/3},'the centre guide sits at half the real height')
    v.canvas().onPointerUp({});v.render()
    v.button('Proporción estándar').props.onClick();v.render()
    assert.ok(!('aspect' in v.calls.changes.at(-1)),'standard proportion drops the key')
  }finally{v.h.unmount()}
})
