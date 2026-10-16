import { RETURN_RESOLUTION_LABELS, type ReturnPolicy, type ReturnResolution } from '@/modules/returns/policy'

export type ReturnPolicyFieldPath = `returns.policy.${keyof ReturnPolicy}`
export type ReturnPolicyDraft = Partial<Record<keyof ReturnPolicy, unknown>>
const resolutions = Object.keys(RETURN_RESOLUTION_LABELS) as ReturnResolution[]
export const policyDraft = (value: unknown): ReturnPolicyDraft => value && typeof value === 'object' && !Array.isArray(value) ? value as ReturnPolicyDraft : {}
const validDays = (value: unknown) => ['string', 'number'].includes(typeof value) && Number.isSafeInteger(Number(value)) && Number(value) >= 1
export function validateReturnPolicyDraft(value: unknown): Partial<Record<ReturnPolicyFieldPath, string>> {
  const policy = policyDraft(value), errors: Partial<Record<ReturnPolicyFieldPath, string>> = {}
  if (!validDays(policy.windowDays)) errors['returns.policy.windowDays'] = 'Ingresa un plazo entero de al menos 1 día.'
  if (typeof policy.allowAuthorizedExceptions !== 'boolean') errors['returns.policy.allowAuthorizedExceptions'] = 'Selecciona si permites excepciones autorizadas.'
  if (typeof policy.exchangePricing !== 'string' || !['CURRENT_PRICE', 'ORIGINAL_SALE_PRICE'].includes(policy.exchangePricing)) errors['returns.policy.exchangePricing'] = 'Selecciona qué precio se utilizará para los cambios.'
  if (!Array.isArray(policy.enabledResolutions) || !policy.enabledResolutions.length || policy.enabledResolutions.some(value => !resolutions.includes(value))) errors['returns.policy.enabledResolutions'] = 'Selecciona al menos una resolución válida.'
  return errors
}
/** Canoniza equivalencias; no elimina valores inválidos para ocultar errores. */
export function returnPolicyPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const policy = policyDraft(value)
  return { windowDays: validDays(policy.windowDays) ? Number(policy.windowDays) : policy.windowDays,
    allowAuthorizedExceptions: policy.allowAuthorizedExceptions, exchangePricing: policy.exchangePricing,
    enabledResolutions: Array.isArray(policy.enabledResolutions) && policy.enabledResolutions.every(value => resolutions.includes(value))
      ? resolutions.filter(value => (policy.enabledResolutions as unknown[]).includes(value)) : policy.enabledResolutions }
}
