import {useEffect,useRef,useState} from 'react'
import {parseCouponDesign} from '../coupons/couponDesign'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// sessionStorage puede no existir o lanzar (modo privado, cuota): el borrador es una ayuda, nunca un requisito.
const store=()=>{try{return globalThis.sessionStorage??null}catch{return null}}
const sameShape=(value:unknown,template:unknown):boolean=>{
  if(Array.isArray(template))return Array.isArray(value)
  if(template&&typeof template==='object')return!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(template).every(key=>sameShape((value as Record<string,unknown>)[key],(template as Record<string,unknown>)[key]))
  return typeof value===typeof template
}

// Acepta solo un borrador con la misma forma que el formulario actual y un diseño de cupón válido.
export function restorableDraft<T extends {coupon:{design:unknown;draftId:string}}>(value:unknown,template:T):T|null{
  if(!sameShape(value,template))return null
  const draft=value as T
  try{if(!parseCouponDesign(draft.coupon.design)||!UUID.test(draft.coupon.draftId))return null}catch{return null}
  return draft
}

// Guarda en la sesión del navegador lo que difiere del estado inicial y lo restaura al recargar.
export function usePromotionDraft<T>({key,ready,snapshot,validate,apply}:{key:string|null;ready:boolean;snapshot:T;validate:(value:unknown)=>T|null;apply:(value:T)=>void}){
  const [recovered,setRecovered]=useState(false)
  const session=useRef<{key:string|null;baseline:string;cleared:boolean}>({key:null,baseline:'',cleared:false})
  const json=JSON.stringify(snapshot)
  useEffect(()=>{
    if(!ready||!key||session.current.key===key)return
    session.current={key,baseline:json,cleared:false}
    let saved:T|null=null
    try{const raw=store()?.getItem(key);saved=raw?validate(JSON.parse(raw)):null;if(raw&&!saved)store()?.removeItem(key)}catch{store()?.removeItem(key)}
    setRecovered(!!saved)
    if(saved)apply(saved)
  },[key,ready,json,validate,apply])
  useEffect(()=>{
    const current=session.current
    if(!ready||!key||current.key!==key||current.cleared)return
    try{if(json===current.baseline)store()?.removeItem(key);else store()?.setItem(key,json)}catch{/* cuota llena o almacenamiento bloqueado */}
  },[json,key,ready])
  return{recovered,clear:()=>{session.current.cleared=true;setRecovered(false);try{if(key)store()?.removeItem(key)}catch{/* sin almacenamiento */}}}
}
