import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { resolveImportRows } from './importRowFeedback.mjs'

export type ImportDecisions = { skipRowIndexes: number[]; allowSimilarRowIndexes: number[] }
export type ImportRowIssue = { rowIndex: number; errors: string[]; canCreateAnyway?: boolean }
const empty = (): ImportDecisions => ({ skipRowIndexes: [], allowSimilarRowIndexes: [] })

export function useImportDecisions(source: unknown, sheet: string, mapping: unknown, header = true) {
  const [options, setOptions] = useState<ImportDecisions>(empty)
  useEffect(() => { setOptions(empty()) }, [source, sheet, mapping, header])
  return {
    options,
    resolve(rowIndex: number | number[], action: 'skip' | 'restore' | 'allow', validate: (options: ImportDecisions) => unknown) {
      const next = resolveImportRows(options, rowIndex, action)
      setOptions(next)
      void validate(next)
    },
  }
}

export function ImportRowActions({ rowIndex, displayRowIndex = rowIndex, issue, skipped, disabled, onResolve }: {
  rowIndex: number; displayRowIndex?: number; issue?: ImportRowIssue; skipped: boolean; disabled: boolean
  onResolve: (rowIndex: number, action: 'skip' | 'restore' | 'allow') => void
}) {
  return <div className="flex flex-wrap gap-2 mt-2 text-foreground">
    <Button type="button" size="sm" variant="outline" disabled={disabled} aria-label={`${skipped ? 'Restaurar' : 'Omitir'} fila ${displayRowIndex}`} onClick={() => onResolve(rowIndex, skipped ? 'restore' : 'skip')}>{skipped ? 'Restaurar fila' : 'Omitir fila'}</Button>
    {!skipped && issue?.canCreateAnyway && <Button type="button" size="sm" variant="outline" disabled={disabled} aria-label={`Crear igualmente fila ${displayRowIndex}`} onClick={() => onResolve(rowIndex, 'allow')}>Crear igualmente</Button>}
  </div>
}
