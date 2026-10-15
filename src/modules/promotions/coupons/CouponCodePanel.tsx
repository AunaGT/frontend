import {lazy,Suspense} from 'react'
import type {CouponCodeEditorProps} from './CouponCodeEditor'

// CodeMirror solo se descarga al abrir el modo código.
const CouponCodeEditor=lazy(()=>import('./CouponCodeEditor'))

export function CouponCodePanel(props:CouponCodeEditorProps){
  return <div className="coupon-code-editor"><Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando editor de código…</p>}><CouponCodeEditor {...props}/></Suspense></div>
}
