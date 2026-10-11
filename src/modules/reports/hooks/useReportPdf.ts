import { useCallback, useEffect, useRef } from 'react'
import type { PreparedReport } from '../reportModel'
export function useReportPdf(report: PreparedReport | null) {
  const current = useRef(report), alive = useRef(true)
  current.current = report
  const cache = useRef<{ report: PreparedReport; promise: Promise<Blob> } | null>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false; cache.current = null } }, [])
  return useCallback(async () => {
    if (!report || !alive.current || current.current !== report) throw new Error('El alcance del reporte cambió. Prepara los datos nuevamente.')
    if (cache.current?.report !== report) {
      const pending = { report, promise: import('../documents/reportPdf').then(module => module.generateReportPdf(report)) }
      cache.current = pending
      pending.promise.catch(() => { if (cache.current === pending) cache.current = null })
    }
    const blob = await cache.current.promise
    if (!alive.current || current.current !== report) throw new Error('El alcance del reporte cambió. No se descargó la versión anterior.')
    return blob
  }, [report])
}
