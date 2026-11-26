const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('analytics query stays disabled when financial access is absent',()=>{
 let options
 const {useAnalytics}=loadReportModule('../analytics/hooks/useAnalytics.ts',{
  '@tanstack/react-query':{useQuery:input=>{options=input;return{}}},'../api/analyticsService':{},
 })
 useAnalytics(2026,false);assert.equal(options.enabled,false)
 useAnalytics(2026,true);assert.equal(options.enabled,true)
})
