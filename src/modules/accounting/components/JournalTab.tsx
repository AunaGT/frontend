/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BookOpen, ChevronDown, ChevronRight, Download, Plus, Receipt, RefreshCcw, Undo2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  getJournal, postPending, reverseJournalEntry,
  type Account, type JournalEntry,
} from '@/services/accountingService'
import { useTenant } from '@/context/useTenant'
import { fmtQ, fmtDate, SOURCE_LABELS , rangoTexto } from './format'
import { exportJournal } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { NewEntryDialog } from './NewEntryDialog'
import { AccountingImportDialog } from './AccountingImportDialog'
import { ExpenseDialog } from './ExpenseDialog'

const entryTotal = (entry: JournalEntry) =>
  entry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)

export const JournalTab = ({ accounts, canCreate }: { accounts: Account[]; canCreate: boolean }) => {
  const { toast } = useToast()
  const { branches } = useTenant()
  const [items, setItems] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [source, setSource] = useState('')
  // '' = todas · 'company' = solo asientos de empresa (manuales, cierre, importación)
  const [branchFilter, setBranchFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await getJournal({ from: from || undefined, to: to || undefined, source: source || undefined, branch_id: branchFilter || undefined, page: p, pageSize: 25 })
      setItems(res.items)
      setPage(res.page)
      setTotalPages(res.totalPages)
      setTotalItems(res.totalItems)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cargar el diario', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [from, to, source, branchFilter, toast])

  useEffect(() => { void load(1) }, [load])

  const handlePostPending = async () => {
    setPosting(true)
    try {
      const res = await postPending()
      toast({
        title: res.hasMore ? 'Contabilización parcial' : 'Contabilización completada',
        description:
          `${res.posted} operaciones contabilizadas` +
          (res.skipped.length ? `, ${res.skipped.length} omitidas (${res.skipped[0].reason})` : '') +
          (res.hasMore ? '. Quedaron más pendientes: vuelva a contabilizar.' : ''),
      })
      void load(1)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo contabilizar', variant: 'destructive' })
    } finally {
      setPosting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Descarga todas las páginas con los filtros activos (el backend pagina a 100 máx.)
      const filters = { from: from || undefined, to: to || undefined, source: source || undefined, branch_id: branchFilter || undefined }
      const all: JournalEntry[] = []
      let p = 1
      let pages = 1
      do {
        const res = await getJournal({ ...filters, page: p, pageSize: 100 })
        all.push(...res.items)
        pages = res.totalPages
        p += 1
      } while (p <= pages)
      if (all.length === 0) {
        toast({ title: 'Sin datos', description: 'No hay asientos en el rango seleccionado' })
        return
      }
      // El diario se exporta en orden cronológico
      all.reverse()
      exportJournal(all, filters)
      toast({ title: 'Excel generado', description: `Libro Diario con ${all.length} asientos` })
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo exportar', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleReverse = async (entry: JournalEntry) => {
    if (!window.confirm(`¿Anular el asiento ${entry.entry_number}? Se creará un contra-asiento.`)) return
    try {
      await reverseJournalEntry(entry.id)
      toast({ title: 'Asiento anulado', description: `Se creó el contra-asiento de ${entry.entry_number}` })
      void load(page)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo anular', variant: 'destructive' })
    }
  }

  const statusBadge = (entry: JournalEntry) => {
    if (entry.reversal_of_id) return <Badge variant="outline">Contra-asiento{entry.reversalOf ? ` de ${entry.reversalOf.entry_number}` : ''}</Badge>
    if (entry.reversals && entry.reversals.length > 0) return <Badge variant="destructive">Anulado</Badge>
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />Libro Diario
            <span className="text-sm font-normal text-muted-foreground">({totalItems} asientos)</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={exporting || totalItems === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exportando…' : 'Exportar'}
            </Button>
            {canCreate && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsExpenseOpen(true)}>
                  <Receipt className="h-4 w-4 mr-2" />Registrar gasto
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />Importar
                </Button>
                <Button variant="outline" size="sm" onClick={handlePostPending} disabled={posting}>
                  <RefreshCcw className={`h-4 w-4 mr-2 ${posting ? 'animate-spin' : ''}`} />
                  {posting ? 'Contabilizando…' : 'Contabilizar pendientes'}
                </Button>
                <Button size="sm" onClick={() => setIsNewOpen(true)} className="bg-liquor-amber hover:bg-liquor-amber/90 text-white">
                  <Plus className="h-4 w-4 mr-2" />Nuevo asiento
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origen</Label>
            <Select value={source || 'all'} onValueChange={(v) => setSource(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {branches.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Sucursal</Label>
              <Select value={branchFilter || 'all'} onValueChange={(v) => setBranchFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="company">Solo empresa</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No hay asientos en el rango seleccionado.</p>
        ) : (
          <div className="rounded-md border divide-y">
            <div className="hidden md:grid grid-cols-[28px_110px_100px_1fr_120px_110px_130px_auto] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
              <span /><span>Número</span><span>Fecha</span><span>Descripción</span><span>Sucursal</span><span>Origen</span><span className="text-right">Total</span><span />
            </div>
            {items.map((entry) => {
              const expanded = expandedId === entry.id
              return (
                <div key={entry.id}>
                  <div
                    className="grid grid-cols-2 md:grid-cols-[28px_110px_100px_1fr_120px_110px_130px_auto] gap-2 px-3 py-2.5 items-center text-sm cursor-pointer hover:bg-muted/40"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <span className="hidden md:block text-muted-foreground">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className="font-medium">{entry.entry_number}</span>
                    <span className="text-muted-foreground">{fmtDate(entry.date)}</span>
                    <span className="truncate col-span-2 md:col-span-1" title={entry.description}>{entry.description}</span>
                    <span className="truncate text-muted-foreground" title={entry.branch?.name ?? 'Empresa'}>
                      {entry.branch?.name ?? 'Empresa'}
                    </span>
                    <span><Badge variant="secondary">{SOURCE_LABELS[entry.source_type]}</Badge></span>
                    <span className="text-right font-medium">{fmtQ(entryTotal(entry))}</span>
                    <span className="flex items-center gap-2 justify-end">
                      {statusBadge(entry)}
                      {canCreate && !entry.reversal_of_id && (!entry.reversals || entry.reversals.length === 0) && entry.source_type !== 'CLOSING' && (
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); void handleReverse(entry) }}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" />Anular
                        </Button>
                      )}
                    </span>
                  </div>
                  {expanded && (
                    <div className="px-4 pb-3 bg-muted/20">
                      <div className="rounded border bg-background overflow-hidden">
                        <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                          <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span>
                        </div>
                        {entry.lines.map((line) => (
                          <div key={line.id} className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1.5 text-sm border-t">
                            <span>{line.account ? `${line.account.code} — ${line.account.name}` : line.account_id}</span>
                            <span className="text-right">{Number(line.debit) > 0 ? fmtQ(line.debit) : ''}</span>
                            <span className="text-right">{Number(line.credit) > 0 ? fmtQ(line.credit) : ''}</span>
                          </div>
                        ))}
                      </div>
                      {entry.createdBy?.name && (
                        <p className="mt-2 text-xs text-muted-foreground">Registrado por {entry.createdBy.name}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>Siguiente</Button>
          </div>
        )}
      </CardContent>

      <NewEntryDialog open={isNewOpen} onOpenChange={setIsNewOpen} accounts={accounts} onSaved={() => void load(1)} />
      <AccountingImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} type="journal" />
      <ExpenseDialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen} accounts={accounts} onSaved={() => void load(1)} />
    </Card>
  )
}
