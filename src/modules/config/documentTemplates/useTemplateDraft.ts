import {useEffect,useRef,useState} from 'react'
import * as api from './api'
import type {TemplateScope,Schema,TemplateRow,Design,PaperFormat,DocumentPurpose} from './types'
const signature=(name:string,design?:Design)=>JSON.stringify({name,design})
export function useTemplateDraft({scope,id,baseId='CLASSIC',format='LETTER',purpose='INTERNAL_RECEIPT'}:{scope:TemplateScope;id?:string;baseId?:string;format?:PaperFormat;purpose?:DocumentPurpose}){
  const [reloadKey,setReloadKey]=useState(0)
  const key=JSON.stringify([scope,id,baseId,format,purpose,reloadKey]),live=useRef({key,active:true,controller:new AbortController()})
  if(live.current.key!==key){live.current.active=false;live.current.controller.abort();live.current={key,active:true,controller:new AbortController()}}
  const owner=live.current,current=()=>owner.active&&live.current===owner
  const [schema,setSchema]=useState<Schema>(),[row,setRow]=useState<TemplateRow>(),[design,setDesignState]=useState<Design>(),[name,setNameState]=useState('Mi diseño')
  const [saved,setSaved]=useState(''),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState('')
  const busy=useRef(false),operation=useRef<{signature:string;requestKey:string}>()
  const acceptSaved=(next:TemplateRow)=>{if(!current())return;setRow(next);setNameState(next.name);setDesignState(next.design);setSaved(signature(next.name,next.design));operation.current=undefined;setError('')}
  useEffect(()=>{
    owner.active=true;setLoading(true);setError('')
    void Promise.all([api.templateSchema(scope,owner.controller.signal),id?api.getTemplate(scope,id,owner.controller.signal):Promise.resolve(undefined)]).then(([manifest,record])=>{
      if(!current())return
      setSchema(manifest)
      if(record)acceptSaved(record)
      else {const presets=purpose==='FEL_INVOICE'?manifest.fiscalPresets:manifest.presets;if(!presets)throw new Error('Actualiza el servidor antes de crear diseños FEL');const initial=structuredClone(presets[baseId]?.[format]||presets.CLASSIC.LETTER);setDesignState(initial);setRow(undefined);setNameState(purpose==='FEL_INVOICE'?'Mi factura FEL':'Mi diseño');setSaved('')}
    }).catch(e=>{if(current()&&e.name!=='AbortError')setError(e.message)}).finally(()=>{if(current())setLoading(false)})
    return()=>{owner.active=false;owner.controller.abort()}
  },[key,reloadKey])
  async function save(override?:Design){
    if(!current()||busy.current||!design||loading)return null
    const nextDesign=override||design,inputSignature=signature(name,nextDesign)
    if(operation.current?.signature!==inputSignature)operation.current={signature:inputSignature,requestKey:crypto.randomUUID()}
    busy.current=true;setPending(true);setError('')
    try {
      const result=await api.saveTemplate(scope,{...(row?{id:row.id}:{}),expectedVersion:row?.version||0,name,design:nextDesign,requestKey:operation.current.requestKey},owner.controller.signal)
      if(!current())return null;acceptSaved(result);return result
    }catch(e){if(current()&&(e as Error).name!=='AbortError')setError((e as Error).message);return null}
    finally{busy.current=false;if(current())setPending(false)}
  }
  return {schema,row,design,name,loading,pending,error,setError,dirty:!!design&&signature(name,design)!==saved,
    setName:(value:string)=>{if(current()&&!busy.current)setNameState(value)},setDesign:(value:Design)=>{if(current()&&!busy.current)setDesignState(value)},
    save,acceptSaved,signal:owner.controller.signal,reload:()=>{if(current())setReloadKey(n=>n+1)}}
}
