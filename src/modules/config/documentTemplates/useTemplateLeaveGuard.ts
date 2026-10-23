import {useContext,useEffect,useRef,type MutableRefObject} from 'react'
import {UNSAFE_NavigationContext} from 'react-router-dom'
import {registerDraftNavigation} from '@/lib/draftNavigation'
import type {useTemplateConfirmation} from './useTemplateConfirmation'
export type TemplateExitGuard=(proceed?:()=>void)=>boolean
export function useTemplateLeaveGuard(activity:MutableRefObject<{dirty:boolean;pending:boolean}>,register:(guard:TemplateExitGuard)=>()=>void,onMessage:(message:string)=>void,confirm:ReturnType<typeof useTemplateConfirmation>['confirm']){
  const context=useContext(UNSAFE_NavigationContext),approved=useRef(false),unloadApproved=useRef(false),message=useRef(onMessage),confirmation=useRef(confirm);message.current=onMessage;confirmation.current=confirm
  const requestLeave=(proceed?:()=>void,unloads=false)=>{
    if(approved.current)return true
    unloadApproved.current=false
    if(activity.current.pending){message.current('Espera a que termine la operación del documento antes de salir.');return false}
    if(!activity.current.dirty)return true
    void confirmation.current({title:'¿Salir sin guardar?',description:'Hay cambios sin guardar en el diseño. Si sales, se descartarán.',confirmText:'Descartar y salir'}).then(accepted=>{
      if(!accepted||activity.current.pending)return
      approved.current=true;unloadApproved.current=unloads
      try{proceed?.()}finally{approved.current=false}
    })
    return false
  }
  const canLeave:TemplateExitGuard=proceed=>requestLeave(proceed)
  useEffect(()=>{
    const unregister=register(proceed=>requestLeave(proceed,true))
    const unroute=context?.navigator?registerDraftNavigation(context.navigator,run=>{if(canLeave(run))run()}):undefined
    const unload=(e:BeforeUnloadEvent)=>{
      if(approved.current||unloadApproved.current){unloadApproved.current=false;return}
      if(activity.current.dirty||activity.current.pending){e.preventDefault();e.returnValue=''}
    }
    // A confirmed reload may dispatch beforeunload after its initiating callback returns.
    const revokeUnload=()=>{unloadApproved.current=false}
    const click=(e:MouseEvent)=>{
      if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return
      const anchor=(e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement|null
      if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download')||anchor.getAttribute('href')?.startsWith('#'))return
      if(!requestLeave(()=>anchor.click(),true)){e.preventDefault();e.stopImmediatePropagation()}
    }
    window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true)
    document.addEventListener('pointerdown',revokeUnload,true);document.addEventListener('keydown',revokeUnload,true)
    return()=>{unregister();unroute?.();window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);document.removeEventListener('pointerdown',revokeUnload,true);document.removeEventListener('keydown',revokeUnload,true)}
  },[register,activity,context?.navigator])
  return canLeave
}
