const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('cursor pagination does not invent a total and respects end of results',()=>{
 const nodes=[],{Pagination}=loadReportModule('../../components/shared/Pagination.tsx',{},nodes),pages=[]
 const html=renderToStaticMarkup(React.createElement(Pagination,{currentPage:2,onPageChange:p=>pages.push(p),hasPrevPage:true,hasNextPage:false,itemLabel:'paquetes'}))
 assert.match(html,/Página 2</);assert.doesNotMatch(html,/de undefined|de NaN/)
 nodes.find(n=>n.props['aria-label']==='Página anterior').props.onClick()
 assert.deepEqual(pages,[1]);assert.equal(nodes.find(n=>n.props['aria-label']==='Página siguiente').props.disabled,true)
})
test('numbered pagination still exposes actual totals and current page',()=>{
 const {Pagination}=loadReportModule('../../components/shared/Pagination.tsx')
 const html=renderToStaticMarkup(React.createElement(Pagination,{currentPage:2,totalPages:4,totalItems:40,pageSize:10,count:10,onPageChange(){}}))
 assert.match(html,/Mostrando 11 a 20 de 40/);assert.match(html,/aria-current="page"/)
})
