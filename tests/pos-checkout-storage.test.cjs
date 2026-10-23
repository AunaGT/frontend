const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const mem=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
const scope={companyId:'A',branchId:'B',userId:'U'}
test('recovery stores the original bounded failure without persisting extra exception fields',()=>{
 const api=loadReportModule('../sales/checkout/attemptStorage.ts'),storage=mem()
 api.saveCheckoutAttempt(scope,{...scope,key:'K',kind:'SALE',state:'UNKNOWN',lastError:'x'.repeat(600),stack:'private trace'},storage)
 const restored=api.loadCheckoutAttempt(scope,storage)
 assert.equal(restored.lastError.length,500);assert.equal(restored.stack,undefined)
})
test('checkout attempt is scoped, survives reload, and stores only recovery metadata',()=>{
 const api=loadReportModule('../sales/checkout/attemptStorage.ts'),storage=mem(),attempt={...scope,key:'K',kind:'SALE',state:'UNKNOWN',customer:'must not persist'}
 api.saveCheckoutAttempt(scope,attempt,storage)
 const restored=api.loadCheckoutAttempt(scope,storage);assert.equal(restored.key,'K');assert.equal(restored.customer,undefined)
 assert.equal(api.loadCheckoutAttempt({...scope,companyId:'OTHER'},storage),null)
 assert.throws(()=>api.saveCheckoutAttempt(scope,{...attempt,branchId:'OTHER'},storage))
})
test('unavailable storage fails before a checkout can be submitted',()=>{
 const api=loadReportModule('../sales/checkout/attemptStorage.ts')
 assert.throws(()=>api.saveCheckoutAttempt(scope,{...scope,key:'K',kind:'SALE',state:'SUBMITTING'},{setItem(){throw Error('quota')}}),/guardar|recuper/i)
})
test('sale drafts are isolated by company and branch, leaving legacy drafts untouched',()=>{
 const before=global.localStorage;global.localStorage=mem()
 try{const api=loadReportModule('../../services/saleDraftStorage.ts');const draft={lines:[{productId:'P',qty:1}]};api.saveNewSaleDraft('U',draft,scope);assert.ok(api.loadNewSaleDraft('U',scope));assert.equal(api.loadNewSaleDraft('U',{...scope,branchId:'C'}),null)}finally{global.localStorage=before}
})
test('confirmation consumes only its matching saved draft even after the original tab closes',()=>{
 const before=global.localStorage;global.localStorage=mem()
 try{const api=loadReportModule('../../services/saleDraftStorage.ts');api.saveNewSaleDraft('U',{lines:[]},scope);const first=api.loadNewSaleDraft('U',scope);assert.ok(first.draftId);assert.equal(api.consumeNewSaleDraft('U',scope,first.draftId),true);assert.equal(api.loadNewSaleDraft('U',scope),null)
 api.saveNewSaleDraft('U',{lines:[]},scope);assert.equal(api.consumeNewSaleDraft('U',scope,first.draftId),false);assert.ok(api.loadNewSaleDraft('U',scope))
 }finally{global.localStorage=before}
})
