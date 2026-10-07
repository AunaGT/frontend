import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Wallet, History, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchEmployeeOverview, PAYMENT_METHOD_LABELS, type Employee } from '@/services/hrService'
import { EmployeeRecentActivity } from './EmployeeRecentActivity'

export function EmployeeSummary({ employee, onTab }: { employee: Employee; onTab?: (tab: string) => void }) {
  const query = useQuery({ queryKey: ['hr-employee-overview', employee.id], queryFn: () => fetchEmployeeOverview(employee.id) })
  const money = (value: string) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value))
  const sections = [
    { title: 'Datos personales', rows: [['Nombre completo', `${employee.first_name} ${employee.last_name}`], ['DPI', employee.dpi], ['NIT', employee.nit], ['Nacimiento', employee.birth_date?.slice(0, 10)], ['Teléfono', employee.phone], ['Correo electrónico', employee.email], ['Dirección', employee.address]] },
    { title: 'Datos laborales', rows: [['Puesto', employee.position], ['Departamento', employee.department], ['Sucursal', employee.branch?.name], ['Fecha de ingreso', employee.hire_date.slice(0, 10)], ['Contrato', { INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo fijo', POR_OBRA: 'Por obra' }[employee.contract_type]], ['Salario base', money(employee.base_salary)], ['Bonificación', money(employee.bonificacion_incentivo)], ['Frecuencia de pago', employee.pay_frequency === 'MENSUAL' ? 'Mensual' : 'Quincenal'], ['Forma de pago', PAYMENT_METHOD_LABELS[employee.payment_method]], ...(employee.payment_method === 'TRANSFERENCIA' ? [['Banco', employee.bank_name], ['Cuenta', employee.bank_account]] : []), ['IGSS', employee.igss_number || 'No afiliado'], ['Usuario vinculado', employee.user?.name || 'Sin vincular']] },
  ]
  sections[0].rows.push(['Género', employee.gender], ['Estado civil', employee.marital_status], ['Nacionalidad', employee.nationality])
  sections[1].rows.push(['Jornada', employee.workday], ['Horario', employee.work_schedule], ['Supervisor', employee.supervisor ? `${employee.supervisor.first_name} ${employee.supervisor.last_name}` : null])
  const overview = query.data
  return <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-3">{sections.map(section => <Card key={section.title} className="auna-surface hr-panel"><CardHeader><CardTitle>{section.title}</CardTitle></CardHeader><CardContent><dl className="space-y-3">{section.rows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value || '—'}</dd></div>)}</dl></CardContent></Card>)}<Card className="auna-surface hr-panel"><CardHeader><CardTitle>Resumen rápido</CardTitle></CardHeader><CardContent className="space-y-3">{query.isFetching && query.data && <LoadingIndicator message="Actualizando resumen…" />}{query.isPending ? <LoadingState variant="detail" message="Cargando resumen…" /> : query.isError ? <div><p className="text-sm text-destructive">No se pudo cargar el resumen.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div> : <>
    {overview?.attendance && <button onClick={() => onTab?.('asistencia')} className="hr-summary-link"><CalendarDays /><span>Asistencia del mes<strong>{overview.attendance.present} / {overview.attendance.marked} marcas</strong><small>Sobre los registros existentes, no días programados.</small></span></button>}
    {overview?.advances && <button onClick={() => onTab?.('anticipos')} className="hr-summary-link"><Wallet /><span>Anticipos pendientes<strong>{overview.advances.count} · {money(overview.advances.balance)}</strong></span></button>}
    <button onClick={() => onTab?.('historial')} className="hr-summary-link"><History /><span>Movimientos recientes<strong>{overview?.history.count ?? 0}</strong><small>Últimos 3 meses</small></span></button>
    {overview?.documents && <button onClick={() => onTab?.('documentos')} className="hr-summary-link"><ShieldCheck /><span>Documentos requeridos<strong>{overview.documents.complete ? 'Completos' : `${overview.documents.missingRequired.length} pendientes`}</strong></span></button>}
  </>}</CardContent></Card></div><EmployeeRecentActivity employeeId={employee.id} onTab={onTab} /></div>
}
