import {useCallback,useEffect,useRef,useState} from 'react'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'

type Confirmation={title:string;description:string;confirmText?:string}
export function useTemplateConfirmation(){
  const [prompt,setPrompt]=useState<Confirmation|null>(null)
  const resolver=useRef<((accepted:boolean)=>void)|null>(null)
  const confirm=useCallback((next:Confirmation):Promise<boolean>=>{
    if(resolver.current)return Promise.resolve(false)
    setPrompt(next)
    return new Promise(resolve=>{resolver.current=resolve})
  },[])
  const finish=(accepted:boolean)=>{const resolve=resolver.current;resolver.current=null;setPrompt(null);resolve?.(accepted)}
  useEffect(()=>()=>{resolver.current?.(false);resolver.current=null},[])
  return {confirm,dialog:<ConfirmDialog appearance="auna" variant="warning" open={!!prompt} title={prompt?.title||''} description={prompt?.description||''} confirmText={prompt?.confirmText} onOpenChange={open=>{if(!open)finish(false)}} onConfirm={()=>finish(true)}/>}
}
