import type {CommercialState,FiscalState,Sale} from '@/types/sale'
export const commercialLabel=(state:CommercialState):string=>({DRAFT:'Borrador',CONFIRMED:'Confirmada',CANCELLED:'Cancelada',LEGACY:'Revisar estado'})[state]
export const fiscalLabel=(state:FiscalState):string=>({DISABLED:'Facturación electrónica desactivada',UNRECORDED:'Factura por solicitar',PENDING_CONNECTOR:'Pendiente de certificación · conector no disponible',RECORDED_EXTERNAL:'Factura externa registrada · sin verificación automática',AUTHORIZED:'Factura certificada',REVIEW_REQUIRED:'Documento fiscal por revisar'})[state]
export function draftCoverageLabel({state,remaining,committed}:{state:CommercialState;remaining:string;committed:string}):string|null{
  return state==='DRAFT'&&/^0(?:\.0+)?$/.test(remaining)&&!/^0(?:\.0+)?$/.test(committed)?'Cubierto con anticipos':null
}
export const internalSaleDocumentTitle=(state:CommercialState):string=>({DRAFT:'Borrador de venta',CONFIRMED:'Comprobante interno de venta',CANCELLED:'Venta cancelada',LEGACY:'Comprobante interno · revisar estado'})[state]
export function saleCommercialState(sale:Pick<Sale,'status'|'commercial'>):CommercialState{
  return sale.commercial?.state??({draft:'DRAFT',completed:'CONFIRMED',cancelled:'CANCELLED'} as Partial<Record<Sale['status'],CommercialState>>)[sale.status]??'LEGACY'
}
export const salePaymentLabel=(sale:Sale):string=>saleCommercialState(sale)==='DRAFT'?'Por definir al confirmar':sale.isCredit?'A crédito':sale.payment||'Medio no registrado'
