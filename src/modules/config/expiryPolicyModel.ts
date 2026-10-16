import type {ExpiryAlertPolicy} from '@/services/settingsService'
export type ExpiryPolicyFieldPath=`inventory.expiry_alert_policy.${keyof ExpiryAlertPolicy}`
export const DEFAULT_EXPIRY_ALERT_POLICY:ExpiryAlertPolicy={warningDays:30,highPriorityDays:7}
export const expiryDraft=(value:unknown):Partial<Record<keyof ExpiryAlertPolicy,unknown>>=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const integer=(value:unknown)=>['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isSafeInteger(Number(value))
export function validateExpiryPolicyDraft(value:unknown):Partial<Record<ExpiryPolicyFieldPath,string>>{
  const policy=expiryDraft(value),errors:Partial<Record<ExpiryPolicyFieldPath,string>>={}
  if(!integer(policy.warningDays)||Number(policy.warningDays)<1||Number(policy.warningDays)>3650)errors['inventory.expiry_alert_policy.warningDays']='Indica un número entero de 1 a 3650 días.'
  if(!integer(policy.highPriorityDays)||Number(policy.highPriorityDays)<0||Number(policy.highPriorityDays)>Number(policy.warningDays))errors['inventory.expiry_alert_policy.highPriorityDays']='Indica días enteros entre 0 y la ventana de aviso.'
  return errors
}
export function expiryPolicyPayload(value:unknown):unknown{
  if(Object.keys(validateExpiryPolicyDraft(value)).length)return value
  const policy=expiryDraft(value);return{warningDays:Number(policy.warningDays),highPriorityDays:Number(policy.highPriorityDays)}
}
