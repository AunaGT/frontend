import type {CredentialInput,ScopeCode,CustomerPolicy} from './types'
export const credentialStatuses={ACTIVE:'Activa',PAUSED:'Pausada',EXPIRED:'Vencida',REVOKED:'Revocada'}
export const emptyCredentialFilters={q:'',status:'ALL',scope:'ALL'} as const
export const sensitiveSearch=(value:string)=>/auna_live_|authorization|bearer/i.test(value)
export const scopeLabels:Record<ScopeCode,string>={'products.read':'Consultar productos y presentaciones','categories.read':'Consultar categorías','prices.read':'Consultar precios públicos','availability.read':'Consultar disponibilidad','quotes.read':'Consultar cotizaciones propias','quotes.create_draft':'Crear cotizaciones en borrador','quotes.update_draft':'Editar cotizaciones propias en borrador','quotes.cancel_draft':'Descartar cotizaciones propias en borrador','orders.read':'Consultar pedidos propios','orders.create_draft':'Crear pedidos en borrador','orders.update_draft':'Editar pedidos propios en borrador','orders.cancel_draft':'Descartar pedidos propios en borrador','customers.create':'Registrar clientes al crear borradores'}
export const scopeGroups=[{name:'Catálogo',scopes:['products.read','categories.read','prices.read','availability.read']},{name:'Cotizaciones',scopes:['quotes.read','quotes.create_draft','quotes.update_draft','quotes.cancel_draft']},{name:'Pedidos',scopes:['orders.read','orders.create_draft','orders.update_draft','orders.cancel_draft']}] as const
export const initialCredentialInput=(ownerId:string):CredentialInput=>({name:'',ownerId,scopes:[],branchIds:[],days:90,customerPolicy:'EXISTING_ONLY',customerPaymentTermId:null})
export const validityLabel=(days:number|null)=>days===null?'Sin vencimiento':`${days} días`
export const hasDraftScope=(scopes:ScopeCode[])=>scopes.some(s=>s==='quotes.create_draft'||s==='orders.create_draft')
export function mutationReadError(scopes:ScopeCode[]){
 for(const type of ['quotes','orders'] as const)if(scopes.some(s=>s===`${type}.update_draft`||s===`${type}.cancel_draft`)&&!scopes.includes(`${type}.read`))return `Para editar o descartar ${type==='quotes'?'cotizaciones':'pedidos'}, selecciona también «${scopeLabels[`${type}.read`]}».`
 return ''
}
export function withCustomerPolicy(input:CredentialInput,customerPolicy:CustomerPolicy):CredentialInput{return{...input,customerPolicy,customerPaymentTermId:customerPolicy==='EXISTING_ONLY'?null:input.customerPaymentTermId,scopes:customerPolicy==='EXISTING_ONLY'?input.scopes.filter(s=>s!=='customers.create'):[...new Set<ScopeCode>([...input.scopes,'customers.create'])]}}
export function withScopes(input:CredentialInput,scopes:ScopeCode[]):CredentialInput{const next={...input,scopes};return hasDraftScope(scopes)?next:withCustomerPolicy(next,'EXISTING_ONLY')}
export function validateCredentialInput(input:CredentialInput){
 if(!input.name.trim()||input.name.length>100)return 'Escribe un nombre de hasta 100 caracteres.'
 if(!input.ownerId)return 'Selecciona un responsable.'
 if(!input.scopes.length||input.scopes.some(s=>!Object.prototype.hasOwnProperty.call(scopeLabels,s)))return 'Selecciona al menos un permiso.'
 const readError=mutationReadError(input.scopes);if(readError)return readError
 if(!input.branchIds.length)return 'Selecciona al menos una sucursal.'
 if(input.days!==null&&(!Number.isInteger(input.days)||input.days<1||input.days>365))return 'Elige de 1 a 365 días o sin vencimiento.'
 if(input.customerPolicy==='CREATE_IF_MISSING'&&(!hasDraftScope(input.scopes)||!input.scopes.includes('customers.create')||!Number.isSafeInteger(input.customerPaymentTermId)||input.customerPaymentTermId!<1))return 'Para registrar clientes, autoriza el permiso y elige un término de pago válido.'
 if(input.customerPolicy==='EXISTING_ONLY'&&(input.customerPaymentTermId!==null||input.scopes.includes('customers.create')))return 'La política de clientes no coincide con los permisos.'
 return ''
}
