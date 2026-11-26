const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const group={schemaVersion:1,groupId:'g',name:'Experiencia Fiesta',variantName:'160 shots',currency:'GTQ',state:'COMPLETE',amount:'160.00',netAmount:'150.00',estimatedAmount:'160.00',issues:[],selection:{secret:'PRIVATE'},resourceIds:['PRIVATE'],components:[{key:'g:a',productId:'a',itemName:'Limón',itemKind:'STANDARD',quantity:'80',unitLabel:'unidad',quantityDecimals:0,unitPrice:'1',lineTotal:'80.00',netLineTotal:'75.00',unitCost:'PRIVATE'},{key:'g:b',productId:'b',itemName:'Mora',itemKind:'STANDARD',quantity:'80',unitLabel:'unidad',quantityDecimals:0,unitPrice:'1',lineTotal:'80.00',netLineTotal:'75.00'}]}
const full=[{package_component_key:'g:a',qty:'80',line_total:'80.00'},{package_component_key:'g:b',qty:'80',line_total:'80.00'}]
test('documents without package agreements render no summary when groups are null, missing or empty',()=>{
 const {CommercialPackageSummary}=loadReportModule('../../components/shared/CommercialPackageSummary.tsx')
 for(const mode of ['quote','order','sale','engagement','public'])for(const groups of [null,undefined,[]]){
  assert.equal(renderToStaticMarkup(React.createElement(CommercialPackageSummary,{groups,lines:full,mode})), '')
 }
})
test('quote lines remain visible when the document has null package groups',()=>{
 const {QuoteLines}=loadReportModule('../quotes/QuotePresentation.tsx',{'./api':{}})
 const html=renderToStaticMarkup(React.createElement(QuoteLines,{groups:null,lines:[{name:'Artículo independiente',qty:'1',unit_price:'12',line_total:'12'}],money:n=>'Q '+n}))
 assert.match(html,/Artículo independiente/);assert.match(html,/Q 12/);assert.doesNotMatch(html,/Paquetes acordados/)
})
test('document currency comes from the frozen agreement, with legacy company fallback',()=>{
 const {packageDocumentCurrency}=loadReportModule('../../components/shared/CommercialPackageSummary.tsx')
 assert.equal(packageDocumentCurrency([group],'USD'),'GTQ')
 assert.equal(packageDocumentCurrency([],'USD'),'USD')
})
test('commercial summary names the agreement and only displays actual invoiced components on partial sale',()=>{
 const {CommercialPackageSummary}=loadReportModule('../../components/shared/CommercialPackageSummary.tsx')
 const html=renderToStaticMarkup(React.createElement(CommercialPackageSummary,{groups:[group],lines:[{packageComponentKey:'g:a',qty:'20',lineTotal:'18.75'}],mode:'sale'}))
 assert.match(html,/Experiencia Fiesta/);assert.match(html,/160 shots/);assert.match(html,/Referencia del acuerdo/);assert.match(html,/Limón/);assert.match(html,/18[.,]75/);assert.doesNotMatch(html,/>Mora</);assert.doesNotMatch(html,/PRIVATE/)
 assert.equal(renderToStaticMarkup(React.createElement(CommercialPackageSummary,{groups:[],lines:[],mode:'quote'})),'')
})
test('public facts retain legacy shape without groups and allowlist package fields when present',()=>{
 const {quoteContext}=loadReportModule('../../components/customer-pages/documentAdapters.ts',{'@/services/api':{}})
 const dto={reference:'Q1',status:'ACCEPTED',company_name:'Empresa',is_final_consumer:true,total:'150.00',lines:full.map((l,i)=>({...l,product_name:i?'Mora':'Limón',unit_price:'1'}))}
 assert.equal(Object.hasOwn(quoteContext(dto),'packageGroups'),false)
 const facts=quoteContext({...dto,packageGroups:[group]})
 assert.equal(facts.packageGroups[0].variantName,'160 shots');assert.equal(facts.lines[0].packageComponentKey,'g:a');assert.doesNotMatch(JSON.stringify(facts),/PRIVATE|resourceIds|selection|unitCost/)
 const withConditions=structuredClone(group);withConditions.components[0].serviceConditions={version:1,schedulingStyle:'WORK',durationPolicy:'FIXED',durationMinutes:60,allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'Acceso público',resourceIds:['PRIVATE']}
 const publicFacts=quoteContext({...dto,packageGroups:[withConditions]});assert.equal(publicFacts.packageGroups[0].components[0].serviceConditions.publicInstructions,'Acceso público');assert.doesNotMatch(JSON.stringify(publicFacts),/PRIVATE|resourceIds/)
})
test('PDF groups annotate real rows without duplicating component charges or final total',()=>{
 const {jsPDF}=require('jspdf'),{spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');let buffer
 class Captured extends jsPDF{constructor(...args){super(...args);this.save=()=>{buffer=Buffer.from(this.output('arraybuffer'))}}}
 const {generateQuotePDF}=loadReportModule('../quotes/documents/generateQuotePDF.ts',{jspdf:Captured,'@/services/api':{},'./api':{}})
 generateQuotePDF({id:'q',reference:'QA-PACKAGE',created_at:'2026-10-26T12:00:00Z',total:'150.00',packageGroups:[group],lines:full.map((l,i)=>({...l,id:String(i),product_id:i?'b':'a',item_name:i?'Mora':'Limón',unit_label:'unidad',unit_price:'1'}))},{companyName:'Ejemplo',currencyCode:'USD'})
 const result=spawnSync('pdftotext',['-','-'],{input:buffer});assert.equal(result.status,0);const text=result.stdout.toString()
 assert.match(text,/Experiencia Fiesta/);assert.match(text,/160 shots/);assert.equal((text.match(/Limón/g)||[]).length,1);assert.equal((text.match(/Mora/g)||[]).length,1);assert.equal((text.match(/150\.00/g)||[]).length,1)
 assert.match(text,/Q\s*150\.00/);assert.doesNotMatch(text,/US\$|USD/)
 const output=path.resolve(__dirname,'../output/pdf/packages-qa');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'cotizacion.pdf'),buffer)
 const {generateOrderPDF}=loadReportModule('../orders/documents/generateOrderPDF.ts',{jspdf:Captured,'@/services/api':{},'./api':{}})
 generateOrderPDF({id:'p',reference:'QA-PACKAGE',created_at:'2026-10-26T12:00:00Z',total:'150.00',subtotal:'160.00',discount_total:'10.00',package_groups:[group],lines:full.map((l,i)=>({...l,id:String(i),product_id:i?'b':'a',item_name:i?'Mora':'Limón',unit_label:'unidad',unit_price:'1'}))},{companyName:'Ejemplo'})
 const orderText=spawnSync('pdftotext',['-','-'],{input:buffer}).stdout.toString();assert.match(orderText,/Experiencia Fiesta/);assert.equal((orderText.match(/Limón/g)||[]).length,1);assert.equal((orderText.match(/150\.00/g)||[]).length,1);fs.writeFileSync(path.join(output,'pedido.pdf'),buffer)
})
test('real quote lines group included components and keep independent free items',()=>{
 const {QuoteLines}=loadReportModule('../quotes/QuotePresentation.tsx',{'./api':{}})
 const lines=[...full.map((l,i)=>({...l,name:i?'Mora':'Limón',unit_price:'1'})),{name:'Artículo suelto',qty:'1',unit_price:'2',line_total:'2'}]
 const html=renderToStaticMarkup(React.createElement(QuoteLines,{groups:[group],lines,money:n=>'Q '+n}))
 assert.match(html,/Experiencia Fiesta/);assert.match(html,/Artículo suelto/);assert.equal((html.match(/Limón/g)||[]).length,1)
})
test('partial sale shows the actual invoiced unit instead of the original package presentation',()=>{
 const {CommercialPackageSummary}=loadReportModule('../../components/shared/CommercialPackageSummary.tsx')
 const boxed={...group,components:[{...group.components[0],quantity:'2',unitLabel:'caja'}]}
 const html=renderToStaticMarkup(React.createElement(CommercialPackageSummary,{groups:[boxed],lines:[{packageComponentKey:'g:a',qty:'20',unitLabel:'kg',lineTotal:'18.75'}],mode:'sale'}))
 assert.match(html,/20 kg/);assert.doesNotMatch(html,/20 caja/)
})
test('grouped quote retains the frozen public service conditions instead of silently hiding them',()=>{
 const {QuoteLines}=loadReportModule('../quotes/QuotePresentation.tsx',{'./api':{}})
 const conditions={version:1,schedulingStyle:'WORK',durationPolicy:'FIXED',durationMinutes:60,allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'Acceso lateral acordado'}
 const services={...group,components:[{...group.components[0],itemKind:'SERVICE',itemName:'Montaje',serviceConditions:conditions}]}
 const html=renderToStaticMarkup(React.createElement(QuoteLines,{groups:[services],lines:[{...full[0],name:'Montaje',item_kind:'SERVICE',unit_price:'1',service_schedule_snapshot:conditions}],money:n=>'Q '+n}))
 assert.match(html,/Acceso lateral acordado/);assert.match(html,/60 min/);assert.match(html,/Horario sujeto a disponibilidad/)
})
