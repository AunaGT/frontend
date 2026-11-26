import {useState} from 'react'

export function CatalogImage({name,src,className=''}:{name:string;src?:string|null;className?:string}){
 const [failed,setFailed]=useState<string|null>(null)
 const source=src&&failed!==src?src:'/placeholder.svg'
 return <div className={'flex items-center justify-center overflow-hidden rounded-lg '+className}>
  <img src={source} alt={source==='/placeholder.svg'?'Sin imagen de '+name:name} loading="lazy" className="h-full w-full object-contain" onError={source!=='/placeholder.svg'?()=>setFailed(src!):undefined}/>
 </div>
}
