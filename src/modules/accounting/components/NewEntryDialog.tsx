/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createJournalEntry, type Account } from '@/services/accountingService'
import { fmtQ, todayISO } from './format'

type DraftLine = { account_id: string; debit: string; credit: string }

const emptyLine = (): DraftLine => ({ account_id: '', debit: '', credit: '' })

export const NewEntryDialog = ({ open, onOpenChange, accounts, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  onSaved: () => void
}) => {
  const { toast } = useToast()
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)

  const postables = accounts.filter((a) => a.active && !a.is_group)

  const setLine = (i: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100
  const complete = lines.every((l) => l.account_id && ((Number(l.debit) || 0) > 0) !== ((Number(l.credit) || 0) > 0))
  const canSave = !saving && date && description.trim() && lines.length >= 2 && complete && diff === 0 && totalDebit > 0

  const reset = () => {
    setDate(todayISO())
    setDescription('')
    setLines([emptyLine(), emptyLine()])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await createJournalEntry({
        date,
        description: description.trim(),
        lines: lines.map((l) => ({
          account_id: Number(l.account_id),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      })
      toast({ title: 'Asiento registrado', description: 'El asiento fue creado correctamente' })
      reset()
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo crear el asiento', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo asiento contable</DialogTitle>
          <DialogDescription>Partida doble: la suma del debe debe igualar la del haber.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Descripción</Label>
            <Input
              placeholder="Ej. Pago de alquiler de julio"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_130px_130px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Cuenta</span><span>Debe</span><span>Haber</span><span />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px_36px] gap-2 items-center">
              <Select value={line.account_id} onValueChange={(v) => setLine(i, { account_id: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {postables.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00" className="h-9"
                value={line.debit}
                onChange={(e) => setLine(i, { debit: e.target.value, ...(e.target.value ? { credit: '' } : {}) })}
              />
              <Input
                type="number" min="0" step="0.01" placeholder="0.00" className="h-9"
                value={line.credit}
                onChange={(e) => setLine(i, { credit: e.target.value, ...(e.target.value ? { debit: '' } : {}) })}
              />
              <Button
                variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"
                disabled={lines.length <= 2}
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            <Plus className="h-4 w-4 mr-1" />Agregar línea
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>Debe: <strong>{fmtQ(totalDebit)}</strong></span>
          <span>Haber: <strong>{fmtQ(totalCredit)}</strong></span>
          <Badge variant={diff === 0 && totalDebit > 0 ? 'default' : 'destructive'}>
            {diff === 0 && totalDebit > 0 ? 'Cuadrado' : `Diferencia ${fmtQ(diff)}`}
          </Badge>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Guardando…' : 'Guardar asiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
