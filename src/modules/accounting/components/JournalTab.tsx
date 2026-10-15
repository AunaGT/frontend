/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChevronDown, ChevronRight, Download, MoreHorizontal, Plus, Receipt, RefreshCcw, Undo2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {
  getJournal, postPending, reverseJournalEntry,
  type Account, type JournalEntry,
} from '@/services/accountingService'
import { useTenant } from '@/context/useTenant'
import { fmtQ, fmtDate, SOURCE_LABELS , rangoTexto } from './format'
import { exportJournal } from './exportExcel'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { NewEntryDialog } from './NewEntryDialog'
import { ExpenseDialog } from './ExpenseDialog'

const entryTotal = (entry: JournalEntry) =>
  entry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)

export const JournalTab = ({ accounts, canCreate }: { accounts: Account[]; canCreate: boolean }) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { branches, company } = useTenant()
  const { timezone } = useSystemSettings()
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
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await getJournal({ from: from || undefined, to: to || undefined, source: source || undefined, branch_id: branchFilter || undefined, page: p, pageSize: 25 })
      setItems(res.items)
      setPage(res.page)
      setTotalPages(res.totalPages)
      setTotalItems(res.totalItems)
    } catch (e) {
      setLoadError(true)
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

  const handleExport = async (fileName?: string) => {
    if (exporting) return
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
      await exportJournal(all, filters, fileName, { companyName: company?.name || 'Empresa', timezone, scopeLabel: branchFilter === 'company' ? 'Solo empresa' : branches.find(branch => branch.id === branchFilter)?.name || 'Todas las sucursales' })
      setExportOpen(false)
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
    <section className="space-y-5" aria-label="Libro Diario">
      <MetricStrip label="Resumen del diario" loading={loading} items={[
        { label: 'Asientos consultados', value: loadError ? '—' : totalItems },
        { label: 'Período', value: rangoTexto(from, to) },
        { label: 'Ámbito', value: branchFilter === 'company' ? 'Solo empresa' : branches.find(b => b.id === branchFilter)?.name || 'Todas las sucursales' },
      ]} />
      <CompactFilterPanel title="Filtros de diario"
        search={<p className="py-2 text-sm text-muted-foreground">Libro Diario · {totalItems} asientos</p>}
        actions={<>
          <Button variant="outline" onClick={() => setExportOpen(true)} disabled={exporting || loading || loadError || totalItems === 0}><Download className="h-4 w-4 mr-2" />{exporting ? 'Exportando…' : 'Exportar'}</Button>
          {canCreate && <>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal className="h-4 w-4 mr-2" />Más opciones</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setIsExpenseOpen(true)}><Receipt className="h-4 w-4 mr-2" />Registrar gasto</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/contabilidad/importar?type=journal')}><Upload className="h-4 w-4 mr-2" />Importar</DropdownMenuItem>
                <DropdownMenuItem disabled={posting} onSelect={() => void handlePostPending()}><RefreshCcw className="h-4 w-4 mr-2" />{posting ? 'Contabilizando…' : 'Contabilizar pendientes'}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setIsNewOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuevo asiento</Button>
          </>}
        </>}
        activeCount={Number(from !== '') + Number(to !== '') + Number(Boolean(source)) + Number(Boolean(branchFilter))}
        onClear={() => { setFrom(''); setTo(''); setSource(''); setBranchFilter('') }}
        appliedFilters={[
          ...(from ? [{ label: `Desde: ${from}`, onRemove: () => setFrom('') }] : []),
          ...(to ? [{ label: `Hasta: ${to}`, onRemove: () => setTo('') }] : []),
          ...(source ? [{ label: `Origen: ${SOURCE_LABELS[source] || source}`, onRemove: () => setSource('') }] : []),
          ...(branchFilter ? [{ label: `Sucursal: ${branchFilter === 'company' ? 'Solo empresa' : branches.find(b => b.id === branchFilter)?.name || 'Seleccionada'}`, onRemove: () => setBranchFilter('') }] : []),
        ]}>
        <div className="space-y-1"><Label>Desde</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="space-y-1"><Label>Origen</Label><Select value={source || 'all'} onValueChange={v => setSource(v === 'all' ? '' : v)}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(SOURCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        {branches.length > 1 && <div className="space-y-1"><Label>Sucursal</Label><Select value={branchFilter || 'all'} onValueChange={v => setBranchFilter(v === 'all' ? '' : v)}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="company">Solo empresa</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
      </CompactFilterPanel>
      {posting && <LoadingIndicator message="Contabilizando operaciones pendientes…" />}
      {loading ? <LoadingState message="Cargando asientos…" columns={['Número', 'Fecha', 'Descripción', 'Sucursal', 'Origen', 'Total', 'Acciones']} /> : loadError ? <div role="alert" className="py-8 text-center"><p>No se pudo cargar el diario.</p><Button variant="outline" className="mt-3" onClick={() => void load(page)}>Reintentar</Button></div> : <>
        <div className="auna-data-table-shell overflow-x-auto">
          <table className="auna-data-table">
            <thead><tr><th>Número</th><th>Fecha</th><th>Descripción</th><th>Sucursal</th><th>Origen</th><th className="text-right">Total</th><th className="text-right">Acciones</th></tr></thead>
            <tbody>
              {!items.length && <tr><td colSpan={7} className="text-center text-muted-foreground">No hay asientos en el rango seleccionado.</td></tr>}
              {items.map(entry => {
                const expanded = expandedId === entry.id
                return <Fragment key={entry.id}>
                  <tr>
                    <td className="whitespace-nowrap"><Button variant="ghost" size="sm" className="font-semibold" aria-expanded={expanded} aria-controls={`entry-lines-${entry.id}`} aria-label={`Ver líneas del asiento ${entry.entry_number}`} onClick={() => setExpandedId(expanded ? null : entry.id)}>{expanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}{entry.entry_number}</Button></td>
                    <td className="whitespace-nowrap text-muted-foreground">{fmtDate(entry.date)}</td>
                    <td className="min-w-40 max-w-80" title={entry.description}>{entry.description}</td>
                    <td className="text-muted-foreground">{entry.branch?.name ?? 'Empresa'}</td>
                    <td><Badge variant="secondary">{SOURCE_LABELS[entry.source_type]}</Badge></td>
                    <td className="text-right whitespace-nowrap font-medium">{fmtQ(entryTotal(entry))}</td>
                    <td className="text-right"><div className="flex items-center justify-end gap-2">{statusBadge(entry)}{canCreate && !entry.reversal_of_id && (!entry.reversals || entry.reversals.length === 0) && entry.source_type !== 'CLOSING' && <Button variant="ghost" size="sm" aria-label={`Anular asiento ${entry.entry_number}`} onClick={() => void handleReverse(entry)}><Undo2 className="h-4 w-4 mr-1" />Anular</Button>}</div></td>
                  </tr>
                  {expanded && <tr id={`entry-lines-${entry.id}`} className="accounting-journal-lines"><td colSpan={7}>
                    <table aria-label={`Líneas del asiento ${entry.entry_number}`} className="auna-data-table">
                      <thead><tr><th>Cuenta</th><th className="text-right">Debe</th><th className="text-right">Haber</th></tr></thead>
                      <tbody>{entry.lines.map(line => <tr key={line.id}><td>{line.account ? `${line.account.code} — ${line.account.name}` : line.account_id}</td><td className="text-right">{Number(line.debit) > 0 ? fmtQ(line.debit) : ''}</td><td className="text-right">{Number(line.credit) > 0 ? fmtQ(line.credit) : ''}</td></tr>)}</tbody>
                    </table>
                    {entry.createdBy?.name && <p className="mt-2 text-xs text-muted-foreground">Registrado por {entry.createdBy.name}</p>}
                  </td></tr>}
                </Fragment>
              })}
            </tbody>
          </table>
        </div>
        <div className="auna-pagination-outside"><Pagination currentPage={page} totalPages={totalPages} onPageChange={p => void load(p)} totalItems={totalItems} count={items.length} pageSize={25} itemLabel="asientos" /></div>
      </>}
      <NewEntryDialog open={isNewOpen} onOpenChange={setIsNewOpen} accounts={accounts} onSaved={() => void load(1)} />
      <ExpenseDialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen} accounts={accounts} onSaved={() => void load(1)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="Exportar libro diario" fileName="libro-diario" summary={`${rangoTexto(from, to)} (${totalItems} asientos). Se exportan todas las páginas filtradas.`} formats={['xlsx']} pending={exporting} onExport={({ fileName }) => handleExport(fileName)} />
    </section>
  )
}
