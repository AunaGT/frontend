import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { fetchAttendance, ATTENDANCE_STATUS_LABELS } from '@/services/hrService'

export function EmployeeAttendance({ employeeId }: { employeeId: string }) {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [year, number] = month.split('-').map(Number)
  const { data, isLoading, isFetching, isError } = useQuery({ queryKey: ['hr-attendance', employeeId, month], queryFn: () => fetchAttendance({ employee_id: employeeId, from: `${month}-01`, to: `${month}-${new Date(year, number, 0).getDate()}` }), enabled: /^\d{4}-\d{2}$/.test(month) })
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Asistencia registrada</h2><Input className="w-44" type="month" aria-label="Mes de asistencia" value={month} onChange={e => setMonth(e.target.value)} /></div><div className="auna-data-table-shell">{isFetching && data && <LoadingIndicator message="Actualizando asistencia…" />}<Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead>Horas extra</TableHead></TableRow></TableHeader><TableBody>{isLoading && <TableLoadingRows columns={3} message="Cargando asistencia…" />}{data?.items.map(item => <TableRow key={item.id}><TableCell>{item.work_date.slice(0, 10)}</TableCell><TableCell>{ATTENDANCE_STATUS_LABELS[item.status]}</TableCell><TableCell>{Number(item.overtime_hours).toFixed(2)}</TableCell></TableRow>)}{!isLoading && !data?.items.length && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">{isError ? 'No se pudo cargar la asistencia.' : 'Sin registros en este mes.'}</TableCell></TableRow>}</TableBody></Table></div><p className="text-sm text-muted-foreground">Las marcas se gestionan desde la hoja mensual de asistencia.</p></section>
}
