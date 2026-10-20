const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{deferred,flush}=require('./helpers/configHarness.cjs')
test('hook locks concurrent tabs with shared storage, captures scope headers and ignores a revoked owner',async()=>{
 const h=hookHarness(),gate=deferred(),map=new Map([['auth:user',JSON.stringify({id:'U'})]]),oldStorage=global.localStorage,oldSession=global.sessionStorage,oldWindow=global.window
 global.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};global.sessionStorage=global.localStorage;global.window={addEventListener(){},removeEventListener(){}}
 let allowed=true,confirmed=0,headers
 const {useCheckoutFlow}=loadReportModule('../sales/checkout/useCheckoutFlow.ts',{react:h.hooks,'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',getAuthToken:()=> 'session'},'@/services/saleService':{createSale:async(payload,options)=>{headers=options.headers;return gate.promise},fetchCheckoutAttempt:async()=>({state:'CONFIRMED',saleId:'V',kind:'SALE'})},'@/services/orderService':{},'./browserLock':{withCheckoutLock:async(scope,run)=>run()}})
 const render=()=>h.render(()=>useCheckoutFlow({companyId:'A',branchId:'B',userId:'U'},allowed,()=>{confirmed++}))
 try{let value=render();const pending=value.submit('SALE',{});await flush();assert.equal(render().pending,true);allowed=false;render();gate.resolve({id:'V'});await pending;assert.equal(confirmed,0);assert.deepEqual(headers,{'X-Company-Id':'A','X-Branch-Id':'B'});allowed=true;render();await flush();assert.equal(confirmed,1)}finally{h.unmount();global.localStorage=oldStorage;global.sessionStorage=oldSession;global.window=oldWindow}
})
test('cookie session actor changed in another tab invalidates pending confirmation with no bearer token',async()=>{
 const h=hookHarness(),gate=deferred(),map=new Map([['auth:user',JSON.stringify({id:'U'})]]),saved={storage:global.localStorage,session:global.sessionStorage,window:global.window}
 global.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};global.sessionStorage=global.localStorage;global.window={addEventListener(){},removeEventListener(){}}
 let confirmed=0
 const {useCheckoutFlow}=loadReportModule('../sales/checkout/useCheckoutFlow.ts',{react:h.hooks,'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',getAuthToken:()=>null},'@/services/saleService':{createSale:()=>gate.promise},'@/services/orderService':{},'./browserLock':{withCheckoutLock:async(scope,run)=>run()}})
 try{const flow=h.render(()=>useCheckoutFlow({companyId:'A',branchId:'B',userId:'U'},true,()=>confirmed++));const p=flow.submit('SALE',{});await flush();map.set('auth:user',JSON.stringify({id:'U2'}));assert.equal(flow.isCurrent(),false);gate.resolve({id:'V'});await p;assert.equal(confirmed,0)}finally{h.unmount();global.localStorage=saved.storage;global.sessionStorage=saved.session;global.window=saved.window}
})
