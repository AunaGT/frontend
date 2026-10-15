import type {CommercialPreparationInfo} from '../types'
export function CommercialPreparationNotice({state,reason}:{state?:CommercialPreparationInfo['commercialPreparation'];reason?:string}){
  if(!state||state==='NOT_APPLICABLE')return null
  return <div role="status" className="border-y py-3 text-sm text-muted-foreground">{state==='READY'?'Documento comercial preparado. Su confirmación, los pagos y la factura se gestionan por separado.':reason==='INTEGRATION_DISABLED'?'Preparación comercial pendiente: revisa la integración comercial de esta empresa. La reserva sigue agendada.':'Preparación comercial pendiente: revisa el cliente y la cantidad comercial para preparar el borrador. El horario no se modifica.'}</div>
}
