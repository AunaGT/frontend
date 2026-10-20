const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {returnUnitLabel,returnQuantity,estimateLineRefund}=loadReportModule('../returns/returnQuantity.ts',{'@/services/api':{}})
const modern={version:2,baseUnit:{id:'unit',code:'UNIT',name:'Unidad',label:'ud',decimals:0},presentation:{id:'box',version:1,name:'Caja',label:'caja',decimals:0},factor:'7',roundingDelta:'0'}

test('historical return labels use their frozen v1 label without requiring a v2 baseUnit',()=>{
  const item={unit_snapshot:{version:1,factor:'1',unit_label:'botella histórica'},unit_label:'etiqueta actual'}
  assert.equal(returnUnitLabel(item),'botella histórica')
  assert.equal(returnUnitLabel(item,'BASE'),'botella histórica')
})
test('return labels retain v2 original and base identities plus legacy and incomplete display fallbacks',()=>{
  assert.equal(returnUnitLabel({unit_snapshot:modern}),'caja')
  assert.equal(returnUnitLabel({unit_snapshot:modern},'BASE'),'ud')
  assert.equal(returnUnitLabel({unit_snapshot:{...modern,presentation:null}}),'ud')
  assert.equal(returnUnitLabel({unit_label:'hora'}),'hora')
  assert.equal(returnUnitLabel({unit_snapshot:null,unit_label:'sesión'},'BASE'),'sesión')
  assert.equal(returnUnitLabel({unit_snapshot:{version:2},unit_label:'unidad histórica'}),'unidad histórica')
  assert.equal(returnUnitLabel({unit_snapshot:{version:1,factor:'1',unit_label:''},unit_label:'pieza'}),'pieza')
  assert.equal(returnUnitLabel({}),'unidades')
  assert.equal(returnUnitLabel({},'BASE'),'unidades')
})
test('reading a v1 label does not reinterpret its decimal service quantity or refund',()=>{
  const item={id:1,qty:'1.5',item_kind:'SERVICE',quantity_decimals:2,unit_label:'hora',unit_metadata_version:1,unit_snapshot:{version:1,factor:'1',unit_label:'hora'},available_to_return:'1',net_total:150,refundable_amount:100}
  assert.equal(returnUnitLabel(item),'hora')
  assert.equal(returnQuantity('0.5',item,'es-GT'),'0.5')
  assert.equal(estimateLineRefund('0.5',item),50)
})
test('actual return detail and review dialogs render v1 sale snapshots without crashing',()=>{
  const record={id:'return-1',sale_id:'sale-1',return_date:'2026-10-01T12:00:00Z',status:{name:'Pendiente'},type:'REFUND',total_refund:12,return_items:[{id:1,product_id:'p',qty_returned:1,refund_amount:12,unit_metadata_version:1,product:{id:'p',name:'Producto histórico',barcode:'001'},sale_item:{id:1,item_kind:'STANDARD',item_name:'Producto histórico',qty:2,price:12,unit_label:'botella actual',unit_metadata_version:1,unit_snapshot:{version:1,factor:'1',unit_label:'botella histórica'}}}],replacement_items:[],settlements:[]}
  const mutation={isPending:false},Page=loadReportModule('../returns/pages/ReturnDetailPage.tsx',{
    '@/services/api':{},'react-router-dom':{...require('react-router-dom'),useParams:()=>({id:record.id}),useNavigate:()=>()=>{}},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[]})},
    '../hooks/useReturns':{useReturnById:()=>({data:record}),useUpdateReturnStatus:()=>mutation,useApproveReturn:()=>mutation,useCompleteReturn:()=>mutation},
    '@tanstack/react-query':{useQuery:()=>({data:[]})},'@/services/warehouseService':{},'@/services/cashSessionsService':{},
  }).default
  const html=renderToStaticMarkup(React.createElement(Page))
  assert.match(html,/Producto histórico/)
  assert.match(html,/<td[^>]*>1 botella histórica<\/td>/)
  assert.match(html,/Revisar y aprobar/)
})
