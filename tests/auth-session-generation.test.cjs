const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('session generation invalidates old identity and stale auth response cannot replace a newer generation',async()=>{
 const map=new Map([['auth:user',JSON.stringify({id:'U'})]]),prior=global.localStorage
 global.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 try{const api=loadReportModule('../../services/authSession.ts');const before=api.authSessionIdentity();const first=api.beginAuthSessionChange();assert.notEqual(api.authSessionIdentity(),before);assert.equal(api.authSessionMatches('U'),false)
 const second=api.beginAuthSessionChange();api.confirmAuthSession(first,'U');assert.equal(api.authSessionMatches('U'),false)
 api.confirmAuthSession(second,'U2');map.set('auth:user',JSON.stringify({id:'U2'}));assert.equal(api.authSessionMatches('U2'),true);assert.equal(api.authSessionMatches('U'),false)
 }finally{global.localStorage=prior}
})
test('real cookie login and logout invalidate checkout identity before their network request',async()=>{
 const map=new Map([['auth:user',JSON.stringify({id:'U'})]]),prior=global.localStorage
 global.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 try{const session=loadReportModule('../../services/authSession.ts');let requests=0
 const service=loadReportModule('../../services/authService.ts',{'./api':{apiFetch:async path=>{requests++;assert.equal(session.authSessionMatches('U'),false);return{user:{id:'U2'}}}}})
 const result=await service.loginRequest({email:'qa@example.invalid',password:'not-a-real-login'});assert.equal(result.user.id,'U2');map.set('auth:user',JSON.stringify(result.user));assert.equal(session.authSessionMatches('U2'),true)
 await service.logoutRequest();assert.equal(session.authSessionMatches('U2'),false);assert.equal(requests,2)
 }finally{global.localStorage=prior}
})
