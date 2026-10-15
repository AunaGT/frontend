import { useEffect, useRef } from 'react'
export function FormFeedback({ error, fields = {} }: { error: string | null; fields?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  return error ? <div role="alert" ref={ref} tabIndex={-1} className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><p>{error}</p>{Object.entries(fields).length > 0 && <ul className="mt-2 list-disc pl-5">{Object.entries(fields).map(([key, message]) => <li key={key}><a className="underline" href={`#agenda-${key}`}>{message}</a></li>)}</ul>}</div> : null
}
