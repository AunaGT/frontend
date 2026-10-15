import {parseLabelDesign} from './labelDesign'
import type {LabelDesign,LabelElement} from './types'
export type LabelEditorState={design:LabelDesign;past:LabelDesign[];future:LabelDesign[];selectedId:string|null;zoom:number;error:string}
export type LabelEditorAction={type:'SELECT';id:string|null}|{type:'ZOOM';zoom:number}|{type:'UNDO'}|{type:'REDO'}|{type:'DESIGN';design:LabelDesign}|{type:'ADD';element:LabelElement}|{type:'PATCH';id:string;patch:Partial<LabelElement>}|{type:'DELETE';id:string}|{type:'ORDER';id:string;direction:1|-1}
export function labelEditorReducer(state:LabelEditorState,action:LabelEditorAction):LabelEditorState{
  if(action.type==='SELECT')return{...state,selectedId:action.id}
  if(action.type==='ZOOM')return{...state,zoom:Math.max(.5,Math.min(3,action.zoom))}
  const selectionFor=(design:LabelDesign)=>design.elements.some(e=>e.id===state.selectedId)?state.selectedId:null
  if(action.type==='UNDO')return state.past.length?{...state,design:state.past.at(-1)!,selectedId:selectionFor(state.past.at(-1)!),past:state.past.slice(0,-1),future:[state.design,...state.future],error:''}:state
  if(action.type==='REDO')return state.future.length?{...state,design:state.future[0],selectedId:selectionFor(state.future[0]),past:[...state.past,state.design].slice(-50),future:state.future.slice(1),error:''}:state
  let design=structuredClone(state.design),selectedId=state.selectedId
  if(action.type==='DESIGN')design=action.design
  else if(action.type==='ADD'){design.elements.push(action.element);selectedId=action.element.id}
  else{
    const index=design.elements.findIndex(e=>e.id===action.id);if(index<0)return state
    const e=design.elements[index],mandatory=e.kind==='barcode'||e.kind==='field'&&(e.field==='barcode'||design.purpose==='shelf'&&['name','price'].includes(e.field))
    if(action.type==='DELETE'){if(e.locked||mandatory)return state;design.elements.splice(index,1);selectedId=null}
    if(action.type==='PATCH'){
      if(e.locked&&Object.keys(action.patch).some(k=>k!=='locked'))return state
      if(mandatory&&action.patch.visible===false)return state
      Object.assign(e,action.patch)
    }
    if(action.type==='ORDER'){if(e.locked)return state;const target=index+action.direction;if(target<0||target>=design.elements.length)return state;design.elements.splice(index,1);design.elements.splice(target,0,e)}
  }
  try{design=parseLabelDesign(design)}catch(error){return{...state,error:error instanceof Error?error.message:'Revisa el diseño'}}
  if(JSON.stringify(design)===JSON.stringify(state.design))return state
  return{...state,design,selectedId:design.elements.some(e=>e.id===selectedId)?selectedId:null,past:[...state.past,state.design].slice(-50),future:[],error:''}
}
