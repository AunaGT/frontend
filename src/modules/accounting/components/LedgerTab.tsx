/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BookText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getLedger, type Account, type LedgerResponse } from '@/services/accountingService'
import { fmtQ, fmtDate, rangoTexto } from './format'
import { exportLedger } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'

export const LedgerTab = ({ accounts }: { accounts: Account[] }) => {
  const { toast } = useToast()
  const [accountId, setAccountId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<LedgerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const postables = accounts.filter((a) => !a.is_group)

  useEffect(() => {
    if (!accountId) { setData(null); return }
    let active = true
    setLoading(true)
    getLedger(Number(accountId), { from: from || undefined, to: to || undefined })
      .then((res) => { if (active) setData(res) })
      .catch((e) => {
        if (active) toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el mayor', variant: 'destructive' })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [accountId, from, to, toast])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookText className="h-5 w-5" />Libro Mayor
          </CardTitle>
          <Button
            variant="outline" size="sm"
            disabled={!data || loading}
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-4 w-4 mr-2" />Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[280px] h-9">
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {postables.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {!accountId ? (
          <p className="py-10 text-center text-muted-foreground">Seleccione una cuenta para ver su mayor.</p>
        ) : loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : data && (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Fecha</th>
                  <th className="text-left font-medium px-3 py-2">Asiento</th>
                  <th className="text-left font-medium px-3 py-2">Descripción</th>
                  <th className="text-right font-medium px-3 py-2">Debe</th>
                  <th className="text-right font-medium px-3 py-2">Haber</th>
                  <th className="text-right font-medium px-3 py-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t bg-muted/20">
                  <td colSpan={5} className="px-3 py-2 font-medium">Saldo inicial</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtQ(data.initialBalance)}</td>
                </tr>
                {data.movements.length === 0 && (
                  <tr className="border-t">
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Sin movimientos en el rango.</td>
                  </tr>
                )}
                {data.movements.map((m, i) => (
                  <tr key={`${m.entry_id}-${i}`} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(m.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{m.entry_number}</td>
                    <td className="px-3 py-2 max-w-[320px] truncate" title={m.description}>{m.description}</td>
                    <td className="px-3 py-2 text-right">{m.debit > 0 ? fmtQ(m.debit) : ''}</td>
                    <td className="px-3 py-2 text-right">{m.credit > 0 ? fmtQ(m.credit) : ''}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtQ(m.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/40 font-semibold">
                  <td colSpan={3} className="px-3 py-2">Totales</td>
                  <td className="px-3 py-2 text-right">{fmtQ(data.totals.debit)}</td>
                  <td className="px-3 py-2 text-right">{fmtQ(data.totals.credit)}</td>
                  <td className="px-3 py-2 text-right">{fmtQ(data.finalBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar libro mayor"
        summary={`${data?.account ? `${data.account.code} — ${data.account.name}` : 'Cuenta sin elegir'}. ${rangoTexto(from, to)} (${data?.movements.length ?? 0} movimiento(s)).`}
        formats={['xlsx']}
        onExport={() => {
          if (data) exportLedger(data, { from: from || undefined, to: to || undefined })
          setExportOpen(false)
        }}
      />
    </Card>
  )
}
