/** API pública de Cartera para consumidores externos al módulo. */
export { receivablesModule } from './manifest'
export { checkCustomerCredit } from './api/receivablesService'
export { useOverdueReceivablesCount } from './hooks/useOverdueReceivablesCount'
export {fetchPaymentReceipt,type PaymentReceipt} from './api/receivablesService'
export async function savePaymentReceiptPDF(receipt:import('./api/receivablesService').PaymentReceipt,options:import('./pages/generateReceivablesPDF').PdfOptions,signal?:AbortSignal){
  const {generateReceiptPDF}=await import('./pages/generateReceivablesPDF')
  if(signal?.aborted)return
  generateReceiptPDF(receipt,options)
}
