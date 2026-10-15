const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('role selector cache belongs to both company and signed-in user',()=>{
 let scope={company:{id:'a'}},auth={user:{id:'u'},permissionsReady:true,hasPermission:()=>true},last
 const {useRoles}=loadReportModule('../../hooks/useRoles.ts',{'@tanstack/react-query':{useQuery:o=>(last=o)},'@/context/useTenant':{useTenant:()=>scope},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>auth},'@/services/userService':{getRoles(){}}})
 useRoles();assert.deepEqual(last.queryKey,['roles','a','u']);assert.equal(last.enabled,true)
 scope={company:{id:'b'}};auth={...auth,user:{id:'v'}};useRoles();assert.deepEqual(last.queryKey,['roles','b','v'])
 auth={...auth,permissionsReady:false};useRoles();assert.equal(last.enabled,false)
})
