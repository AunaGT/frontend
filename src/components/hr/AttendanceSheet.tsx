/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Hoja de asistencia del mes: una fila por empleado, una columna por día.
 * Un clic cicla el estado de la celda. Las horas extra se editan en el diálogo
 * y son lo único que la nómina lee de aquí.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  fetchAttendance, fetchEmployees, saveAttendance,
  ATTENDANCE_STATUS_LABELS, type AttendanceStatus, type Employee,
} from '@/services/hrService'

const initials = (employee: Employee) =>
  `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase()

const EmployeeAvatar = ({ employee }: { employee: Employee }) =>
  employee.photo_url ? (
    <img
      src={employee.photo_url}
      alt={`${employee.first_name} ${employee.last_name}`}
      className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-liquor-amber/15 text-[10px] font-semibold text-liquor-amber ring-1 ring-liquor-amber/25">
      {initials(employee)}
    </div>
  )

/** El orden del ciclo al hacer clic en una celda. */
const CYCLE: AttendanceStatus[] = ['PRESENTE', 'TARDE', 'AUSENTE', 'VACACIONES', 'INCAPACIDAD', 'PERMISO', 'ASUETO']

/**
 * La inicial no sirve: Presente/Permiso y Ausente/Asueto empiezan igual, y el
 * color solo no alcanza para quien no distingue verde de gris.
 */
const CELL_LETTER: Record<AttendanceStatus, string> = {
  PRESENTE: 'P',
  TARDE: 'T',
  AUSENTE: 'A',
  VACACIONES: 'V',
  INCAPACIDAD: 'I',
  PERMISO: 'M',
  ASUETO: 'F',
}

const CELL_CLASS: Record<AttendanceStatus, string> = {
  PRESENTE: 'bg-emerald-100 text-emerald-900',
  TARDE: 'bg-amber-100 text-amber-900',
  AUSENTE: 'bg-red-100 text-red-900',
  VACACIONES: 'bg-sky-100 text-sky-900',
  INCAPACIDAD: 'bg-violet-100 text-violet-900',
  PERMISO: 'bg-slate-200 text-slate-900',
  ASUETO: 'bg-teal-100 text-teal-900',
}

const pad = (n: number) => String(n).padStart(2, '0')
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const AttendanceSheet = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('hr.attendance.manage')

  const [month, setMonth] = useState(monthKey(new Date()))
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const from = `${month}-01`
  const to = `${month}-${pad(daysInMonth)}`
  const shiftMonth = (delta: number) => setMonth(monthKey(new Date(year, monthNumber - 1 + delta, 1)))

  const [detail, setDetail] = useState<{ employeeId: string; date: string } | null>(null)
  const [overtime, setOvertime] = useState(0)

  const { data: employees } = useQuery({
    queryKey: ['hr-employees', 'ACTIVO'],
    queryFn: () => fetchEmployees({ status: 'ACTIVO' }),
  })
  const { data: attendance, isLoading } = useQuery({
    queryKey: ['hr-attendance', from, to],
    queryFn: () => fetchAttendance({ from, to }),
  })

  const byKey = new Map(
    (attendance?.items ?? []).map((a) => [`${a.employee_id}|${a.work_date.slice(0, 10)}`, a]),
  )

  const save = useMutation({
    mutationFn: saveAttendance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance'] })
      setDetail(null)
    },
    onError: (e: Error) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
  })

  const cycle = (employeeId: string, date: string) => {
    if (!canManage) return
    const current = byKey.get(`${employeeId}|${date}`)
    const next = CYCLE[(CYCLE.indexOf(current?.status ?? 'ASUETO') + 1) % CYCLE.length]
    save.mutate({
      employee_id: employeeId,
      work_date: date,
      status: next,
      overtime_hours: Number(current?.overtime_hours ?? 0),
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Asistencia</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[8.5rem] px-1 text-center text-sm font-medium">
              {MONTH_NAMES[monthNumber - 1]} {year}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" aria-label="Ir a un mes" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            {/* Los chips son idénticos a las celdas: la leyenda se lee mirando, no traduciendo. */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/30 px-3 py-2">
              {CYCLE.map((status) => (
                <span key={status} className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium ${CELL_CLASS[status]}`}
                  >
                    {CELL_LETTER[status]}
                  </span>
                  <span className="text-muted-foreground">{ATTENDANCE_STATUS_LABELS[status]}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs">
                <span className="h-5 w-5 rounded bg-muted" />
                <span className="text-muted-foreground">Sin marcar</span>
              </span>
            </div>
            <div className="rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">Empleado</th>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <th key={i} className="w-7 px-1 py-2 text-center font-normal text-muted-foreground">{i + 1}</th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {(employees?.items ?? []).map((employee) => {
                    let totalOvertime = 0
                    const cells = Array.from({ length: daysInMonth }, (_, i) => {
                      const date = `${month}-${pad(i + 1)}`
                      const mark = byKey.get(`${employee.id}|${date}`)
                      totalOvertime += Number(mark?.overtime_hours ?? 0)
                      return (
                        <td key={date} className="p-0.5 text-center">
                          <button
                            type="button"
                            title={`${mark ? ATTENDANCE_STATUS_LABELS[mark.status] : 'Sin marca'} · clic para cambiar, shift+clic para horas extra`}
                            className={`h-6 w-6 rounded-md text-[10px] font-medium transition-transform hover:scale-105 ${mark ? CELL_CLASS[mark.status] : 'bg-muted hover:bg-muted-foreground/10'} ${!canManage ? 'cursor-default' : ''}`}
                            onClick={(event) => {
                              if (!canManage) return
                              if (event.shiftKey) {
                                setOvertime(Number(mark?.overtime_hours ?? 0))
                                setDetail({ employeeId: employee.id, date })
                                return
                              }
                              cycle(employee.id, date)
                            }}
                          >
                            {mark ? CELL_LETTER[mark.status] : ''}
                          </button>
                        </td>
                      )
                    })
                    return (
                      <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <EmployeeAvatar employee={employee} />
                            <span>{employee.first_name} {employee.last_name}</span>
                          </div>
                        </td>
                        {cells}
                        <td className="px-3 py-1.5 text-right font-medium">
                          {totalOvertime > 0 ? totalOvertime.toFixed(2) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {(employees?.items ?? []).length === 0 && (
                    <tr>
                      <td colSpan={daysInMonth + 2} className="py-8 text-center text-muted-foreground">
                        Sin empleados activos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Un clic avanza al siguiente estado en el orden de la leyenda; shift+clic edita las
              horas extra del día. La asistencia no descuenta días del sueldo: solo las horas extra
              pasan a la planilla.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Horas extra del {detail?.date}</DialogTitle>
            <DialogDescription className="sr-only">
              Editar las horas extra registradas para este empleado en este día.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Horas extra</Label>
            <Input type="number" step="0.5" min={0} max={24} value={overtime} onChange={(e) => setOvertime(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Cancelar</Button>
            <Button
              disabled={save.isPending}
              onClick={() => detail && save.mutate({
                employee_id: detail.employeeId,
                work_date: detail.date,
                overtime_hours: overtime,
                status: byKey.get(`${detail.employeeId}|${detail.date}`)?.status ?? 'PRESENTE',
              })}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default AttendanceSheet
