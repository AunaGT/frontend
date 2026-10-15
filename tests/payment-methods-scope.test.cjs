const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('dialog rechecks context after mutateAsync lifecycle before success, error or closing a new form',async()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  for(const rejected of [false,true]){
    let company='A',complete,closed=0;const nodes=[],toasts=[]
    const scope={companyId:'A',branchId:'BA'}
    const dialog={open:true,mode:'create',scope}
    const api={getActiveCompanyId:()=>company,getActiveBranchId:()=>company==='A'?'BA':'BB',ApiError:class extends Error{}}
    const helpers=loadReportModule('../../hooks/usePaymentMethodsCatalog.ts',{'@/services/api':api})
    const hooks={...helpers,usePaymentMethodsCatalog:()=>({data:{items:[]}}),useCreatePaymentMethod:()=>({mutateAsync:()=>new Promise((resolve,reject)=>{complete=()=>rejected?reject(new Error('Old A error')):resolve({id:1})})}),useUpdatePaymentMethod:()=>({}),useDeletePaymentMethod:()=>({})}
    const Page=loadReportModule('../catalogs/components/PaymentMethodsTab.tsx',{
      react:{...React,useState:initial=>{
        if(initial==='')return ['QA',()=>{}]
        if(initial&&typeof initial==='object'&&'mode' in initial)return [dialog,()=>{closed++}]
        return [initial,()=>{}]
      },useEffect(){}},
      '@/hooks/usePaymentMethodsCatalog':hooks,'@/services/api':api,
      '@/context/useTenant':{useTenant:()=>({company:{id:company},branch:{id:'BA'}})},
      '@/hooks/use-toast':{useToast:()=>({toast:t=>toasts.push(t)})},
      '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
      '@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10,setPage(){}}),useResetPageOnFilterChange(){}},
      './useCatalogSearch':{useCatalogSearch:()=>({search:'',query:'',setSearch(){}})},
    },nodes).PaymentMethodsTab
    renderToStaticMarkup(React.createElement(Page))
    const form=nodes.find(n=>n.type==='form')
    const pending=form.props.onSubmit({preventDefault(){}})
    assert.equal(typeof complete,'function');company='B';complete()
    await pending
    assert.equal(toasts.length,0);assert.equal(closed,0)
  }
})
test('late failed mutation is discarded after context switch instead of showing the old company error',async()=>{
  let company='A',failRequest
  const mod=loadReportModule('../../hooks/usePaymentMethodsCatalog.ts',{
    '@tanstack/react-query':{useMutation:q=>q,useQueryClient:()=>({invalidateQueries:async()=>{}})},
    '@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=>company==='A'?'BA':'BB',apiFetch:()=>new Promise((_resolve,reject)=>{failRequest=reject}),ApiError:class extends Error{}},
  })
  const mutation=mod.useCreatePaymentMethod()
  const promise=mutation.mutationFn({companyId:'A',branchId:'BA',data:{name:'QA',settlement_kind:'BANK'}})
  company='B';failRequest(new Error('Saldo privado de empresa A'))
  await assert.rejects(promise,error=>error.code==='PM_CONTEXT_CHANGED')
})
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
