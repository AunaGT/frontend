const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('missing historical data surfaces a recoverable error instead of selecting the old invoice renderer',async()=>{
  const h=hookHarness(),api={saleDocumentScope:s=>s,requestSaleDocument:async()=>{throw Object.assign(Error('Datos históricos incompletos'),{code:'LEGACY_DOCUMENT_REQUIRED'})}}
  const {useSaleDocument}=loadReportModule('../sales/documents/useSaleDocument.ts',{react:h.hooks,'@/modules/config/hardware/public':api,'@/services/authSession':{authSessionIdentity:()=> 's'}})
  const render=()=>h.render(()=>useSaleDocument({scope:{companyId:'A',branchId:'B',userId:'U'},saleId:'sale'}))
  const result=await render().prepare();assert.equal(result,null)
  assert.match(render().error,/Datos históricos incompletos/);h.unmount()
})
test('sale document preparation keeps original artifact bytes and a context change removes the preview',async()=>{
  const h=hookHarness(),blob=new Blob(['%PDF-original'],{type:'application/pdf'}),downloads=[]
  const api={saleDocumentScope:s=>({...s,sessionId:'s'}),assertSaleDocumentScope:()=>{},requestSaleDocument:async()=>({id:'artifact',state:'READY',format:'A4'}),waitSaleDocument:async(_s,_id,a)=>a,saleDocumentFile:async()=>blob}
  const {useSaleDocument}=loadReportModule('../sales/documents/useSaleDocument.ts',{react:h.hooks,'@/modules/config/hardware/public':api,'@/modules/reports/documents/reportDownload':{downloadReportBlob:(...args)=>downloads.push(args)},'@/services/authSession':{authSessionIdentity:()=> 's'}})
  let scope={companyId:'A',branchId:'B',userId:'U'}
  const render=()=>h.render(()=>useSaleDocument({scope,saleId:'sale',format:'A4'}))
  let value=render();await value.prepare();value=render();assert.equal(value.pdf,blob)
  value.download();assert.equal(downloads[0][0],blob)
  const old=value;scope={...scope,companyId:'OTHER'};value=render();assert.equal(value.pdf,null)
  old.download();assert.equal(downloads.length,1);h.unmount()
})
test('a cross-tab session change immediately revokes access and removes the displayed sale PDF',async()=>{
  const previous=global.window;global.window=new EventTarget()
  const h=hookHarness();let session='first'
  const blob=new Blob(['private sale']),api={saleDocumentScope:s=>s,requestSaleDocument:async()=>({id:'artifact',state:'READY'}),waitSaleDocument:async(_s,_id,a)=>a,saleDocumentFile:async()=>blob}
  try{
    const {useSaleDocument}=loadReportModule('../sales/documents/useSaleDocument.ts',{react:h.hooks,'@/modules/config/hardware/public':api,'@/services/authSession':{authSessionIdentity:()=>session}})
    const render=()=>h.render(()=>useSaleDocument({scope:{companyId:'A',branchId:'B',userId:'U'},saleId:'sale'}))
    let value=render();await value.prepare();value=render();assert.equal(value.pdf,blob)
    session='second';window.dispatchEvent(new Event('storage'))
    assert.equal(value.canAccess(),false)
    value=render();assert.equal(value.pdf,null);h.unmount()
  }finally{global.window=previous}
})
test('the PDF viewer cannot print a stale sale Blob even before its next render',()=>{
  const previous=global.window;let opened=0;global.window={open:()=>{opened++}}
  const React=require('react'),nodes=[]
  try{
    const {PdfDocumentPreview}=loadReportModule('../../components/shared/pdf/PdfDocumentPreview.tsx',{react:{...React,useEffect:()=>{},useRef:()=>({current:null}),useState:initial=>[initial,()=>{}]}},nodes)
    PdfDocumentPreview({pdf:new Blob(['private sale']),onDownload:()=>{},canAccess:()=>false})
    const print=nodes.find(n=>n.props.children?.some?.(c=>c===' Imprimir'))
    assert(print);print.props.onClick();assert.equal(opened,0)
  }finally{global.window=previous}
})
