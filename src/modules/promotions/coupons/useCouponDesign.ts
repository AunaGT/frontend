import {useEffect,useRef,useState} from 'react'
import {createDefaultCouponDesign,parseCouponDesign,couponAssetIds,type CouponDesign} from './couponDesign'
import {uploadCouponAsset,resolveCouponAssets,removeDraftCouponAsset,type CouponScope} from './couponAssetsApi'
import type {CouponAssets} from './CouponCanvas'
export function useCouponDesign({companyId,promotionId,initialDesign,ready=true}:{companyId:string;promotionId?:string;initialDesign?:CouponDesign|null;ready?:boolean}){
  const key=companyId+':'+(promotionId||'new'),identity=useRef(key);identity.current=key
  const epoch=useRef(0),initialized=useRef(''),requests=useRef(new Set<AbortController>()),temps=useRef(new Set<string>())
  const [draftId,setDraftId]=useState<string>(()=>crypto.randomUUID()),[design,setValue]=useState<CouponDesign>(createDefaultCouponDesign),[assets,setAssets]=useState<CouponAssets>(new Map()),[pending,setPending]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false)
  const [designKey,setDesignKey]=useState(key)
  const scope:CouponScope={companyId,promotionId,draftId},value=useRef(design);value.current=design
  useEffect(()=>{
    const activeRequests=requests.current,scopeEpoch=epoch
    epoch.current++;initialized.current='';temps.current.clear();requests.current.forEach(r=>r.abort());requests.current.clear()
    setDraftId(crypto.randomUUID());setValue(createDefaultCouponDesign());setAssets(new Map());setPending(false);setError('');setDirty(false)
    setDesignKey(key)
    return()=>{scopeEpoch.current++;activeRequests.forEach(r=>r.abort());activeRequests.clear()}
  },[key])
  useEffect(()=>{
    if(!ready||initialized.current===key)return
    initialized.current=key
    try{setValue(parseCouponDesign(initialDesign??null)||createDefaultCouponDesign())}catch(e){setError(e instanceof Error?e.message:'Diseño no válido')}
  },[key,ready,initialDesign])
  const assetKey=couponAssetIds(design).sort().join(',')
  useEffect(()=>{
    if(!assetKey||!companyId||designKey!==key)return
    const needed=assetKey.split(',').filter(id=>!assets.has(id)||Date.parse(assets.get(id)!.expiresAt)<Date.now()+60000)
    if(!needed.length)return
    const controller=new AbortController(),started=epoch.current;requests.current.add(controller);setPending(true)
    const activeRequests=requests.current
    resolveCouponAssets(needed,scope,controller.signal).then(rows=>{if(identity.current===key&&started===epoch.current)setAssets(old=>new Map([...old,...rows.map(row=>[row.id,row] as const)]))}).catch(e=>{if(!controller.signal.aborted&&identity.current===key)setError(e.message)}).finally(()=>{requests.current.delete(controller);if(started===epoch.current)setPending(false)})
    return()=>{controller.abort();activeRequests.delete(controller)}
    // Signed assets are separate from design/history; never reset a dirty design on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[assetKey,key,draftId,designKey])
  const upload=async(file:File)=>{
    const controller=new AbortController(),started=epoch.current;requests.current.add(controller);setPending(true);setError('')
    try{
      const row=await uploadCouponAsset(file,scope,controller.signal)
      if(identity.current!==key||started!==epoch.current||controller.signal.aborted)throw Error('Carga cancelada por cambio de contexto')
      temps.current.add(row.id);setAssets(old=>new Map(old).set(row.id,row));return row
    }catch(e){if(identity.current===key&&started===epoch.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'No se pudo cargar la imagen');throw e}
    finally{requests.current.delete(controller);if(started===epoch.current)setPending(false)}
  }
  const cancel=async()=>{
    requests.current.forEach(r=>r.abort());epoch.current++
    await Promise.allSettled([...temps.current].map(id=>removeDraftCouponAsset(id,scope)))
    temps.current.clear()
  }
  const setDesign=(next:CouponDesign)=>{setValue(parseCouponDesign(next)!);setDirty(true);setError('')}
  // Borrador recuperado de la sesión: conserva el draftId para seguir leyendo/limpiando sus imágenes temporales.
  const restore=(saved:{design:CouponDesign;draftId:string})=>{
    const restored=parseCouponDesign(saved.design)!
    let stored:string[]=[];try{stored=couponAssetIds(parseCouponDesign(initialDesign??null))}catch{/* diseño guardado inválido: todo es temporal */}
    couponAssetIds(restored).filter(id=>!stored.includes(id)).forEach(id=>temps.current.add(id))
    initialized.current=key;setDraftId(saved.draftId);setValue(restored);setDirty(true);setError('')
  }
  return{design,assets,draftId,pending,error,dirty,setDesign,restore,upload,cancel,
    payload:()=>{if(pending||designKey!==key||!ready)throw Error('Espera a que terminen de cargar las imágenes');if(error)throw Error(error);return{coupon_design:parseCouponDesign(value.current),coupon_draft_id:draftId}},
    saved:()=>{temps.current.clear();setDirty(false)}}
}
