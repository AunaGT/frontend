import {useEffect,useRef} from 'react'
import {basicSetup} from 'codemirror'
import {Annotation,Compartment,EditorState} from '@codemirror/state'
import {EditorView} from '@codemirror/view'
import {xml,xmlLanguage,type ElementSpec} from '@codemirror/lang-xml'
import {setDiagnostics} from '@codemirror/lint'
import {HighlightStyle,syntaxHighlighting} from '@codemirror/language'
import {tags} from '@lezer/highlight'
import {COUPON_CODE_SCHEMA,COUPON_CODE_VALUES,type CouponCodeError,type CouponCodeRange} from './couponCode'
import {styleCompletion} from './couponCodeCompletion'

export type CouponCodeEditorProps={value:string;onChange:(text:string)=>void;onCursor:(offset:number)=>void;diagnostics:CouponCodeError[];reveal:CouponCodeRange|null;disabled?:boolean}

// El autocompletado sale de la misma lista blanca que valida el código.
const schema:ElementSpec[]=Object.entries(COUPON_CODE_SCHEMA).map(([name,spec])=>({
  name,top:name==='cupon',children:name==='cupon'?['fondo','condiciones','campo','texto','imagen','forma']:[],
  attributes:spec.attrs.map(attr=>COUPON_CODE_VALUES[attr]?{name:attr,values:COUPON_CODE_VALUES[attr]}:attr),
}))

const highlight=HighlightStyle.define([
  {tag:tags.tagName,color:'var(--coupon-code-tag)',fontWeight:'600'},
  {tag:tags.attributeName,color:'var(--coupon-code-attr)'},
  {tag:tags.attributeValue,color:'var(--coupon-code-value)'},
  {tag:tags.blockComment,color:'var(--coupon-code-comment)',fontStyle:'italic'},
  {tag:[tags.angleBracket,tags.definitionOperator],color:'var(--coupon-code-comment)'},
  {tag:tags.character,color:'var(--coupon-code-entity)'},
  {tag:tags.invalid,color:'hsl(var(--destructive))'},
])
const theme=EditorView.theme({
  '&':{height:'100%',fontSize:'13px',backgroundColor:'hsl(var(--auna-surface-card))',color:'hsl(var(--foreground))'},
  '.cm-scroller':{fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',lineHeight:'1.6'},
  '.cm-gutters':{backgroundColor:'hsl(var(--auna-surface-header))',color:'hsl(var(--auna-surface-muted))',border:'none'},
  '.cm-activeLine':{backgroundColor:'hsl(var(--auna-surface-header) / .55)'},
  '.cm-activeLineGutter':{backgroundColor:'hsl(var(--auna-surface-header))'},
  '&.cm-focused':{outline:'2px solid hsl(var(--ring))',outlineOffset:'-2px'},
  '.cm-cursor, .cm-dropCursor':{borderLeftColor:'hsl(var(--foreground))'},
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':{backgroundColor:'hsl(var(--brand-orange) / .22)'},
  '.cm-tooltip':{backgroundColor:'hsl(var(--popover))',color:'hsl(var(--popover-foreground))',border:'1px solid hsl(var(--auna-surface-border))',borderRadius:'8px'},
})
// Las sustituciones que vienen del modelo (visual, deshacer) no cuentan como edición del usuario.
const External=Annotation.define<boolean>()

export default function CouponCodeEditor({value,onChange,onCursor,diagnostics,reveal,disabled=false}:CouponCodeEditorProps){
  const host=useRef<HTMLDivElement>(null),view=useRef<EditorView|null>(null),editable=useRef(new Compartment())
  const handlers=useRef({onChange,onCursor});handlers.current={onChange,onCursor}
  useEffect(()=>{
    const editor=new EditorView({parent:host.current!,state:EditorState.create({doc:value,extensions:[
      basicSetup,xml({elements:schema}),xmlLanguage.data.of({autocomplete:styleCompletion}),syntaxHighlighting(highlight),theme,EditorView.lineWrapping,
      EditorView.contentAttributes.of({'aria-label':'Código del cupón',spellcheck:'false'}),
      editable.current.of([EditorView.editable.of(!disabled),EditorState.readOnly.of(disabled)]),
      EditorView.updateListener.of(update=>{
        if(update.docChanged&&!update.transactions.some(t=>t.annotation(External)))handlers.current.onChange(update.state.doc.toString())
        if(update.selectionSet)handlers.current.onCursor(update.state.selection.main.head)
      }),
    ]})})
    view.current=editor
    return()=>{editor.destroy();view.current=null}
    // Se crea una sola vez; los efectos siguientes sincronizan texto, errores y modo de solo lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  useEffect(()=>{
    const editor=view.current,current=editor?.state.doc.toString()
    if(editor&&current!==value)editor.dispatch({changes:{from:0,to:current!.length,insert:value},annotations:External.of(true)})
  },[value])
  useEffect(()=>{view.current?.dispatch({effects:editable.current.reconfigure([EditorView.editable.of(!disabled),EditorState.readOnly.of(disabled)])})},[disabled])
  useEffect(()=>{
    const editor=view.current;if(!editor)return
    const length=editor.state.doc.length
    editor.dispatch(setDiagnostics(editor.state,diagnostics.map(d=>({from:Math.min(d.from,length),to:Math.min(Math.max(d.to,d.from+1),length),severity:'error' as const,message:`Línea ${d.line}, columna ${d.column}: ${d.message}`}))))
  },[diagnostics,value])
  useEffect(()=>{
    const editor=view.current;if(!editor||!reveal)return
    const length=editor.state.doc.length,from=Math.min(reveal.from,length)
    editor.dispatch({selection:{anchor:from,head:Math.min(reveal.to,length)},effects:EditorView.scrollIntoView(from,{y:'center'})})
  },[reveal])
  return <div ref={host} className="h-full"/>
}
