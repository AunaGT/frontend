const {test}=require('node:test'),assert=require('node:assert/strict'),{mountBarcodePrintPage}=require('./helpers/barcodePrintHarness.cjs')
test('Inventory preview gets exact generated Blob without requiring Reports module',()=>{
  const pdf={labels:new Blob(['pdf']),guide:null,plan:{ranges:[]}},page=mountBarcodePrintPage({pdf});page.tab('preview')
  const viewer=page.nodes.find(n=>n.type?.name==='PdfDocumentPreview');assert.equal(viewer.props.pdf,pdf.labels);viewer.props.onDownload();assert.equal(page.calls[0].blob,pdf.labels);page.unmount()
})
