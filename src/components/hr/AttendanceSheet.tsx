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
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  fetchAttendance, fetchEmployees, saveAttendance,
  ATTENDANCE_STATUS_LABELS, type AttendanceStatus,
} from '@/services/hrService'

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
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
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
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background px-2 py-1 text-left">Empleado</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className="w-7 px-1 py-1 text-center font-normal text-muted-foreground">{i + 1}</th>
                  ))}
                  <th className="px-2 py-1 text-right">Extra</th>
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
                      <td key={date} className="p-0.5">
                        <button
                          type="button"
                          title={`${mark ? ATTENDANCE_STATUS_LABELS[mark.status] : 'Sin marca'} · clic para cambiar, shift+clic para horas extra`}
                          className={`h-6 w-6 rounded text-[10px] ${mark ? CELL_CLASS[mark.status] : 'bg-muted'}`}
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
                    <tr key={employee.id}>
                      <td className="sticky left-0 bg-background whitespace-nowrap px-2 py-1">
                        {employee.first_name} {employee.last_name}
                      </td>
                      {cells}
                      <td className="px-2 py-1 text-right font-medium">{totalOvertime.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
