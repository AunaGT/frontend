const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('opaque-origin messages require exact source, channel and visual-only bounded payload',()=>{
 const {parseSandboxMessage,createMessageLimiter}=loadReportModule('../../components/customer-pages/sandboxMessages.ts'),source={},options={source,channelId:'channel-123',now:1000,limiter:createMessageLimiter()}
 const event={origin:'null',source,data:{kind:'resize',channelId:'channel-123',height:120}}
 assert.deepEqual(parseSandboxMessage(event,options),{kind:'resize',height:120})
 for(const edit of [{source:{}},{data:{...event.data,channelId:'other'}},{data:{...event.data,height:801}},{data:{...event.data,height:79}},{data:{...event.data,document:{token:'x'}}},{data:{...event.data,kind:'fetch',url:'/api/private'}}])assert.equal(parseSandboxMessage({...event,...edit},options),null)
 for(let i=0;i<9;i++)assert.ok(parseSandboxMessage(event,options));assert.equal(parseSandboxMessage(event,options),null)
})
