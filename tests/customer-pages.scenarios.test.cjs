const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('preview scenarios cover terminal, unavailable, partial and extreme documents using only fictitious data',()=>{
 const {getPreviewScenario,scenarioNames}=loadReportModule('../config/customerPages/previewScenarios.ts')
 for(const type of ['QUOTE','ORDER'])for(const name of scenarioNames[type]){const ctx=getPreviewScenario(type,name);assert.equal(ctx.documentType,type);assert.match(ctx.companyName,/ejemplo/i);assert.equal(ctx.token,undefined);assert.equal(ctx.lines[0]?.qty,'0.125')}
 assert.equal(getPreviewScenario('QUOTE','ACCEPTED').canRespond,false);assert.equal(getPreviewScenario('ORDER','EXTREME').lines.length,120)
})
test('public image URLs pin the published version as well as the document token',()=>{
 const {publicPortalAssetUrl}=loadReportModule('../../components/customer-pages/documentAdapters.ts');
 assert.equal(publicPortalAssetUrl('QUOTE','token/secret','cover','published-v1'),'/api/public/customer-pages/QUOTE/token%2Fsecret/versions/published-v1/assets/cover');
})
