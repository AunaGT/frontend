import { TableLoadingRows } from '@/components/shared/LoadingState'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { fetchAttendance, fetchAdvances, ATTENDANCE_STATUS_LABELS, ADVANCE_STATUS_LABELS } from '@/services/hrService'
import { EmployeeHistory } from './EmployeeHistory'

export function EmployeeRecentActivity({ employeeId, onTab }: { employeeId: string; onTab?: (tab: string) => void }) {
  const { hasPermission } = useAuthPermissions(), { timezone } = useSystemSettings()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')!.value, month = parts.find(part => part.type === 'month')!.value
  const from = `${year}-${month}-01`, to = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}`
  const canAttendance = hasPermission('hr.attendance.view'), canAdvances = hasPermission('hr.advances.view')
  const attendance = useQuery({ queryKey: ['hr-attendance', employeeId, from, to], queryFn: () => fetchAttendance({ employee_id: employeeId, from, to }), enabled: canAttendance })
  const advances = useQuery({ queryKey: ['hr-advances', employeeId, 'recent'], queryFn: () => fetchAdvances({ employee_id: employeeId, pageSize: 3 }), enabled: canAdvances })
  return <div className="grid gap-4 xl:grid-cols-3">{canAttendance && <Card className="hr-panel"><CardHeader><CardTitle className="justify-between">Asistencia del mes<Button variant="link" className="text-brand-orange" onClick={() => onTab?.('asistencia')}>Ver todos</Button></CardTitle></CardHeader><CardContent><div className="auna-data-table-shell"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Entrada</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{attendance.isPending && <TableLoadingRows columns={3} message="Cargando asistencia…" />}{attendance.data?.items.slice().sort((a, b) => b.work_date.localeCompare(a.work_date)).slice(0, 5).map(item => <TableRow key={item.id}><TableCell>{item.work_date.slice(0, 10)}</TableCell><TableCell>{item.check_in || '—'}</TableCell><TableCell>{ATTENDANCE_STATUS_LABELS[item.status]}</TableCell></TableRow>)}{!attendance.isPending && !attendance.data?.items.length && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{attendance.isError ? 'No se pudo cargar la asistencia.' : 'Sin marcas este mes.'}</TableCell></TableRow>}</TableBody></Table></div>{attendance.isError && <Button variant="outline" onClick={() => attendance.refetch()}>Reintentar</Button>}</CardContent></Card>}
    {canAdvances && <Card className="hr-panel"><CardHeader><CardTitle className="justify-between">Anticipos<Button variant="link" className="text-brand-orange" onClick={() => onTab?.('anticipos')}>Ver todos</Button></CardTitle></CardHeader><CardContent><div className="auna-data-table-shell"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{advances.isPending && <TableLoadingRows columns={3} message="Cargando anticipos…" />}{advances.data?.items.map(item => <TableRow key={item.id}><TableCell>{item.date.slice(0, 10)}</TableCell><TableCell>Q {Number(item.amount).toFixed(2)}</TableCell><TableCell>{ADVANCE_STATUS_LABELS[item.status]}</TableCell></TableRow>)}{!advances.isPending && !advances.data?.items.length && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{advances.isError ? 'No se pudieron cargar los anticipos.' : 'Sin anticipos.'}</TableCell></TableRow>}</TableBody></Table></div>{advances.isError && <Button variant="outline" onClick={() => advances.refetch()}>Reintentar</Button>}</CardContent></Card>}
    <Card className="hr-panel"><CardHeader><CardTitle className="justify-between">Historial<Button variant="link" className="text-brand-orange" onClick={() => onTab?.('historial')}>Ver todos</Button></CardTitle></CardHeader><CardContent><EmployeeHistory employeeId={employeeId} compact /></CardContent></Card>
  </div>
}
