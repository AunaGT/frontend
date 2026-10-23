const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {QueryClient,QueryObserver}=require('@tanstack/react-query'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const file=path.resolve(__dirname,'../src/modules/inventory/products/hooks/useInventoryProducts.ts'),tick=()=>new Promise(setImmediate)
const page={items:[{id:'P',name:'Café'}],page:1,pageSize:50,totalItems:1,totalPages:1,nextPage:null,prevPage:null}
function fixture(network=async()=>page){
 const h=hookHarness(),client=new QueryClient({defaultOptions:{queries:{retry:false}}}),requests=[];let session='S',tenant={company:{id:'A'},branch:{id:'B'},isConsolidated:false}
 const boundary={apiFetch:async(url,options)=>{requests.push({url,options});return network(url,options)}},service=loadReportModule('../../services/productService.ts',{'@/services/api':boundary,'./api':boundary})
 const api=fs.existsSync(file)?loadReportModule('../inventory/products/hooks/useInventoryProducts.ts',{react:h.hooks,'@/context/useTenant':{useTenant:()=>tenant},'@/services/authSession':{authSessionIdentity:()=>session},'@/hooks/useProducts':{PRODUCTS_QUERY_KEY:['products']},'@/services/productService':service,'@tanstack/react-query':{useQuery:options=>{const observer=h.hooks.useMemo(()=>new QueryObserver(client,options),[JSON.stringify(options.queryKey)]);observer.setOptions(options);h.hooks.useEffect(()=>observer.subscribe(()=>{}),[observer]);return observer.getCurrentResult()}}}):{}
 return{requests,client,setTenant:next=>tenant=next,changeSession:()=>session='NEW',read:(params={page:1,pageSize:50,includeSummary:true,branchId:'all'})=>{assert.equal(typeof api.useInventoryProducts,'function');return h.render(()=>api.useInventoryProducts(params))},close:()=>{h.unmount();client.clear()}}
}
test('inventory requests one scoped page with distinct header and screen branch and keeps invalidation prefix',async()=>{
 const f=fixture();try{f.read();await tick();const s=f.read();assert.equal(s.data.totalItems,1);assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'});assert.match(f.requests[0].url,/branch_id=all/);assert.match(f.requests[0].url,/pageSize=50/);assert.deepEqual(f.client.getQueryCache().getAll()[0].queryKey.slice(0,2),['products','inventory-page'])}finally{f.close()}
})
test('inventory settles rapid text after300ms without exposing stale results; page and category are immediate',async()=>{
 const f=fixture();try{f.read();await tick();for(const search of ['c','ca','caf']){const s=f.read({page:1,search});assert.equal(s.data,undefined);assert.equal(s.isSearchPending,true);assert.equal(s.isLoading,true)}
 assert.equal(f.requests.length,1);await new Promise(r=>setTimeout(r,320));f.read({page:1,search:'caf'});await tick();assert.equal(f.read({page:1,search:'caf'}).isSearchPending,false);assert.equal(f.requests.filter(r=>r.url.includes('search=')).length,1)
 f.read({page:2,search:'caf',category:'Bebidas'});await tick();assert.match(f.requests.at(-1).url,/page=2/);assert.match(f.requests.at(-1).url,/category=Bebidas/)
 }finally{f.close()}
})
test('scope change aborts old request and ignored abort cannot populate another company, branch or session',async()=>{
 let release;const f=fixture(async(_url,o)=>o.headers['X-Company-Id']==='A'?new Promise(r=>release=r):{...page,items:[{id:'NEW'}]})
 try{f.read();f.setTenant({company:{id:'C'},branch:null,isConsolidated:true});f.read();assert.equal(f.requests[0].options.signal.aborted,true);await tick();release(page);await tick();assert.equal(f.read().data.items[0].id,'NEW');assert.equal(f.requests.at(-1).options.headers['X-Branch-Id'],'all');f.changeSession();assert.equal(f.read().data,undefined);await tick();assert.equal(f.read().data.items[0].id,'NEW')}finally{f.close()}
})
test('an unrendered session change rejects a late response and missing context never fetches',async()=>{
 let release;const f=fixture(()=>new Promise(r=>release=r));try{f.read();f.changeSession();release(page);await tick();assert.equal(f.client.getQueryCache().getAll()[0].state.data,undefined);f.setTenant({company:null,branch:null,isConsolidated:false});assert.equal(f.read().data,undefined);assert.equal(f.requests.length,1)}finally{f.close()}
})
test('server clamp and errors stay authoritative and retry can recover',async()=>{
 let fail=true;const f=fixture(async()=>{if(fail)throw Error('offline');return {...page,page:2,totalItems:60,totalPages:2}})
 try{f.read({page:999});await tick();let s=f.read({page:999});assert.equal(s.isError,true);assert.equal(s.data,undefined);fail=false;await s.refetch();s=f.read({page:999});assert.equal(s.data.page,2);assert.equal(s.data.totalItems,60)}finally{f.close()}
})
