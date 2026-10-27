import { useEffect, useRef } from 'react'
export function FormFeedback({ error, fields = {} }: { error: string | null; fields?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  const visible=Object.entries(fields).filter(([key])=>!['acknowledgedPaymentReviewHash','paymentReferenceReview','paymentPolicyCanOverride','paymentPolicyReviewHash','paymentPolicyReasons'].includes(key))
  return error ? <div role="alert" ref={ref} tabIndex={-1} className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><p>{error}</p>{visible.length > 0 && <ul className="mt-2 list-disc pl-5">{visible.map(([key, message]) => <li key={key}><a className="underline" href={`#agenda-${key}`}>{message}</a></li>)}</ul>}</div> : null
}
