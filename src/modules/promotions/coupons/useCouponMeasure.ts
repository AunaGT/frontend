import {useEffect,useState} from 'react'
import {couponFontIds,createCouponMeasure,type CouponFontId} from './couponFonts'
import type {CouponDesign} from './couponDesign'
import type {CouponMeasure} from './couponPresentation'

// Mide solo cuando todas las fuentes del diseño están cargadas: nunca con una fuente de reemplazo.
// Pide la unión con lo ya cargado, así volver a una fuente usada antes no hace esperar al lienzo.
export function useCouponMeasure(design:CouponDesign|null|undefined){
  const ids=design?couponFontIds(design):['NotoSans' as CouponFontId]
  const [ready,setReady]=useState<{ids:CouponFontId[];measure:CouponMeasure}|null>(null),[error,setError]=useState('')
  const covered=!!ready&&ids.every(id=>ready.ids.includes(id))
  const need=covered?'':[...new Set([...(ready?.ids??[]),...ids])].sort().join(',')
  useEffect(()=>{
    if(!need)return
    let alive=true
    const wanted=need.split(',') as CouponFontId[]
    createCouponMeasure(wanted)
      .then(measure=>{if(alive){setReady({ids:wanted,measure});setError('')}})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:'No se pudo cargar la fuente del cupón')})
    return()=>{alive=false}
  },[need])
  return{measure:covered&&ready?ready.measure:null,error:covered?'':error}
}
