import {syntaxTree} from '@codemirror/language'
import type {CompletionContext,CompletionResult} from '@codemirror/autocomplete'
import {COUPON_CODE_VALUES,couponCodeStyleProperties} from './couponCode'

export function styleCompletion(context:CompletionContext):CompletionResult|null{
  const value=syntaxTree(context.state).resolveInner(context.pos,-1)
  if(value.name!=='AttributeValue')return null
  const attribute=value.parent,name=attribute?.getChild('AttributeName'),tag=attribute?.parent?.getChild('TagName')
  if(!name||!tag||context.state.sliceDoc(name.from,name.to)!=='style')return null
  const typeAttribute=attribute?.parent?.getChildren('Attribute').find(attr=>{
    const name=attr.getChild('AttributeName')
    return name&&context.state.sliceDoc(name.from,name.to)==='tipo'
  })?.getChild('AttributeValue')
  const shapeType=typeAttribute?context.state.sliceDoc(typeAttribute.from+1,typeAttribute.to-1):undefined
  const props=couponCodeStyleProperties(context.state.sliceDoc(tag.from,tag.to),shapeType)
  const typed=context.state.sliceDoc(value.from+1,context.pos),segment=typed.slice(typed.lastIndexOf(';')+1),colon=segment.indexOf(':')
  if(colon<0){const word=/[\w-]*$/.exec(segment)![0];return{from:context.pos-word.length,options:props.map(prop=>({label:prop,type:'property',apply:prop+': '}))}}
  const prop=segment.slice(0,colon).trim().toLowerCase()
  const values=props.includes(prop)?COUPON_CODE_VALUES[prop]:undefined
  if(!values)return null
  const word=segment.slice(colon+1).trimStart()
  const closing=context.state.sliceDoc(value.to-1,value.to),end=value.to-(['"',"'"].includes(closing)?1:0)
  const remaining=context.state.sliceDoc(context.pos,end),semicolon=remaining.indexOf(';')
  return{from:context.pos-word.length,to:context.pos+(semicolon<0?remaining.length:semicolon),options:values.map(label=>({label,type:'constant'}))}
}
