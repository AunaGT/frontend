import {getCouponPrintLayout} from './couponPresentation'
import {createDefaultCouponDesign,couponHeight,parseCouponDesign,type CouponDesign,type CouponElement,type CouponField} from './couponDesign'
export type CouponEditorState={design:CouponDesign;past:CouponDesign[];future:CouponDesign[];selectedId:string|null;zoom:number}
export type CouponEditorAction={type:'SELECT';id:string|null}|{type:'ZOOM';zoom:number}|{type:'UNDO'|'REDO'|'RESET'|'BLANK'}|{type:'IMAGE_DESIGN';assetId:string;aspect:number}|
  {type:'DESIGN';design:CouponDesign}|{type:'ADD';element:CouponElement}|
  {type:'MOVE';id:string;dx:number;dy:number}|{type:'RESIZE';id:string;dw:number;dh:number}|
  {type:'PATCH';id:string;patch:Partial<CouponElement>}|{type:'ORDER';id:string;direction:1|-1}|
  {type:'DELETE';id:string}|{type:'DUPLICATE';id:string;newId:string}
export const pointerDelta=(start:{x:number;y:number},current:{x:number;y:number},rect:{width:number;height:number})=>({x:(current.x-start.x)/rect.width,y:(current.y-start.y)/rect.height})
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n))
export function moveCouponBox(box:{x:number;y:number;width:number;height:number},dx:number,dy:number,snapping=true){
  const snap=(v:number,size:number)=>{for(const anchor of [.025,.5-size/2,.975-size])if(Math.abs(v-anchor)<.004)return anchor;return v}
  return{x:clamp(snapping?snap(box.x+dx,box.width):box.x+dx,0,1-box.width),y:clamp(snapping?snap(box.y+dy,box.height):box.y+dy,0,1-box.height)}
}
// Campos obligatorios apilados con cajas del alto justo para su texto: caben en cualquier proporción del cupón
// y nunca bajan de 6 pt impresos (un cupón vertical se imprime más angosto, así que sus letras suben).
function requiredStack(required:CouponField[],design:Pick<CouponDesign,'printPreset'|'aspect'>,place:'top'|'bottom',card:boolean):CouponElement[]{
  const pad=card?8:0,gap=6,height=couponHeight(design),ptPerUnit=getCouponPrintLayout(design.printPreset,design.aspect).tileWidth/1000*72/25.4
  let minSize=Math.ceil(6/ptPerUnit);if(minSize*ptPerUnit<6)minSize++
  const fields=createDefaultCouponDesign().elements.flatMap(e=>{
    if(e.kind!=='field'||!required.includes(e.field))return[]
    const fontSize=Math.max(e.style.fontSize,minSize)
    return[{e:{...e,style:{...e.style,fontSize}},units:fontSize*e.style.lineHeight+2*pad+2}]
  })
  let y=place==='top'?.05*height:.95*height-fields.reduce((sum,f)=>sum+f.units+gap,-gap)
  return fields.map(({e,units})=>{
    const element={...e,x:.05,y:y/height,width:.9,height:units/height,style:{...e.style,color:'#0c203a',background:card?'#ffffff':null,padding:pad,radius:card?8:0}}
    y+=units+gap;return element
  })
}
export function couponEditorReducer(state:CouponEditorState,action:CouponEditorAction,required:CouponField[]=['code','benefit']):CouponEditorState{
  if(action.type==='SELECT')return{...state,selectedId:action.id}
  if(action.type==='ZOOM')return{...state,zoom:clamp(action.zoom,.5,2)}
  if(action.type==='UNDO')return state.past.length?{...state,design:state.past.at(-1)!,past:state.past.slice(0,-1),future:[state.design,...state.future]}:state
  if(action.type==='REDO')return state.future.length?{...state,design:state.future[0],past:[...state.past,state.design].slice(-50),future:state.future.slice(1)}:state
  let design=structuredClone(state.design),selectedId=state.selectedId
  if(action.type==='DESIGN')design=action.design
  else if(action.type==='RESET')design=createDefaultCouponDesign()
  // En blanco: solo los campos obligatorios, en oscuro sobre blanco, en la proporción que tenga el cupón.
  else if(action.type==='BLANK'){design={...design,background:{kind:'solid',color:'#ffffff'},elements:requiredStack(required,design,'top',false)};selectedId=null}
  // Diseño desde una imagen: el cupón toma su proporción y los campos obligatorios van abajo, sobre recuadro blanco.
  else if(action.type==='IMAGE_DESIGN'){design={...design,aspect:action.aspect,background:{kind:'image',assetId:action.assetId,fit:'cover',focalX:.5,focalY:.5},elements:requiredStack(required,{printPreset:design.printPreset,aspect:action.aspect},'bottom',true)};selectedId=null}
  else if(action.type==='ADD'){design.elements.push(action.element);selectedId=action.element.id}
  else{
    if(!('id' in action))return state
    const index=design.elements.findIndex(e=>e.id===action.id);if(index<0)return state
    const e=design.elements[index],mandatory=e.kind==='field'&&required.includes(e.field)
    if(e.locked&&['MOVE','RESIZE','DELETE','ORDER'].includes(action.type))return state
    if(action.type==='MOVE')Object.assign(e,moveCouponBox(e,action.dx,action.dy,false))
    if(action.type==='RESIZE'){e.width=clamp(e.width+action.dw,.02,1-e.x);e.height=clamp(e.height+action.dh,.02,1-e.y)}
    if(action.type==='PATCH'){
      if(e.locked&&['x','y','width','height'].some(k=>k in action.patch))return state
      if(mandatory&&(action.patch.visible===false||action.patch.opacity!==undefined&&action.patch.opacity!==1))return state
      Object.assign(e,action.patch)
    }
    if(action.type==='DELETE'){if(mandatory)return state;design.elements.splice(index,1);selectedId=null}
    if(action.type==='DUPLICATE'){if(e.kind==='field')return state;design.elements.push({...e,id:action.newId,locked:false});selectedId=action.newId}
    if(action.type==='ORDER'){const target=index+action.direction;if(target<0||target>=design.elements.length)return state;design.elements.splice(index,1);design.elements.splice(target,0,e)}
  }
  try{parseCouponDesign(design)}catch{return state}
  for(const field of required){const e=design.elements.find(e=>e.kind==='field'&&e.field===field);if(!e||!e.visible||e.opacity!==1)return state}
  if(JSON.stringify(design)===JSON.stringify(state.design))return state
  return{...state,design,selectedId,past:[...state.past,state.design].slice(-50),future:[]}
}
