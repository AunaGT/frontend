/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Anticipos de sueldo y su saldo pendiente. La planilla los descuenta sola. */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import {
  cancelAdvance, createAdvance, fetchAdvances, fetchEmployees,
  ADVANCE_STATUS_LABELS, type AdvancePayload,
} from '@/services/hrService'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

const emptyForm: AdvancePayload = { employee_id: '', amount: 0, installment: 0 }

export const AdvancesManagement = () => {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('hr.advances.manage')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AdvancePayload>(emptyForm)

  const { data, isLoading } = useQuery({ queryKey: ['hr-advances'], queryFn: () => fetchAdvances() })
  const { data: employees } = useQuery({
    queryKey: ['hr-employees', 'ACTIVO'],
    queryFn: () => fetchEmployees({ status: 'ACTIVO' }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hr-advances'] })
    qc.invalidateQueries({ queryKey: ['accounting'] })
  }

  const create = useMutation({
    mutationFn: createAdvance,
    onSuccess: () => { invalidate(); setDialogOpen(false); setForm(emptyForm); toast({ title: 'Anticipo otorgado' }) },
    onError: (e: Error) => toast({ title: 'No se pudo otorgar', description: e.message, variant: 'destructive' }),
  })

  const cancel = useMutation({
    mutationFn: cancelAdvance,
    onSuccess: () => { invalidate(); toast({ title: 'Anticipo cancelado' }) },
    onError: (e: Error) => toast({ title: 'No se pudo cancelar', description: e.message, variant: 'destructive' }),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Anticipos</CardTitle>
        {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell>{advance.date.slice(0, 10)}</TableCell>
                  <TableCell>{advance.employee?.first_name} {advance.employee?.last_name}</TableCell>
                  <TableCell className="text-right">{money(advance.amount)}</TableCell>
                  <TableCell className="text-right">{money(advance.installment)}</TableCell>
                  <TableCell className="text-right font-medium">{money(advance.balance)}</TableCell>
                  <TableCell>
                    <Badge variant={advance.status === 'PENDIENTE' ? 'default' : 'secondary'}>
                      {ADVANCE_STATUS_LABELS[advance.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && advance.status === 'PENDIENTE' && Number(advance.balance) === Number(advance.amount) && (
                      <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(advance.id)}>
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin anticipos</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo anticipo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Empleado</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {(employees?.items ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Monto</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Cuota por planilla</Label><Input type="number" step="0.01" value={form.installment} onChange={(e) => setForm({ ...form, installment: Number(e.target.value) })} /></div>
            <div><Label>Motivo</Label><Input value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button disabled={create.isPending} onClick={() => create.mutate(form)}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Otorgar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default AdvancesManagement
