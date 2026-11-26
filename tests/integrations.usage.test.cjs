const test=require('node:test'),assert=require('node:assert/strict')
const {integrationView,scope}=require('./helpers/integrationViewHarness.cjs')
test('usage exposes real totals and no-data without a fictional error rate',async()=>{
 let request,fail=false
 const result={total:5,successful:3,errors:2,errorRate:0.4,from:'2026-10-19T12:00:00Z',to:'2026-10-26T12:00:00Z',byStatus:[{family:'2xx',count:3}],byRoute:[{route:'/quotes',count:5}]}
 const f=integrationView('../config/integrations/IntegrationUsage.tsx','IntegrationUsage',{scope},{'./api':{getUsage:async(_s,period,id,signal)=>{request={period,id,signal};if(fail)throw Error('offline');return result},integrationError:()=> 'No disponible'}})
 assert.match(f.render(),/Cargando uso/);await f.flush();assert.match(f.render(),/40/);assert.equal(request.period,'7d')
 fail=true;f.nodes.find(n=>typeof n.props.onValueChange==='function').props.onValueChange('24h');f.render();await f.flush()
 assert.match(f.render(),/No disponible/);assert.doesNotMatch(f.render(),/40/)
 f.unmount();assert.equal(request.signal.aborted,true)
})
test('usage result from an aborted scope cannot replace current data',async()=>{
 let resolve
 const f=integrationView('../config/integrations/IntegrationUsage.tsx','IntegrationUsage',{scope},{'./api':{getUsage:()=>new Promise(r=>resolve=r),integrationError:()=> 'No disponible'}})
 f.render();f.unmount();resolve({total:999,successful:999,errors:0,errorRate:0,from:'2026-10-19T12:00:00Z',to:'2026-10-26T12:00:00Z',byStatus:[],byRoute:[]});await f.flush()
 assert.doesNotMatch(f.render(),/999/)
 f.unmount()
})
