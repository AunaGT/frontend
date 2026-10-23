import type {ElementSpec} from '@codemirror/lang-xml'
import type {Schema,Diagnostic} from './types'
export function templateXmlElements(schema:Schema):ElementSpec[]{
  const settings=[...new Set(Object.values(schema.blocks).flatMap(b=>Object.keys(b.settings)))].filter(k=>k!=='columnStyles')
  const options=settings.map(name=>({name})),conditions=(name:string)=>name==='when'||name==='condicion'?schema.conditions:undefined
  return [
    {name:'plantilla-factura',top:true,children:['tema','bloque'],attributes:schema.xml.rootAttributes},
    {name:'tema',children:[],attributes:Object.entries(schema.theme).map(([name,rule])=>({name,...(Array.isArray(rule)?{values:rule.map(String)}:{})}))},
    {name:'bloque',children:['opciones','columns','column','images'],attributes:[...schema.xml.blockAttributes,...settings].map(name=>({name,...(name==='kind'||name==='tipo'?{values:Object.keys(schema.blocks)}:conditions(name)?{values:conditions(name)}:{})}))},
    {name:'opciones',children:['columns','images'],attributes:options},
    {name:'columns',children:['column'],attributes:[]},
    {name:'column',children:[],attributes:(schema.xml.columnAttributes||['key','label','width','align','when']).map(name=>({name,...(name==='key'?{values:[...schema.columns,'linea','cantidad','descripcion','precio','descuento']}:name==='align'?{values:['left','center','right']}:conditions(name)?{values:conditions(name)}:{})}))},
    {name:'images',children:['image'],attributes:[]},
    {name:'image',children:[],attributes:[{name:'slot',values:['imagen-1','imagen-2','imagen-3','imagen-4','imagen-5']}]},
  ]
}
export function xmlDiagnosticRanges(source:string,diagnostics:Diagnostic[]){
  const lines=source.split('\n'),starts:number[]=[];let offset=0
  for(const line of lines){starts.push(offset);offset+=line.length+1}
  return diagnostics.map(d=>{
    const line=Math.min(lines.length,Math.max(1,Number.isFinite(d.line)?Math.floor(d.line!):1))-1,column=Math.max(1,Number.isFinite(d.column)?Math.floor(d.column!):1)
    const from=starts[line]+Math.min(lines[line].length,column-1)
    return {from,to:Math.min(starts[line]+lines[line].length,from+1),severity:'error' as const,message:d.message}
  })
}
