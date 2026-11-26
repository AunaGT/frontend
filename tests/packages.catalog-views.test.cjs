const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const row={id:'p1',name:'Paquete de shots',version:3,activeVersion:1,archivedAt:null,branchIds:['b'],imageUrl:'https://example.com/shots.webp',currency:'GTQ',variantCount:2,priceFrom:'1200.00',priceTo:'1800.00'}
test('package cards open directly without redundant buttons while the table retains its actions',()=>{
 const nodes=[],viewed=[],edited=[]
 const {PackageResults}=loadReportModule('../inventory/packages/PackageCatalogViews.tsx',{'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})}},nodes)
 const render=(viewMode,canEdit=true)=>renderToStaticMarkup(React.createElement(PackageResults,{rows:[row],viewMode,canEdit,onView:id=>viewed.push(id),onEdit:id=>edited.push(id)}))
 const cards=render('cards');assert.match(cards,/auna-record-grid/);assert.match(cards,/auna-record-card/);assert.match(cards,/shots.webp/);assert.match(cards,/Desde/);assert.match(cards,/1[,.]200/)
 assert.doesNotMatch(cards,/<button\b|Vista previa de Paquete de shots|Editar Paquete de shots/)
 const card=nodes.find(n=>n.props?.className?.includes('auna-record-interactive'))
 card.props.onKeyDown({key:'Enter',target:1,currentTarget:1,preventDefault(){}});assert.deepEqual(viewed,['p1'])
 const table=render('table');assert.match(table,/<table/);assert.match(table,/auna-data-table/);assert.match(table,/Paquete de shots/)
 assert.match(table,/Vista previa de Paquete de shots/);assert.match(table,/Editar Paquete de shots/)
 assert.doesNotMatch(render('cards',false),/aria-label="Editar/)
 assert.doesNotMatch(render('table',false),/aria-label="Editar/)
})
test('package preview is a read page with saved options and named composition, without edit controls for readers',()=>{
 const {PackagePreview}=loadReportModule('../inventory/packages/PackageDetailPage.tsx',{'./api':{},'./usePackageScope':{},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/components/layout/PageNavigation':{usePageTrail(){}}})
 const definition={name:row.name,description:'Para tu celebración',currency:'GTQ',imageUrl:row.imageUrl,variants:[{id:'v',name:'80 shots',price:'1200',components:[{id:'c',productId:'s',quantity:'1',presentationId:null}],choices:[{id:'ch',name:'Sabores',totalQuantity:'80',maxDistinct:2,options:[{id:'o',productId:'f',presentationId:null}]}]}]}
 definition.variants[0].choices[0].options[0].presentationId='case'
 const html=renderToStaticMarkup(React.createElement(PackagePreview,{row:{...row,definition,activeDefinition:null,references:[{id:'s',name:'Atención del evento',unitLabel:'evento',presentations:[]},{id:'f',name:'Shot de mora',unitLabel:'unidad',presentations:[{id:'case',label:'caja de 6'}]}]},canEdit:false,onEdit(){}}))
 for(const label of ['80 shots','Atención del evento','Shot de mora','Sabores','Para tu celebración'])assert.ok(html.includes(label),label)
 assert.doesNotMatch(html,/role="dialog"|<input|Guardar|Editar paquete/)
 assert.match(html,/caja de 6/)
 const archived=renderToStaticMarkup(React.createElement(PackagePreview,{row:{...row,archivedAt:'2026-11-19',definition,activeDefinition:definition},canEdit:true,onEdit(){}}))
 assert.match(archived,/Última versión activa/);assert.match(archived,/no se ofrece en cotizaciones nuevas/);assert.doesNotMatch(archived,/Disponible al cotizar|Editar paquete/)
})
