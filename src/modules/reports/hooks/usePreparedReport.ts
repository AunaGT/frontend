import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPreparedReport } from '../api/reportService'
import { reportFiltersKey } from '../reportCatalog'
import type { PreparedReport, ReportFilters, ReportId } from '../reportModel'
export function usePreparedReport(companyId: string, id: ReportId, filters: ReportFilters) {
  const key = reportFiltersKey(companyId, id, filters)
  const current = useRef(key)
  current.current = key
  const request = useRef<{ key: string; controller: AbortController } | null>(null)
  const [state, setState] = useState<{ key: string; report: PreparedReport | null; pending: boolean; error: Error | null }>({ key, report: null, pending: false, error: null })
  const clear = useCallback(() => { request.current?.controller.abort(); request.current = null; setState({ key: current.current, report: null, pending: false, error: null }) }, [])
  useEffect(() => { clear(); return () => { request.current?.controller.abort(); request.current = null } }, [key, clear])
  const prepare = useCallback(async () => {
    if (request.current?.key === key) return
    request.current?.controller.abort()
    const active = { key, controller: new AbortController() }
    request.current = active
    setState({ key, report: null, pending: true, error: null })
    try {
      const report = await fetchPreparedReport(id, companyId, filters, active.controller.signal)
      if (request.current === active && current.current === key) setState({ key, report, pending: false, error: null })
    } catch (error) {
      if (request.current === active && current.current === key && !active.controller.signal.aborted) setState({ key, report: null, pending: false, error: error instanceof Error ? error : new Error('No se pudo preparar el reporte.') })
    } finally { if (request.current === active) request.current = null }
  }, [key, companyId, id, filters])
  return { report: state.key === key ? state.report : null, pending: state.key === key && state.pending, error: state.key === key ? state.error : null, dirty: state.key !== key, prepare, clear }
}
