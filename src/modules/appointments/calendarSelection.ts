import { addDays, localInstant } from './viewModel'
export type CalendarSelection = { date:string; startsAt?:string; endsAt?:string; timezone:string }
export function selectionRange({day,anchorMinutes,endMinutes,timezone}: {day:string;anchorMinutes:number;endMinutes:number;timezone:string}):CalendarSelection {
  const anchor=Math.round(anchorMinutes/15)*15,end=Math.round(endMinutes/15)*15
  const lower=Math.min(anchor,end),upper=Math.max(anchor,end)+(anchor===end?30:0)
  const at=(m:number)=>localInstant(`${addDays(day,Math.floor(m/1440))}T${String(Math.floor(m%1440/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`,timezone)
  return {date:day,startsAt:at(lower),endsAt:at(upper),timezone}
}
export function pointerMinute(from:number,to:number,rect:{top:number;height:number},y:number) {
  return Math.max(from,Math.min(to-15,Math.round((from+(y-rect.top)/rect.height*(to-from))/15)*15))
}
