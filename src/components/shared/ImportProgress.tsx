import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export type ImportProgressEvent = {
  type: 'phase' | 'progress' | 'complete' | 'error'
  phase: 'validating' | 'saving' | 'complete' | 'error'
  processed: number
  total: number
  created?: number
  skipped?: number
}

export function ImportProgress({ progress, onCancel }: { progress: ImportProgressEvent; onCancel: () => void }) {
  const saving = progress.phase === 'saving'
  const percent = saving && progress.total > 0 ? Math.min(99, Math.floor(progress.processed / progress.total * 100)) : 0
  return <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 font-semibold text-foreground"><Loader2 className="h-4 w-4 animate-spin text-liquor-amber" aria-hidden="true" />{saving ? 'Guardando registros' : 'Validando archivo en el servidor'}</p>
        <p className="mt-1 text-sm text-muted-foreground" role="status" aria-live="polite">{saving ? `${progress.processed} de ${progress.total} filas procesadas` : 'Revisando los datos antes de guardar…'}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar importación</Button>
    </div>
    {saving && <Progress className="mt-4 h-2" value={percent} aria-label="Progreso de importación" />}
    {saving && progress.created !== undefined && <p className="mt-2 text-xs text-muted-foreground">{progress.created} creados · {progress.skipped || 0} omitidos</p>}
  </div>
}
