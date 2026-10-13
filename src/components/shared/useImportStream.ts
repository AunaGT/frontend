import { useEffect, useRef, useState } from 'react'
import { getAuthToken } from '@/services/api'
import { consumeImportStream } from './importStream.mjs'
import type { ImportProgressEvent } from './ImportProgress'

export function useImportStream() {
  const request = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<ImportProgressEvent | null>(null)

  useEffect(() => () => { request.current?.abort() }, [])

  const cancel = () => {
    request.current?.abort()
    request.current = null
    setProgress(null)
  }

  const start = async <T,>(url: string, body: unknown): Promise<T> => {
    if (request.current) throw new Error('Ya hay una importación en curso.')
    const controller = new AbortController()
    request.current = controller
    setProgress({ type: 'phase', phase: 'validating', processed: 0, total: 0 })
    try {
      return await consumeImportStream(url, {
        body,
        token: getAuthToken(),
        signal: controller.signal,
        onEvent: (event: ImportProgressEvent) => {
          if (!controller.signal.aborted && event.type !== 'complete' && event.type !== 'error') setProgress(event)
        },
      }) as T
    } finally {
      if (request.current === controller) {
        request.current = null
        setProgress(null)
      }
    }
  }

  return { progress, start, cancel }
}
