const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),router=require('react-router-dom')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('retired external entry and correction bookmarks lead to the sale without any fiscal form or write',()=>{
  for(const documentId of [undefined,'old-document']){
    const nodes=[]
    const Page=loadReportModule('../sales/ExternalInvoicePage.tsx',{'react-router-dom':{...router,useParams:()=>({id:'sale-1',documentId})}},nodes).default
    const html=renderToStaticMarkup(React.createElement(router.MemoryRouter,null,React.createElement(Page)))
    const redirect=nodes.find(n=>n.type===router.Navigate)
    assert.equal(redirect.props.to,'/ventas/sale-1/factura');assert.equal(redirect.props.replace,true)
    assert.doesNotMatch(html,/<form|<input|Autorización|Serie/)
  }
})
