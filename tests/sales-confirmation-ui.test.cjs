const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const router=require('react-router-dom'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('sale confirmation is a full page reusing the engagement form and same-sale result',()=>{
  const nodes=[],navigations=[],ctx={ready:true,writable:true,scope:{companyId:'a',branchId:'b'},hasPermission:()=>true}
  const sale={id:'sale-1',reference:'V-001',status:'draft',commercial:{state:'DRAFT',originEngagementId:'e',version:1,confirmedAt:null,fiscalState:'UNRECORDED'},capabilities:{confirm:true}}
  const e={id:'e',customer:{id:'c',name:'Cliente QA'},version:1,saleId:null,orderId:null,lines:[{itemKind:'SERVICE'}],money:{total:'100.00',committed:'40.00',remaining:'60.00',currencyCode:'GTQ'},capabilities:{issueSale:true}}
  const Page=loadReportModule('../sales/SaleConfirmationPage.tsx',{
    'react-router-dom':{...router,useParams:()=>({id:'sale-1'}),useNavigate:()=>url=>navigations.push(url)},
    '../appointments/useAgendaContext':{useAgendaContext:()=>ctx},'../useAgendaContext':{useAgendaContext:()=>ctx},
    '@/services/api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
    './api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
    '@tanstack/react-query':{useQuery:options=>({data:options.queryKey.includes('confirmation-origin')?e:sale,refetch:async()=>({data:e})})},
    '../engagementDraft':{useEngagementCommand:()=>({pending:false,error:null,fields:{},reviewVersion(){},send:async()=>({...e,saleId:'sale-1'})})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
  },nodes).default
  const html=renderToStaticMarkup(React.createElement(router.MemoryRouter,null,React.createElement(Page)))
  assert.match(html,/Confirmar venta/);assert.match(html,/Condición de pago/)
  assert.doesNotMatch(html,/role="dialog"[^>]*>.*Condición de pago/)
  const form=nodes.find(n=>n.type.name==='EngagementSaleForm')
  assert.ok(form);form.props.onSaved({...e,saleId:'sale-1'})
  assert.deepEqual(navigations,['/ventas/sale-1/factura'])
})
