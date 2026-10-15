const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('sales data hook sends numeric selection as ID, not duplicate historical name',()=>{
  let state=0;const requests=[]
  const {useSalesData}=loadReportModule('../sales/hooks/useSalesData.ts',{
    react:{...React,useState:initial=>[++state===4?'12':initial,()=>{}],useEffect(){},useMemo:fn=>fn()},
    '@/hooks/useSales':{useSales:p=>{requests.push(p);return{data:{items:[]},refetch(){}}}},
    '@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10,viewMode:'table',setPage(){}})},
    '@/hooks/useCardPagination':{useCardPagination:()=>({pageSize:10})},'@/hooks/use-mobile':{useIsMobile:()=>false},
  })
  useSalesData();assert.equal(requests[0].payment_method_id,12);assert.equal(requests[0].payment,undefined)
})
test('confirmed mixed receipt sale never reports a fictitious or missing method',()=>{
  const {salePaymentLabel}=loadReportModule('../sales/commercialPresentation.ts')
  assert.equal(salePaymentLabel({status:'completed',payment:null,settlementSource:'ENGAGEMENT_RECEIPTS'}),'Recibos vinculados / varios medios')
  assert.equal(salePaymentLabel({status:'completed',payment:null}),'Medio no registrado')
})
test('history selector distinguishes duplicate labels with stable method IDs',()=>{
  const nodes=[],Filters=loadReportModule('../sales/components/SalesFilters.tsx',{},nodes).SalesFilters
  renderToStaticMarkup(React.createElement(Filters,{searchTerm:'',onSearchChange(){},statusFilter:'all',onStatusChange(){},paymentFilter:'12',onPaymentChange(){},paymentMethods:[{id:11,name:'Tarjeta'},{id:12,name:'Tarjeta'}]}))
  const option=nodes.find(n=>n.props.value==='12'&&typeof n.props.children==='string')
  assert.ok(option);assert.match(String(option.props.children),/12/)
})
test('sales transport uses ID without reinterpreting old name parameter',async()=>{
  let url
  const {fetchSales}=loadReportModule('../../services/salesService.ts',{'./api':{apiFetch:async u=>{url=u;return{items:[]}}}})
  await fetchSales({payment_method_id:12});let params=new URL(url,'https://test.invalid').searchParams
  assert.equal(params.get('payment_method_id'),'12');assert.equal(params.has('payment'),false)
  await fetchSales({payment:'Efectivo'});params=new URL(url,'https://test.invalid').searchParams
  assert.equal(params.get('payment'),'Efectivo')
})
