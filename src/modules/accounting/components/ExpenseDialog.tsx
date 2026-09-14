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
 * ExpenseDialog - Registro rápido de gastos operativos (sueldos, alquileres,
 * servicios, etc.). Genera el asiento: Debe cuenta de gasto / Haber Caja o Bancos.
 */

import { useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Receipt } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createJournalEntry, type Account } from '@/services/accountingService'
import { fmtQ, todayISO } from './format'

export const ExpenseDialog = ({ open, onOpenChange, accounts, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  onSaved: () => void
}) => {
  const { toast } = useToast()
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.active && !a.is_group && a.type === 'EXPENSE'),
    [accounts],
  )
  const payAccounts = useMemo(
    () => accounts.filter((a) => a.active && !a.is_group && a.type === 'ASSET'),
    [accounts],
  )
  // Por defecto se paga desde Caja (1101)
  const defaultPay = payAccounts.find((a) => a.code === '1101')?.id
  const effectivePay = payAccountId || (defaultPay ? String(defaultPay) : '')

  const amountNum = Number(amount)
  const canSave = !saving && date && accountId && effectivePay && description.trim()
    && Number.isFinite(amountNum) && amountNum > 0

  const reset = () => {
    setDate(todayISO())
    setAccountId('')
    setPayAccountId('')
    setDescription('')
    setAmount('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const entry = await createJournalEntry({
        date,
        description: description.trim(),
        lines: [
          { account_id: Number(accountId), debit: amountNum, credit: 0 },
          { account_id: Number(effectivePay), debit: 0, credit: amountNum },
        ],
      })
      toast({ title: 'Gasto registrado', description: `Asiento ${entry.entry_number} por ${fmtQ(amountNum)}` })
      reset()
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo registrar el gasto', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />Registrar gasto
          </DialogTitle>
          <DialogDescription>
            Sueldos, alquileres, servicios y otros gastos operativos. Genera el asiento contable automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto (Q)</Label>
              <Input
                type="number" min={0.01} step="0.01" className="h-9" placeholder="0.00"
                value={amount} onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoría (cuenta de gasto)</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar cuenta de gasto" /></SelectTrigger>
              <SelectContent>
                {expenseAccounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pagado desde</Label>
            <Select value={effectivePay} onValueChange={setPayAccountId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Caja / Bancos" /></SelectTrigger>
              <SelectContent>
                {payAccounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              className="h-9" placeholder="Ej. Sueldo de junio — Juan Pérez" maxLength={255}
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Registrando…' : 'Registrar gasto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
