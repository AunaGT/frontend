import {useRef,useState,type ReactNode} from 'react'
import {pointerMinute,selectionRange,type CalendarSelection} from '../calendarSelection'
const isControl=(target:EventTarget|null,current:EventTarget)=>target!==current&&!!(target as HTMLElement)?.closest?.('button,a,input,select,textarea,[data-agenda-event]')
export function AgendaDayColumn({day,from,to,timezone,onSelect,children}: {day:string;from:number;to:number;timezone:string;onSelect?:(s:CalendarSelection)=>void;children:ReactNode}) {
  const gesture=useRef<{anchor:number;id:number;x:number;y:number;touch:boolean;moved:boolean}|null>(null)
  const last=useRef({key:'',at:0}),[preview,setPreview]=useState<{start:number;end:number}|null>(null),[cursor,setCursor]=useState(540),[error,setError]=useState('')
  const cancel=()=>{gesture.current=null;setPreview(null)}
  const emit=(anchor:number,end=anchor)=>{
    try{const s=selectionRange({day,anchorMinutes:anchor,endMinutes:end,timezone}),key=JSON.stringify(s)
      if(last.current.key===key&&Date.now()-last.current.at<500)return
      last.current={key,at:Date.now()};setError('');onSelect?.(s)
    }catch(e){setError(e instanceof Error?e.message:'Selecciona otra hora')}
  }
  return <div className="agenda-day-column" tabIndex={onSelect?0:undefined} aria-label={`${day}. Hora ${Math.floor(cursor/60)}:${String(cursor%60).padStart(2,'0')}. Flechas para cambiar, Enter para agendar.`}
    onDoubleClick={e=>{if(onSelect&&!isControl(e.target,e.currentTarget)){e.currentTarget.focus?.();emit(pointerMinute(from,to,e.currentTarget.getBoundingClientRect(),e.clientY))}}}
    onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Escape'){cancel();return}if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setCursor(m=>Math.max(from,Math.min(to-15,m+(e.key==='ArrowUp'?-15:15))))}else if((e.key==='Enter'||e.key===' ')&&onSelect){e.preventDefault();emit(cursor)}}}
    onPointerDown={e=>{if(!onSelect||e.button!==0||isControl(e.target,e.currentTarget))return;e.currentTarget.focus?.();gesture.current={anchor:pointerMinute(from,to,e.currentTarget.getBoundingClientRect(),e.clientY),id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType!=='mouse',moved:false};if(e.pointerType==='mouse'){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)}}}
    onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)g.moved=true;if(g.touch)return;const m=pointerMinute(from,to,e.currentTarget.getBoundingClientRect(),e.clientY);setPreview({start:Math.min(g.anchor,m),end:Math.max(g.anchor,m)+(m===g.anchor?30:0)})}}
    onPointerCancel={cancel} onPointerUp={e=>{const g=gesture.current;cancel();if(!g||g.id!==e.pointerId||isControl(e.target,e.currentTarget)||(g.touch&&g.moved))return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;emit(g.anchor,g.moved?pointerMinute(from,to,r,e.clientY):g.anchor)}}>
    {preview&&<div className="agenda-selection" aria-hidden="true" style={{top:`${(preview.start-from)/(to-from)*100}%`,height:`${(preview.end-preview.start)/(to-from)*100}%`}}>Nuevo tramo</div>}{error&&<p role="alert" className="relative z-10 p-2 text-xs text-destructive">{error}</p>}{children}
  </div>
}
