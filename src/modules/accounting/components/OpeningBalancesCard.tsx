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
 * OpeningBalancesCard - Asiento de apertura (saldos iniciales).
 * Captura saldos de activos y pasivos al iniciar operaciones; la diferencia
 * se cuadra automáticamente contra Capital (3101).
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Scale } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createJournalEntry, type Account } from '@/services/accountingService'
import { fmtQ } from './format'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const OpeningBalancesCard = ({ accounts }: { accounts: Account[] }) => {
  const { toast } = useToast()
  const currentYear = new Date().getFullYear()
  const [date, setDate] = useState(`${currentYear}-01-01`)
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  const assets = useMemo(
    () => accounts.filter((a) => a.active && !a.is_group && a.type === 'ASSET'),
    [accounts],
  )
  const liabilities = useMemo(
    () => accounts.filter((a) => a.active && !a.is_group && a.type === 'LIABILITY'),
    [accounts],
  )
  const capitalAccount = accounts.find((a) => a.code === '3101' && !a.is_group && a.active)

  const value = (id: number) => {
    const n = Number(amounts[id])
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const totalAssets = round2(assets.reduce((s, a) => s + value(a.id), 0))
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + value(a.id), 0))
  const capital = round2(totalAssets - totalLiabilities)

  const canSave = !saving && !!capitalAccount && date !== '' && (totalAssets > 0 || totalLiabilities > 0)

  const handleCreate = async () => {
    if (!capitalAccount) return
    if (!window.confirm(
      `¿Crear el asiento de apertura al ${date}?\n\nActivos: ${fmtQ(totalAssets)} · Pasivos: ${fmtQ(totalLiabilities)} · Capital: ${fmtQ(capital)}`,
    )) return
    setSaving(true)
    try {
      const lines = [
        ...assets.filter((a) => value(a.id) > 0).map((a) => ({ account_id: a.id, debit: value(a.id), credit: 0 })),
        ...liabilities.filter((a) => value(a.id) > 0).map((a) => ({ account_id: a.id, debit: 0, credit: value(a.id) })),
      ]
      if (capital !== 0) {
        lines.push(capital > 0
          ? { account_id: capitalAccount.id, debit: 0, credit: capital }
          : { account_id: capitalAccount.id, debit: -capital, credit: 0 })
      }
      const entry = await createJournalEntry({ date, description: 'Asiento de apertura (saldos iniciales)', lines })
      toast({ title: 'Asiento de apertura creado', description: `${entry.entry_number} · Capital inicial ${fmtQ(capital)}` })
      setAmounts({})
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo crear el asiento', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const renderRows = (list: Account[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {list.map((a) => (
        <div key={a.id} className="space-y-1">
          <Label className="text-xs truncate block">{a.code} — {a.name}</Label>
          <Input
            type="number" min={0} step="0.01" className="h-9" placeholder="0.00"
            value={amounts[a.id] ?? ''}
            onChange={(e) => setAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5" />Saldos iniciales (asiento de apertura)
        </CardTitle>
        <CardDescription>
          Captura lo que el negocio tenía al empezar a usar el sistema (caja, bancos, inventario, deudas).
          La diferencia se registra automáticamente como Capital. Pide las cifras a tu contador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 w-[170px]">
          <Label className="text-xs">Fecha de apertura</Label>
          <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Activos (lo que se tiene)</p>
          {renderRows(assets)}
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Pasivos (lo que se debe)</p>
          {renderRows(liabilities)}
        </div>

        <div className="rounded-md border p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>Activos: <span className="font-semibold">{fmtQ(totalAssets)}</span></span>
          <span>Pasivos: <span className="font-semibold">{fmtQ(totalLiabilities)}</span></span>
          <span>
            Capital (3101): <span className={`font-semibold ${capital < 0 ? 'text-destructive' : ''}`}>{fmtQ(capital)}</span>
          </span>
        </div>

        <Button onClick={handleCreate} disabled={!canSave}>
          {saving ? 'Creando…' : 'Crear asiento de apertura'}
        </Button>
        {!capitalAccount && (
          <p className="text-xs text-destructive">No se encontró la cuenta Capital (3101) activa en el catálogo.</p>
        )}
      </CardContent>
    </Card>
  )
}
