const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
const item={id:'document',type_id:'type',original_name:'contrato.pdf',mime_type:'application/pdf',size_bytes:100,created_at:'2026-10-20',archived_at:null,uploaded_by:'user'}
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve}}
const flush=()=>new Promise(r=>setImmediate(r))
function setup(t,{fetchFile=async()=>({ok:true,blob:async()=>new Blob(['%PDF-1.4 content'],{type:'application/pdf'})})}={}){
  const h=hookHarness(),nodes=[],accesses=[],anchors=[],fetches=[],jobs=[],errors=[]
  let company='A',employee='employee',allowed=true
  t.mock.method(global,'fetch',async(url,options)=>{fetches.push({url,options});return fetchFile(url,options)})
  const oldDocument=global.document
  global.document={createElement:()=>{const anchor={click(){anchors.push(anchor)}};return anchor}}
  const {EmployeeDocuments}=loadReportModule('../hr/pages/EmployeeDocuments.tsx',{
    react:h.hooks,
    '@/context/useTenant':{useTenant:()=>({company:{id:company},branch:{id:'branch'}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'user'},hasPermission:permission=>permission==='hr.documents.view'&&allowed})},
    '@/hooks/use-toast':{useToast:()=>({toast:message=>errors.push(message)})},
    '@/services/hrService':{fetchEmployeeDocuments(){throw Error('Unexpected list request')},accessEmployeeDocument:async(...args)=>{accesses.push(args);return{url:'https://storage.example/file?token='+accesses.length,expiresAt:'2026-10-20T23:59:59Z'}}},
    '@tanstack/react-query':{useQuery:()=>({data:{items:[item],requirements:[]},isPending:false}),useQueryClient:()=>({invalidateQueries(){}}),useMutation:options=>({isPending:false,mutate:value=>{const job=Promise.resolve(options.mutationFn(value)).catch(options.onError);jobs.push(job);return job}})},
  },nodes)
  const render=()=>{nodes.length=0;return h.render(()=>EmployeeDocuments({employeeId:employee}))}
  render()
  t.after(()=>{h.unmount();global.document=oldDocument})
  const open=()=>{const button=nodes.find(n=>n.props['aria-label']==='Ver contrato.pdf');assert.ok(button,'file name must be an accessible preview button');return button.props.onClick()}
  return{nodes,accesses,anchors,fetches,jobs,errors,render,open,company:value=>company=value,employee:value=>employee=value,allow:value=>allowed=value}
}
const viewer=app=>app.nodes.find(n=>n.type?.name==='PdfDocumentPreview')
test('clicking the employee document name loads its private PDF into the shared report viewer',async t=>{
  const app=setup(t);app.open();await Promise.all(app.jobs);app.render()
  assert.deepEqual(app.accesses,[['employee','document',false]])
  assert.ok(viewer(app));assert.match(await viewer(app).props.pdf.text(),/%PDF-1.4/)
  assert.equal(app.anchors.length,0)
  assert.equal(app.fetches[0].options.credentials,'omit');assert.equal(app.fetches[0].options.cache,'no-store')
  assert.equal(app.fetches[0].options.referrerPolicy,'no-referrer')
})
test('closing the preview aborts loading and ignores a late file',async t=>{
  const delayed=deferred(),app=setup(t,{fetchFile:()=>delayed.promise})
  app.open();await flush();app.render()
  app.nodes.find(n=>n.props.open===true&&n.props.onOpenChange).props.onOpenChange(false);app.render()
  assert.equal(app.fetches[0].options.signal.aborted,true)
  delayed.resolve({ok:true,blob:async()=>new Blob(['%PDF-old'])});await Promise.all(app.jobs);app.render()
  assert.equal(viewer(app),undefined)
})
for(const scope of ['company','employee'])test('a late private preview cannot cross a '+scope+' change',async t=>{
  const delayed=deferred(),app=setup(t,{fetchFile:()=>delayed.promise})
  app.open();await flush();app[scope]('other');app.render()
  delayed.resolve({ok:true,blob:async()=>new Blob(['%PDF-old'])});await Promise.all(app.jobs);app.render()
  assert.equal(viewer(app),undefined);assert.equal(app.anchors.length,0)
})
test('returning to the original company does not reopen a previously loaded private preview',async t=>{
  const app=setup(t);app.open();await Promise.all(app.jobs);app.render();assert.ok(viewer(app))
  app.company('other');app.render();app.company('A');app.render()
  assert.equal(viewer(app),undefined)
  assert.equal(app.nodes.some(n=>n.props.open===true&&n.props.onOpenChange),false)
})
test('an expired file can retry with a newly authorized link',async t=>{
  let attempt=0
  const app=setup(t,{fetchFile:async()=>++attempt===1?{ok:false,status:403}:{ok:true,blob:async()=>new Blob(['%PDF-fresh'])}})
  app.open();await Promise.all(app.jobs);app.render()
  assert.equal(viewer(app),undefined)
  const retry=app.nodes.find(n=>n.props.children==='Reintentar vista previa');assert.ok(retry)
  retry.props.onClick();await Promise.all(app.jobs);app.render()
  assert.equal(app.accesses.length,2);assert.match(await viewer(app).props.pdf.text(),/fresh/)
})
test('download still requests the original and revoked viewing permission blocks access',async t=>{
  const app=setup(t)
  app.nodes.find(n=>n.props.children?.includes?.('Descargar')).props.onClick();await Promise.all(app.jobs)
  assert.deepEqual(app.accesses,[['employee','document',true]])
  assert.equal(app.anchors[0].rel,'noopener noreferrer');assert.equal(app.anchors[0].referrerPolicy,'no-referrer')
  app.allow(false);app.render();const before=app.accesses.length
  const button=app.nodes.find(n=>n.props['aria-label']==='Ver contrato.pdf')
  if(button){assert.equal(button.props.disabled,true);await button.props.onClick()}
  await Promise.all(app.jobs);assert.equal(app.accesses.length,before)
})
