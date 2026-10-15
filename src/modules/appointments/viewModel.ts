import type { SessionDto, BookingStatus, SessionStatus, AgendaEntryDto } from './types'
export type AgendaView = 'day' | 'week' | 'month' | 'list'
export function entryStatusText(row:{status:BookingStatus|SessionStatus;endsAt:string},now=new Date()){
  return !['COMPLETED','CANCELLED','EXPIRED','NO_SHOW'].includes(row.status)&&new Date(row.endsAt)<=now?'Horario terminado · pendiente de cierre':statusLabels[row.status]
}
export function agendaTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-GT', { timeZone: timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(new Date(value))
}
function parts(instant: Date, zone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(p => [p.type, p.value]))
}
export function localDay(instant: string | Date, zone: string) {
  const p = parts(new Date(instant), zone)
  return `${p.year}-${p.month}-${p.day}`
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function localInstant(local: string, zone: string) {
  const wall = new Date(`${local}:00Z`).getTime(), candidates: number[] = []
  if (!Number.isFinite(wall)) throw new Error('Fecha u hora no válida')
  for (const delta of [-86400000, 0, 86400000]) {
    const probe = wall + delta, p = parts(new Date(probe), zone)
    const offset = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`).getTime() - probe
    const candidate = wall - offset, r = parts(new Date(candidate), zone)
    if (`${r.year}-${r.month}-${r.day}T${r.hour}:${r.minute}` === local && !candidates.includes(candidate)) candidates.push(candidate)
  }
  if (!candidates.length) throw new Error('La hora no existe en esta zona')
  if (candidates.length > 1) throw new Error('La hora es ambigua; selecciona un horario de la disponibilidad')
  return new Date(candidates[0]).toISOString()
}
export function agendaRange(date: string, view: AgendaView, zone: string) {
  let start = date, days = view === 'day' ? 1 : 7
  if (view === 'week') start = addDays(date, -((new Date(`${date}T00:00Z`).getUTCDay() + 6) % 7))
  if (view === 'month') { const first = date.slice(0, 8) + '01'; start = addDays(first, -((new Date(`${first}T00:00Z`).getUTCDay() + 6) % 7)); days = 42 }
  return { from: localInstant(`${start}T00:00`, zone), to: localInstant(`${addDays(start, days)}T00:00`, zone) }
}
export function shiftAgendaDate(date: string, view: AgendaView, direction: number) {
  if (view !== 'month') return addDays(date, direction * (view === 'day' ? 1 : 7))
  const [year, month, day] = date.split('-').map(Number), target = new Date(Date.UTC(year, month - 1 + direction, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`
}
export function groupAgendaSessions<T extends Pick<SessionDto,'startsAt'|'endsAt'>>(sessions: T[], zone: string) {
  const groups = new Map<string, T[]>()
  for (const s of sessions) {
    for (let day = localDay(s.startsAt, zone), last = localDay(new Date(new Date(s.endsAt).getTime() - 1), zone); day <= last; day = addDays(day, 1)) {
      if (!groups.has(day)) groups.set(day, [])
      groups.get(day)!.push(s)
    }
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({ date, items: items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }))
}
export function sessionDestination(s: SessionDto) { return s.mode === 'INDIVIDUAL' && s.bookingId ? `/agenda/reservas/${s.bookingId}` : `/agenda/sesiones/${s.id}` }
export function entryDestination(s:Pick<AgendaEntryDto,'recordType'|'id'|'mode'|'bookingId'>) {
  return s.recordType==='ACTIVITY'?`/agenda/actividades/${s.id}`:s.mode==='INDIVIDUAL'&&s.bookingId?`/agenda/reservas/${s.bookingId}`:`/agenda/sesiones/${s.id}`
}
export function configuredBookingProposal(start:string|null,end:string|null,duration:number|null) {
  if(!start||!end||!Number.isFinite(new Date(start).getTime())||!Number.isFinite(new Date(end).getTime())||new Date(end)<=new Date(start))return null
  const requestedMinutes=(new Date(end).getTime()-new Date(start).getTime())/60000
  return {startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),requestedMinutes,
    proposedEnd:duration?new Date(new Date(start).getTime()+duration*60000).toISOString():null,durationMismatch:duration!=null&&duration!==requestedMinutes}
}
export const statusLabels: Record<BookingStatus | SessionStatus, string> = { HELD: 'Retenida', PENDING: 'Pendiente de confirmar', CONFIRMED: 'Confirmada', ARRIVED: 'Llegó', IN_SERVICE: 'En atención', COMPLETED: 'Finalizada', NO_SHOW: 'No asistió', CANCELLED: 'Cancelada', EXPIRED: 'Vencida', SCHEDULED: 'Programada', IN_PROGRESS: 'En curso' }
