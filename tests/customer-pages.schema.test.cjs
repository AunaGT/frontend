const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('responsive styles inherit, override and reset without introducing arbitrary CSS',()=>{
 const {compileStyles}=loadReportModule('../../components/customer-pages/styleModel.ts')
 const s={desktop:{padding:24,color:'#112233'},tablet:{padding:16},mobile:{padding:8,position:'fixed'}}
 assert.equal(compileStyles(s,{},'desktop').padding,24)
 assert.equal(compileStyles(s,{},'mobile').padding,8)
 assert.equal(compileStyles(s,{},'mobile').color,'#112233')
 assert.equal(compileStyles(s,{},'mobile').position,undefined)
 delete s.mobile.padding;assert.equal(compileStyles(s,{},'mobile').padding,16)
})
