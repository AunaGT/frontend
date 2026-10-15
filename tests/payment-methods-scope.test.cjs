const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('options are company scoped and fetch with captured context',async()=>{
  let tenant={company:{id:'A'},branch:{id:'BA'}},sent
  const hook=loadReportModule('../../hooks/usePaymentMethods.ts',{
    '@/context/useTenant':{useTenant:()=>tenant},'@tanstack/react-query':{useQuery:q=>q},
    '@/services/api':{apiFetch:async(path,opts)=>{sent={path,opts};return[]}},
  }).usePaymentMethods
  const a=hook();tenant={company:{id:'B'},branch:{id:'BB'}};const b=hook()
  assert.deepEqual(a.queryKey,['payment-methods','A',false]);assert.deepEqual(b.queryKey,['payment-methods','B',false])
  await a.queryFn({signal:undefined});assert.equal(sent.opts.headers['X-Company-Id'],'A');assert.equal(sent.opts.headers['X-Branch-Id'],'BA')
  tenant={};assert.equal(hook().enabled,false)
})
test('late confirmed mutation invalidates only initial company and rejects wrong-context success',async()=>{
  let company='A',branch='BA',sent,finish;const keys=[]
  const mod=loadReportModule('../../hooks/usePaymentMethodsCatalog.ts',{
    '@/context/useTenant':{useTenant:()=>({company:{id:company},branch:{id:branch}})},
    '@tanstack/react-query':{useMutation:q=>q,useQuery:q=>q,useQueryClient:()=>({invalidateQueries:({queryKey})=>keys.push(queryKey)})},
    '@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=>branch,apiFetch:async(path,opts)=>{sent=opts;return new Promise(r=>finish=r)},ApiError:class extends Error{}},
  })
  const mutation=mod.useCreatePaymentMethod(),vars={companyId:'A',branchId:'BA',data:{name:'Caja chica',settlement_kind:'CASH'}}
  const pending=mutation.mutationFn(vars);company='B';branch='BB';finish({id:9})
  await assert.rejects(pending,e=>e.code==='PM_CONTEXT_CHANGED')
  await mutation.onSettled(undefined,new Error(),vars)
  assert.deepEqual(keys,[['payment-methods','A']]);assert.equal(sent.headers['X-Company-Id'],'A')
  assert.deepEqual(JSON.parse(sent.body),vars.data)
})
