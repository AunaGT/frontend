import { useEffect, useRef, useState } from 'react'
import { createCustomerPayment, type CreatePaymentPayload, type CreatedPayment } from '../api/receivablesService'

type Context = { companyId?: string; branchId?: string; userId?: string; customerId?: string }
export function useCustomerPaymentAttempt(context: Context) {
  const key = 'auna:customer-payment-pending:' + JSON.stringify([context.companyId, context.branchId, context.userId, context.customerId])
  const current = useRef(key), attempt = useRef<CreatePaymentPayload | null>(null), flight = useRef<Promise<CreatedPayment> | null>(null), recoveryBlocked = useRef(false)
  current.current = key
  const [pendingPayload, setPending] = useState<CreatePaymentPayload | null>(null), [error, setError] = useState('')
  useEffect(() => {
    current.current = key; recoveryBlocked.current = false
    attempt.current = null; flight.current = null; setPending(null); setError('')
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) {
        const value = JSON.parse(saved) as CreatePaymentPayload
        if (!value.request_key || value.customer_id !== context.customerId) throw Error()
        attempt.current = value; setPending(value)
        setError('Hay un cobro pendiente de confirmar. Recupera el mismo intento antes de registrar otro.')
      }
    } catch { recoveryBlocked.current = true; setError('No se pudo recuperar el intento. Revisa el historial de cobros del cliente antes de continuar.') }
    return () => { if (current.current === key) current.current = 'unmounted' }
  }, [key])
  const send = (payload: CreatePaymentPayload): Promise<CreatedPayment> => {
    if (recoveryBlocked.current) return Promise.reject(Error('Revisa el historial de cobros: no se pudo recuperar el intento anterior.'))
    if (current.current !== key || !context.companyId || !context.branchId || context.branchId === 'all' || !context.userId || payload.customer_id !== context.customerId) return Promise.reject(Error('Selecciona el alcance correcto antes de cobrar.'))
    if (flight.current) return flight.current
    const recovering = attempt.current !== null
    const request = attempt.current || { ...payload, request_key: crypto.randomUUID() }
    try { sessionStorage.setItem(key, JSON.stringify(request)) }
    catch { return Promise.reject(Error('No se pudo guardar el intento seguro en este navegador. No se envió el cobro.')) }
    attempt.current = request
    const promise = (async () => {
      try {
        const result = await createCustomerPayment(request)
        if (!result || typeof result.id !== 'string' || !result.id) throw Error('No se recibió un comprobante válido. Recupera el mismo intento antes de registrar otro cobro.')
        sessionStorage.removeItem(key)
        if (current.current !== key) throw Error('El alcance cambió. El cobro se registró en el cliente original; consulta su historial.')
        attempt.current = null; setPending(null); setError('')
        return result
      } catch (cause) {
        if (current.current === key) {
          const status = (cause as { status?: number; code?: string }).status
          const ambiguous = recovering || !status || status < 400 || status >= 500 || (cause as { code?: string }).code === 'PAYMENT_ATTEMPT_CONFLICT'
          if (ambiguous) setPending(request)
          else { sessionStorage.removeItem(key); attempt.current = null; setPending(null) }
          setError(ambiguous ? 'No se pudo confirmar el resultado. Usa «Recuperar cobro»; se enviará el mismo intento, sin duplicarlo.' : (cause as Error).message)
        }
        throw cause
      } finally { if (current.current === key) flight.current = null }
    })()
    flight.current = promise
    return promise
  }
  return { send, pendingPayload, error, recoveryBlocked: recoveryBlocked.current }
}
