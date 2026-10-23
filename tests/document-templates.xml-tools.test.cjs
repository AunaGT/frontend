const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const schema={xml:{rootAttributes:['version','format','formato'],blockAttributes:['id','kind','tipo','when','condicion'],columnAttributes:['key','label','width','align','when','condicion']},blocks:{HEADER:{settings:{title:'text',images:'images'}},DETAILS:{settings:{columns:'columns',columnStyles:'columnStyles'}}},theme:{fontFamily:['Helvetica']},columns:['description','quantity','price','total'],conditions:['ALWAYS','HAS_DISCOUNT']}
test('XML completion describes nested options, columns and safe image slots instead of only empty blocks',()=>{
  const {templateXmlElements}=loadReportModule('../config/documentTemplates/xmlLanguage.ts')
  const elements=templateXmlElements(schema),block=elements.find(e=>e.name==='bloque'),column=elements.find(e=>e.name==='column')
  assert.ok(block.children.includes('opciones'));assert.ok(block.children.includes('columns'))
  assert.ok(!block.attributes.some(a=>(a.name||a)==='columnStyles'))
  assert.ok(column.attributes.some(a=>(a.name||a)==='width'));assert.ok(elements.find(e=>e.name==='image').attributes.some(a=>a.name==='slot'&&a.values.includes('imagen-1')))
})
test('server XML diagnostics map to the actual source range and tolerate missing line/column metadata',()=>{
  const {xmlDiagnosticRanges}=loadReportModule('../config/documentTemplates/xmlLanguage.ts')
  const source='<a>\n  <column width="0"/>\n</a>',ranges=xmlDiagnosticRanges(source,[{line:2,column:11,message:'Ancho inválido'},{line:999,column:999,message:'Otro'}])
  assert.equal(source.slice(ranges[0].from,ranges[0].to),'w');assert.equal(ranges[0].severity,'error')
  assert.ok(ranges[1].from<=source.length);assert.ok(ranges[1].to<=source.length)
})
