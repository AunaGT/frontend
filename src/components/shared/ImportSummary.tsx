import { Link } from 'react-router-dom'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ImportSummaryResult = {
  created: number
  skipped?: number
  adopted?: number
  errors?: { rowIndex: number; error: string }[]
}

export function ImportSummary({ result, back, backLabel }: { result: ImportSummaryResult; back: string; backLabel: string }) {
  const errors = result.errors ?? []
  return <div className="w-full space-y-4" role="status">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400"><CheckCircle2 aria-hidden="true" className="h-5 w-5" /></span>
      <div><h3 className="text-lg font-semibold">Importación finalizada</h3><p className="text-sm text-muted-foreground">Revisa el resultado antes de volver al listado.</p></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-background p-4"><strong className="block text-2xl text-foreground">{result.created}</strong><span className="text-sm text-muted-foreground">creados</span></div>
      <div className="rounded-xl border border-border bg-background p-4"><strong className="block text-2xl text-foreground">{result.skipped ?? 0}</strong><span className="text-sm text-muted-foreground">omitidos</span></div>
      <div className="rounded-xl border border-border bg-background p-4"><strong className="block text-2xl text-foreground">{errors.length}</strong><span className="text-sm text-muted-foreground">con error</span></div>
    </div>
    {result.adopted ? <p className="text-sm text-muted-foreground">{result.adopted} {result.adopted === 1 ? 'incorporado' : 'incorporados'} a la sucursal activa.</p> : null}
    {errors.length > 0 && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4"><h4 className="flex items-center gap-2 font-medium"><CircleAlert aria-hidden="true" className="h-4 w-4" />Filas con error</h4><ul className="mt-2 max-h-44 space-y-1 overflow-auto text-sm">{errors.map(({ rowIndex, error }, index) => <li key={`${rowIndex}-${index}`}>Fila {rowIndex}: {error}</li>)}</ul></div>}
    <Button asChild className="bg-liquor-amber text-white hover:bg-liquor-amber/90"><Link to={back}>Cerrar y volver a {backLabel}</Link></Button>
  </div>
}
