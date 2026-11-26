const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('sale document actions follow server capabilities and do not query hardware without document authority',async()=>{
  for(const viewDocument of [false,true]){
    const h=hookHarness(),nodes=[],destinations=[]
    const {SaleInvoicePage}=loadReportModule('../sales/SaleInvoicePage.tsx',{
      react:h.hooks,'react-router-dom':{useParams:()=>({id:'S'}),useNavigate:()=>()=>{}},
      '@/components/layout/PageNavigation':{usePageTrail(){}},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/context/useAuth':{useAuth:()=>({user:{id:'U'}})},
      '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/services/api':{getAuthToken:()=>null},'./api':{getAuthToken:()=>null},
      '@/services/authSession':{authSessionIdentity:()=> 'session'},
      '@/services/saleService':{fetchSaleById:async()=>({id:'S',reference:'V-1',status:{name:'Completada'},sale_items:[],total:'10',capabilities:{viewDocument}})},
      '@/modules/config/hardware/public':{usePrintDestination:scope=>{destinations.push(scope);return{}},PrintDestination:()=>null},
      './documents/useSaleDocument':{useSaleDocument:()=>({pending:false})},
      './documents/saleTicketRecovery':{downloadSavedSaleTicket:async()=>{}},
      '@/components/shared/pdf/PdfDocumentPreview':{PdfDocumentPreview:()=>null},
    },nodes)
    try{
      const render=()=>{nodes.length=0;h.render(()=>SaleInvoicePage())}
      render();await new Promise(resolve=>setImmediate(resolve));render()
      assert.equal(nodes.some(n=>n.props.onClick&&n.props.children?.includes?.('Descargar ticket (80 mm)')),viewDocument)
      assert.equal(destinations.at(-1).branchId,viewDocument?'B':'')
    }finally{h.unmount()}
  }
})
