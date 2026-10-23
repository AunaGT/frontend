import {useState} from 'react'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import type {Design,Schema,BlockKind,ColumnStyles,ColumnStyle} from './types'
const labels:Record<BlockKind,string>={HEADER:'Cabecera',EMITTER:'Emisor',RECEIVER:'Cliente',DETAILS:'Detalle de productos',TOTALS:'Totales',NOTES:'Nota comercial',FISCAL:'Información fiscal de muestra',FOOTER:'Pie del documento'}
const columnLabels:Record<string,string>={number:'No.',description:'Descripción',quantity:'Cantidad',unit:'Unidad',price:'Precio unitario',discount:'Descuento',total:'Importe'}
export type TemplateBlockSection='header'|'columns'|'footer'|'images'
export function TemplateBlocks({design,schema,onChange,disabled,onImage,section='header'}:{design:Design;schema:Schema;onChange:(d:Design)=>void;disabled:boolean;onImage?:(slot:string,file:File)=>void;section?:TemplateBlockSection}){
  const [selectedColumn,setSelectedColumn]=useState<string|null>('description')
  const update=(index:number,key:string,value:string|boolean|string[]|ColumnStyles|undefined)=>{
    const next=structuredClone(design)
    if(value===undefined)delete next.blocks[index].settings[key];else next.blocks[index].settings[key]=value
    onChange(next)
  }
  const columnStyle=(index:number,column:string,key:keyof ColumnStyle,value:string|number|undefined)=>{
    const styles=structuredClone((design.blocks[index].settings.columnStyles as ColumnStyles)||{})
    styles[column]??={}
    if(value===undefined)delete styles[column][key];else Object.assign(styles[column],{[key]:value})
    if(!Object.keys(styles[column]).length)delete styles[column]
    update(index,'columnStyles',Object.keys(styles).length?styles:undefined)
  }
  const usedImages=new Set(design.blocks.flatMap(b=>(b.settings.images as string[])||[]))
  const imageLimit=design.blocks.some(b=>b.kind==='HEADER'&&b.settings.showLogo)?4:5
  const nextSlot=usedImages.size<imageLimit?[1,2,3,4,5].map(n=>`imagen-${n}`).find(slot=>!usedImages.has(slot)):undefined
  const kinds:BlockKind[]=section==='header'?['HEADER']:section==='columns'?['DETAILS']:section==='footer'?['NOTES','FOOTER']:['HEADER','FOOTER']
  return <div className="document-template-blocks">
    {section==='images'&&<p className="document-template-help">Agrega solo las imágenes que necesites. {imageLimit===4?'Con el logo activo quedan cuatro espacios adicionales.':'Puedes usar hasta cinco imágenes.'} El mismo espacio conserva su archivo al importar.</p>}
    {design.blocks.map((block,index)=>kinds.includes(block.kind)&&<section key={block.id} className="document-template-block-section" aria-label={labels[block.kind]}>
      <div className="document-template-section-title"><h3>{labels[block.kind]}</h3>{section==='images'&&<span>{((block.settings.images as string[])||[]).length} imágenes</span>}</div>
      {section==='header'&&<div className="document-template-form-grid">
        <label className="document-template-field document-template-field-wide">Título del documento<Input disabled={disabled} maxLength={2000} value={String(block.settings.title??'')} placeholder="Usar la apariencia de la empresa" onChange={e=>update(index,'title',e.target.value)}/></label>
        <label className="document-template-field">Alineación<select className="auna-control auna-control-select" disabled={disabled} value={String(block.settings.alignment||'left')} onChange={e=>update(index,'alignment',e.target.value)}>{(schema.blocks.HEADER.settings.alignment as string[]).map(value=><option key={value} value={value}>{{left:'Izquierda',center:'Centro',right:'Derecha'}[value]||value}</option>)}</select></label>
        <label className="document-template-check"><input type="checkbox" disabled={disabled} checked={block.settings.showLogo===true} onChange={e=>update(index,'showLogo',e.target.checked)}/> Logo de Identidad</label>
        <Button className="justify-self-start" variant="ghost" size="sm" disabled={disabled} onClick={()=>update(index,'title',undefined)}>Usar título de la empresa</Button>
      </div>}
      {section==='columns'&&<>
        <p className="document-template-help">Selecciona una columna para ajustar su diseño. Usa las flechas para cambiar el orden; las filas del documento se completan automáticamente.</p>
        <ol className="document-template-columns">{(block.settings.columns as string[]||schema.columns).map((column,i,columns)=>{
          const style=(block.settings.columnStyles as ColumnStyles)?.[column]||{},label=columnLabels[column]||column
          const customizable=design.base.version===2&&design.paper.format!=='RECEIPT_80',selected=customizable&&selectedColumn===column,optionsId=`column-options-${block.id}-${column}`
          return <li key={column} className={selected?'is-selected':''}>
            <div className="document-template-column-heading">
              {customizable?<button type="button" className="document-template-column-select" aria-label={`Editar columna ${label}`} aria-expanded={selected} aria-controls={selected?optionsId:undefined} onClick={()=>setSelectedColumn(selected?null:column)}><span>{label}</span><small>{style.width!==undefined?`${style.width} %`:'Auto'}{style.label?` · ${style.label}`:''}</small></button>:<span>{label}</span>}
              {[-1,1].map(direction=><Button key={direction} size="sm" variant="ghost" aria-label={`${direction<0?'Subir':'Bajar'} ${label}`} disabled={disabled||i+direction<0||i+direction>=columns.length} onClick={()=>{const next=[...columns];[next[i],next[i+direction]]=[next[i+direction],next[i]];update(index,'columns',next)}}>{direction<0?'↑':'↓'}</Button>)}
            </div>
            {selected&&<div className="document-template-column-options" id={optionsId}>
              <label className="document-template-field">Título<Input aria-label={`Título de ${label}`} value={style.label??''} placeholder={label} maxLength={80} disabled={disabled} onChange={e=>columnStyle(index,column,'label',e.target.value||undefined)}/></label>
              <label className="document-template-field">Ancho (%)<Input aria-label={`Ancho de ${label}`} type="number" min={4} max={80} step="0.1" value={style.width??''} placeholder="Auto" disabled={disabled} onChange={e=>columnStyle(index,column,'width',e.target.value===''?undefined:Number(e.target.value))}/></label>
              <label className="document-template-field">Alineación<select className="auna-control auna-control-select" aria-label={`Alineación de ${label}`} value={style.align||''} disabled={disabled} onChange={e=>columnStyle(index,column,'align',e.target.value||undefined)}><option value="">Automática</option><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label>
              {column==='discount'&&<label className="document-template-field">Visibilidad<select className="auna-control auna-control-select" value={style.when||'ALWAYS'} disabled={disabled} onChange={e=>columnStyle(index,column,'when',e.target.value==='ALWAYS'?undefined:e.target.value)}><option value="ALWAYS">Siempre</option><option value="HAS_DISCOUNT">Cuando haya descuento</option></select></label>}
            </div>}
          </li>
        })}</ol>
        <p className="document-template-help">Anchos vacíos: distribución automática. Si defines porcentajes, completa todas las columnas y suma 100 %.</p>
      </>}
      {section==='footer'&&<div className="document-template-block-options">
        <label className="document-template-field">{block.kind==='NOTES'?'Nota':'Texto de cierre'}<textarea className="auna-control min-h-20" disabled={disabled} maxLength={2000} value={String(block.settings.text??'')} placeholder={block.kind==='FOOTER'?'Usar el pie de la empresa':'Texto opcional'} onChange={e=>update(index,'text',e.target.value)}/></label>
        {block.kind==='FOOTER'?<Button className="justify-self-start" variant="ghost" size="sm" disabled={disabled} onClick={()=>update(index,'text',undefined)}>Usar pie de la empresa</Button>:<label className="document-template-field">Cuándo mostrarla<select className="auna-control auna-control-select" disabled={disabled} value={block.when||'ALWAYS'} onChange={e=>{const next=structuredClone(design);next.blocks[index].when=e.target.value as typeof block.when;onChange(next)}}>{schema.conditions.map(c=><option key={c} value={c}>{{ALWAYS:'Siempre',HAS_NOTE:'Cuando tenga texto',HAS_DISCOUNT:'Cuando haya un descuento'}[c]||c}</option>)}</select></label>}
      </div>}
      {section==='images'&&<div className="document-template-images">
        {((block.settings.images as string[])||[]).map(slot=>{const n=slot.replace('imagen-','');return <div className="document-template-image-row" key={slot}><span>Imagen {n}</span>{onImage&&<label className="document-template-image-input"><span className="sr-only">Asociar imagen {n} a {labels[block.kind]}</span><input aria-label={`Asociar imagen ${n} a ${labels[block.kind]}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={e=>{const file=e.target.files?.[0];if(file)onImage(slot,file);e.target.value=''}}/></label>}<Button variant="ghost" size="sm" aria-label={`Quitar imagen ${n} de ${labels[block.kind]}`} disabled={disabled} onClick={()=>update(index,'images',((block.settings.images as string[])||[]).filter(s=>s!==slot))}>Quitar</Button></div>})}
        {!((block.settings.images as string[])||[]).length&&<p className="document-template-help">Sin imágenes adicionales en esta sección.</p>}
        {[...usedImages].some(slot=>!((block.settings.images as string[])||[]).includes(slot))&&<label className="document-template-field">Imagen ya agregada<select className="auna-control auna-control-select" aria-label={`Reutilizar imagen en ${labels[block.kind]}`} value="" disabled={disabled} onChange={e=>{if(e.target.value)update(index,'images',[...((block.settings.images as string[])||[]),e.target.value])}}><option value="">Elige una imagen existente…</option>{[...usedImages].filter(slot=>!((block.settings.images as string[])||[]).includes(slot)).map(slot=><option key={slot} value={slot}>Imagen {slot.replace('imagen-','')}</option>)}</select></label>}
        <Button className="justify-self-start" variant="outline" size="sm" disabled={disabled||!nextSlot} aria-label={`Agregar imagen a ${labels[block.kind]}`} onClick={()=>{if(nextSlot)update(index,'images',[...((block.settings.images as string[])||[]),nextSlot])}}>Agregar imagen</Button>
      </div>}
    </section>)}
    <p className="document-template-system-fields">Emisor, cliente, importes y datos fiscales se completan desde el documento y permanecen protegidos.</p>
  </div>
}
