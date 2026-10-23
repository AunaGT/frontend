const test=require('node:test'),assert=require('node:assert/strict')
test('public signed display/comparison and report six-place cells preserve exact values',()=>{
 const units=loadReportModule('../inventory/units/public.ts',{'@/services/api':{}});assert.equal(units.compareUnitQuantities('-0.123456','0'),-1);assert.equal(units.formatUnitDecimal('-0.123456'),'−0.123456'.replace('−','-'));assert.equal(units.compareUnitDecimals('9007199254740992.000001','9007199254740992'),1)
 const report=loadReportModule('reportModel.ts',{'@/services/api':{}});assert.equal(report.formatReportCell('9007199254740992.123456',{type:'decimal',quantityDecimals:6},{}),'9,007,199,254,740,992.123456');assert.equal(report.formatReportCell('-0.123456',{type:'decimal',quantityDecimals:6},{}),'-0.123456')
})
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
test('actual prepared Products report formats and sorts tiny numeric valuations without weakening exact strings',async()=>{
 const path=require('node:path'),backend=path.resolve(__dirname,'../../deposito-backend'),{withMocks,jsonResponse}=require(path.join(backend,'tests/helpers/reportHarness.cjs'))
 const prisma={systemSetting:{findUnique:async()=>null},product:{findMany:async()=>[{id:'p',name:'Medido',stock:'0.000001',cost:'0.000001',price:'1',kind:'STANDARD'}]}}
 await withMocks({[require.resolve(path.join(backend,'src/models/prisma'))]:{prisma},[require.resolve(path.join(backend,'src/utils/pdfBranding'))]:{getBrandingForPdf:async()=>({})}},require.resolve(path.join(backend,'src/modules/reports/controller')),async controller=>{
  const res=jsonResponse();await controller.productsReport({companyId:'A',query:{format:'json'}},res,e=>{throw e});const report=res.body,{preparedReportSchema,formatReportCell,compareReportCells}=loadReportModule('reportModel.ts'),section=report.sections.find(s=>s.id==='detail'),column=section.columns.find(c=>c.id==='value'),value=section.rows[0].value
  preparedReportSchema.parse(report);assert.equal(value,1e-12);assert.equal(formatReportCell(value,column,report),'Q\u00a00.00');assert.equal(compareReportCells(value,0,column),1);assert.equal(compareReportCells(-1e-12,value,column),-1)
  assert.equal(formatReportCell(1e21,{type:'decimal'},report),'1,000,000,000,000,000,000,000');assert.equal(formatReportCell('9007199254740992.123456',{type:'decimal'},report),'9,007,199,254,740,992.123456');assert.equal(compareReportCells('9007199254740992.000001','9007199254740992',column),1);assert.throws(()=>formatReportCell('1e-12',column,report))
 })
})
test('actual label refresh retains edits/additions/removals and rejects superseded, tenant and unmounted responses',async()=>{
 const h=hookHarness(),pending=[],{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs'),{createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),base=labelProduct(),other={...base,id:'other'},added={...base,id:'added'};let companyId='A'
 const {useBarcodePrint}=loadReportModule('../inventory/barcodeLabels/useBarcodePrint.ts',{react:h.hooks,'./barcodeLabelService':{fetchBarcodeLayout:async()=>({design:createLabelTemplate(),defaultPaper:defaultPaper()}),fetchBarcodeCandidates:async(q,signal)=>{const d=deferred();pending.push({...d,signal});return d.promise}},'./labelPdf':{},'@/modules/reports/documents/reportDownload':{}})
 let v;const render=()=>v=h.render(()=>useBarcodePrint({companyId,userId:'U',branchId:'B'})),settle=(index,revision)=>pending[index].resolve({items:[{...base,unit_revision:revision},{...other,unit_revision:revision}]})
 try{render();await new Promise(r=>setImmediate(r));render();v.selectProduct(base);v.selectProduct(other);render();let refresh=v.refreshSelected();v.setCopies(base.id,9);v.removeProduct(other.id);v.selectProduct(added);render();settle(0,2);await refresh;render();assert.equal(v.selected.get(base.id).copies,9);assert.ok(!v.selected.has(other.id));assert.ok(v.selected.has(added.id))
  const old=v.refreshSelected(),latest=v.refreshSelected();settle(2,4);await latest;render();settle(1,3);await old;render();assert.equal(v.selected.get(base.id).product.unit_revision,4);assert.equal(pending[1].signal?.aborted,true)
  refresh=v.refreshSelected();companyId='B';render();companyId='A';render();await new Promise(r=>setImmediate(r));settle(3,5);await refresh;render();assert.equal(v.selected.size,0);assert.equal(pending[3].signal?.aborted,true)
  v.selectProduct(base);render();refresh=v.refreshSelected();h.unmount();settle(4,6);await refresh;assert.equal(pending[4].signal?.aborted,true)
 }finally{h.unmount()}
})
test('actual import file reads reject stale tenant, replacement and unmount success/error continuations',async t=>{
 for(const finalError of [false,true])await t.test(finalError?'unmount current error':'unmount current success',async()=>{
 const h=hookHarness(),nodes=[],toasts=[],XLSX=require('xlsx'),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{nombre:'QA'}]),'Productos');const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});let companyId='A',writesAfterUnmount=0,unmounted=false
 const hooks={...h.hooks,useState:initial=>{const [value,set]=h.hooks.useState(initial);return[value,next=>{if(unmounted)writesAfterUnmount++;set(next)}]}}
 const Page=loadReportModule('../inventory/pages/ImportPage.tsx',{react:hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/context/useTenant':{useTenant:()=>({company:{id:companyId},branch:{id:'B',name:'Central'},registerTenantExitGuard:()=>()=>{}})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null})},'@/hooks/use-toast':{useToast:()=>({toast:t=>toasts.push(t)})},'@tanstack/react-query':{useQuery:()=>({data:[]})},'@/components/shared/useImportStream':{useImportStream:()=>({cancel(){}})},'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=> 'token',ApiError:class extends Error{}},'../services/api':{},'./api':{}},nodes).default
 const render=()=>{nodes.length=0;h.render(()=>Page())},workbench=()=>nodes.find(n=>n.type?.name==='ImportWorkbench').props,read=name=>{const d=deferred(),file=new File(['deferred'],name);Object.defineProperty(file,'arrayBuffer',{value:()=>d.promise});return{...d,start:()=>workbench().onFile(file)}}
 try{render();const stale=read('A.xlsx'),old=stale.start();companyId='B';render();render();stale.resolve(bytes);await old;render();assert.equal(workbench().file,null)
  const first=read('first.xlsx'),second=read('second.xlsx'),a=first.start(),b=second.start();second.resolve(bytes);await b;first.resolve(bytes);await a;render();assert.equal(workbench().file.name,'second.xlsx')
  const fail=read('old-error.xlsx'),failure=fail.start(),newest=read('new.xlsx'),newRead=newest.start();newest.resolve(bytes);await newRead;fail.reject(Error('obsolete read'));await failure;render();assert.equal(workbench().file.name,'new.xlsx');assert.equal(toasts.length,0)
  const leaving=read('leaving.xlsx'),left=leaving.start();companyId='C';render();leaving.reject(Error('tenant read'));await left;assert.equal(toasts.length,0)
  const final=read('unmounted.xlsx'),finalRead=final.start();h.unmount();unmounted=true;if(finalError)final.reject(Error('unmounted'));else final.resolve(bytes);await finalRead;assert.equal(writesAfterUnmount,0);assert.equal(toasts.length,0)
 }finally{h.unmount()}
 })
})
const snapshot={version:2,baseUnit:{id:'u',code:'UNIT',name:'Unidad',label:'unidades',decimals:0},presentation:{id:'box',version:1,label:'caja',decimals:0},factor:'7',roundingDelta:'0'}
test('actual v2 label PDF keeps base and box scenes/codes/prices distinct with the same product ID',async()=>{
 const {preparedLabelFixture,withLabelPdf}=require('./helpers/barcodePdfHarness.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs'),p=labelProduct(),prepared=preparedLabelFixture({thermal:true,guide:true,products:[{...p,name:'Producto base',price:'1.00',barcode:'BASE001',presentation_id:null,copies:1},{...p,name:'Producto caja',price:'7.00',barcode:'BOX007',presentation_id:'box',copies:1,unit_snapshot:snapshot}]});prepared.snapshotVersion=2;prepared.design=loadReportModule('../inventory/barcodeLabels/labelDesign.ts').createLabelTemplate('price')
 await withLabelPdf(async({generateBarcodeLabelPdf})=>{const result=await generateBarcodeLabelPdf(prepared);assert.equal(result.plan.scenes.size,2);assert.deepEqual(result.plan.labelPages.map(p=>p.products),[[p.id],[p.id+':box']]);const bytes=Buffer.from(await result.labels.arrayBuffer()),content=require('node:child_process').spawnSync('pdftotext',['-','-'],{input:bytes});assert.equal(content.status,0);for(const text of ['Producto base','Producto caja','BASE001','BOX007','1.00','7.00'])assert.ok(content.stdout.toString().includes(text),text);if(process.env.TASK7_LABEL_OUTPUT)require('node:fs').writeFileSync(process.env.TASK7_LABEL_OUTPUT,bytes)})
})
test('actual report table sorts decimal strings numerically before paginating',()=>{
 const h=hookHarness(),nodes=[],report=require('./fixtures/reportFixtures.cjs').fixture('inventory',0),{ReportDataPreview}=loadReportModule('components/ReportDataPreview.tsx',{react:h.hooks,'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:1,setPage(){}})}},nodes)
 report.sections=[{id:'detail',title:'Detalle',columns:[{id:'qty',label:'Cantidad',type:'decimal',quantityDecimals:6,align:'right'}],rows:[{qty:'10.000001'},{qty:'2.123456'}],totals:null}];report.charts=[]
 ReportDataPreview({report});const Table=nodes.find(n=>n.type?.name==='SectionTable').type;const render=()=>{nodes.length=0;h.render(()=>Table({section:report.sections[0],report}))}
 try{render();const sort=nodes.find(n=>n.props['aria-label']==='Ordenar por Cantidad');assert.ok(sort);sort.props.onClick();render();assert.equal(nodes.find(n=>n.type==='td').props.children,'2.123456');nodes.find(n=>n.props['aria-label']==='Ordenar por Cantidad').props.onClick();render();assert.equal(nodes.find(n=>n.type==='td').props.children,'10.000001')}finally{h.unmount()}
})
test('warehouse view identifies the advanced count as product-location lines',()=>{
 const h=hookHarness(),nodes=[],{WarehousesCard}=loadReportModule('../branches/pages/WarehousesCard.tsx',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({branch:{id:'B'}})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10})},'@tanstack/react-query':{useQuery:()=>({data:[{id:'W',name:'Principal',kind:'BODEGA',locations:[],active:true,stock_units:null,stock_lines:2}]}),useQueryClient:()=>({}),useMutation:()=>({})},'@/services/api':{},'./api':{}},nodes)
 try{h.render(()=>WarehousesCard({canManage:false,branches:[]}));const metric=nodes.find(n=>n.props.label==='Resumen de almacenes').props.items.find(m=>m.label==='Partidas con existencia');assert.equal(metric?.value,'2')}finally{h.unmount()}
})
test('actual label hook preserves base and presentation identities, integer copies, frozen retries and refreshed revision',async()=>{
 const h=hookHarness(),requests=[],renders=[],{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs'),{createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
 const base=labelProduct({presentation_id:null,unit_revision:3}),box={...base,presentation_id:'55555555-5555-4555-8555-555555555555',barcode:null,name:'Producto QA · caja'};let revision=3
 const api={fetchBarcodeLayout:async()=>({design:createLabelTemplate(),defaultPaper:defaultPaper()}),fetchBarcodeCandidates:async()=>({items:[{...base,unitOptions:[{...base,unit_revision:revision},{...box,unit_revision:revision,barcode:'BOX'}]}]}),prepareBarcodeLabels:async(input)=>{requests.push(input);return{snapshotVersion:2,products:input.items.map(i=>({...i,id:i.productId,barcode:i.presentation_id?'BOX':base.barcode,price:i.presentation_id?'7.123456':'1',name:'QA',unit_snapshot:snapshot})),assignedProductIds:[]}}}
 const {useBarcodePrint}=loadReportModule('../inventory/barcodeLabels/useBarcodePrint.ts',{react:h.hooks,'./barcodeLabelService':api,'./labelPdf':{generateBarcodeLabelPdf:async p=>{renders.push(p);return{labels:new Blob(['pdf'])}}},'@/modules/reports/documents/reportDownload':{downloadReportBlob(){}}})
 let v;const render=()=>v=h.render(()=>useBarcodePrint({companyId:'A',userId:'U',branchId:'33333333-3333-4333-8333-333333333333'}))
 try{render();await new Promise(r=>setImmediate(r));render();v.selectProduct(base);render();v.selectProduct(box);render();const key=box.id+':'+box.presentation_id;v.setCopies(key,1.5);render();assert.equal(await v.prepare(true),false);assert.equal(requests.length,0);v.setCopies(key,2);render();assert.equal(await v.prepare(true),true);render();assert.equal(v.selected.size,2);assert.equal(v.selected.get(base.id).product.barcode,base.barcode);assert.equal(v.selected.get(key).product.barcode,'BOX');assert.deepEqual(requests[0].items.map(i=>[i.presentation_id,i.unit_revision,i.copies]),[[null,3,1],[box.presentation_id,3,2]]);assert.equal(await v.prepare(true),true);assert.equal(requests.length,1);assert.equal(renders[1],renders[0]);revision=4;await v.refreshSelected();render();assert.equal(v.selected.get(key).product.unit_revision,4);assert.equal(v.pdf,null)}finally{h.unmount()}
})
test('real report workbook and CSV retain measured quantities, unsafe exact strings, unit columns and numeric order',async()=>{
 const report=require('./fixtures/reportFixtures.cjs').fixture('inventory',0),{compareReportCells}=loadReportModule('reportModel.ts'),{generateReportWorkbook,generateReportCsv}=loadReportModule('documents/reportSpreadsheet.ts'),ExcelJS=require('exceljs')
 report.charts=[];report.sections=[{id:'detail',title:'Detalle',columns:[{id:'qty',label:'Cantidad',type:'decimal',quantityDecimals:6,align:'right'},{id:'unit',label:'Unidad base',type:'text',align:'left'}],rows:[{qty:'0.123456',unit:'kg'},{qty:'9007199254740992.123456',unit:'L'}],totals:null}]
 assert.equal(compareReportCells('10.000001','2',{type:'decimal'}),1);assert.equal(compareReportCells('9007199254740992.000001','9007199254740992',{type:'decimal'}),1)
 const negative=generateReportCsv({...report,sections:[{...report.sections[0],rows:[{qty:'-0.123456',unit:'kg'}]}]},'detail');assert.match(negative,/"-0\.123456","kg"/)
 const bytes=await generateReportWorkbook(report),wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);assert.equal(wb.worksheets[1].getCell('A6').value,0.123456);assert.equal(wb.worksheets[1].getCell('A7').value,'9007199254740992.123456');assert.equal(wb.worksheets[1].getCell('B6').value,'kg');assert.match(generateReportCsv(report,'detail'),/"0.123456","kg"/)
 if(process.env.TASK7_REPORT_OUTPUT){const fs=require('node:fs');fs.writeFileSync(process.env.TASK7_REPORT_OUTPUT+'.xlsx',Buffer.from(bytes));fs.writeFileSync(process.env.TASK7_REPORT_OUTPUT+'.csv',generateReportCsv(report,'detail'));await require('./helpers/barcodePdfHarness.cjs').withLabelPdf(async()=>{const {generateReportPdf}=loadReportModule('documents/reportPdf.ts');fs.writeFileSync(process.env.TASK7_REPORT_OUTPUT+'.pdf',Buffer.from(await(await generateReportPdf(report)).arrayBuffer()))})}
})
const item={id:1,qty:'1',base_qty:'7',available_base_to_return:'1',available_to_return:'0.142857',unit_metadata_version:2,unit_snapshot:snapshot,item_kind:'STANDARD',quantity_decimals:0,net_total:'10.00',refundable_amount:'1.43',estimated_unit_refund:10}
test('return one BASE unit from frozen box7 uses exact remaining base and last refundable cents',()=>{
  const m=loadReportModule('../returns/returnQuantity.ts',{'@/services/api':{}})
  assert.equal(m.returnQuantity('1',item,'es-GT','BASE'),'1')
  assert.equal(m.returnQuantity('2',item,'es-GT','BASE'),null)
  assert.equal(m.estimateLineRefund('1',item,'BASE'),1.43)
})
test('completion sends own selected six-place receipt quantity and omits all service physical fields',()=>{
  const m=loadReportModule('../returns/returnQuantity.ts',{'@/services/api':{}})
  assert.deepEqual(m.returnLineDecision({id:8,qty_returned:'0.123456',unit_metadata_version:2,unit_snapshot:{...snapshot,presentation:null,baseUnit:{...snapshot.baseUnit,decimals:6}},sale_item:{item_kind:'STANDARD'}},{disposition:'SCRAP'},true),{return_item_id:8,received_qty:'0.123456',disposition:'SCRAP',stock_location_id:null})
  assert.deepEqual(m.returnLineDecision({id:9,qty_returned:'0.25',sale_item:{item_kind:'SERVICE'}},{disposition:'SELLABLE'},true),{return_item_id:9})
})
test('real BOM component input retains measured .25 as a string rather than flooring to one',()=>{
  const nodes=[],changes=[]
  const {ProductKitComponentsEditor}=loadReportModule('../inventory/products/ProductKitComponentsEditor.tsx',{'@/services/api':{},'./api':{}},nodes)
  ProductKitComponentsEditor({value:[{component_product_id:'p',qty_per_unit:'1'}],onChange:v=>changes.push(v)})
  nodes.find(n=>n.props.id==='kit-qty-0').props.onChange({target:{value:'0.25'}})
  assert.equal(changes[0][0].qty_per_unit,'0.25')
})
test('kit event API preserves AbortSignal and reversal submits only original assembly identity',async()=>{
  const calls=[],controller=new AbortController()
  const m=loadReportModule('../../services/productService.ts',{'./api':{apiFetch:async(path,options)=>{calls.push({path,options});return{items:[]}}}})
  await m.fetchKitAssemblies('p',{page:2,signal:controller.signal})
  await m.reverseKitAssembly('p','event')
  assert.equal(calls[0].options.signal,controller.signal)
  assert.equal(calls[0].path,'/api/products/p/kit/assemblies?page=2')
  assert.deepEqual(JSON.parse(calls[1].options.body),{assembly_group_id:'event'})
})
test('existing kit detail confirms one complete frozen event and does not send a partial quantity',async()=>{
  const h=hookHarness(),nodes=[],writes=[]
  const ready={assembly_group_id:'event',created_at:'2026-10-18T12:00:00Z',qty:'2',value:'4',status:'READY',components:[]}
  const {ProductKitSection}=loadReportModule('../inventory/products/ProductKitSection.tsx',{react:h.hooks,'@tanstack/react-query':{useQuery:()=>({data:{items:[ready,{...ready,assembly_group_id:'old',status:'SNAPSHOT_REQUIRED'}],page:1,totalPages:1},refetch:async()=>{}})},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/services/productService':{reverseKitAssembly:async(...args)=>writes.push(args)},'./hooks/useKitAssemblePrompt':{useKitAssemblePrompt:()=>({})},'@/services/api':{},'./api':{}},nodes)
  const render=()=>{nodes.length=0;h.render(()=>ProductKitSection({product:{id:'p',kind:'KIT',kitComponents:[]},productId:'p',canEdit:true}))}
  try{render();const action=nodes.find(n=>n.props['aria-label']==='Revertir armado completo event');assert.ok(action);action.props.onClick();render();nodes.find(n=>n.props['data-confirm-kit-reversal']).props.onClick({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(writes,[['p','event',{companyId:'A',branchId:'B'}]])}finally{h.unmount()}
})
test('real return form submits one BASE unit from box7 with explicit null presentation',async()=>{
  const h=hookHarness(),nodes=[],requests=[]
  const sale={id:'sale',date:'2026-10-18',total:10,days_elapsed:1,sale_items:[{...item,product_id:'p',product:{id:'p',name:'Producto'}}],return_policy:{windowDays:30,enabledResolutions:['REFUND_ORIGINAL']}}
  const Page=loadReportModule('../returns/pages/NewReturn.tsx',{react:{...h.hooks,useDeferredValue:v=>v},'react-router-dom':{useNavigate:()=>()=>{},useSearchParams:()=>[new URLSearchParams('sale_id=sale')]},'@tanstack/react-query':{useQuery:()=>({data:{items:[sale]}})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'../hooks/useReturns':{useCreateReturn:()=>({mutateAsync:async p=>requests.push(p)})},'@/services/api':{},'./api':{}},nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())}
  try{render();render();render();nodes.find(n=>n.props['aria-label']==='Seleccionar Producto').props.onChange({target:{checked:true}});nodes.find(n=>n.props.onValueChange&&n.props.value==='').props.onValueChange('Producto defectuoso');render();nodes.find(n=>n.props.onClick&&n.props.children?.includes?.('Registrar')).props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(requests[0].items,[{sale_item_id:1,product_id:'p',qty_returned:'1',presentation_id:null}])}finally{h.unmount()}
})
test('stock movement callback sends exact base .123456 with no commercial factor applied',async()=>{
  const h=hookHarness(),nodes=[],writes=[];let mutation
  const {StockOperationDialog}=loadReportModule('../inventory/stock/StockOperationDialog.tsx',{react:h.hooks,'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}}),useMutation:options=>{mutation=options;return{mutate:()=>options.mutationFn()}}},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/services/stockMoveService':{createStockMove:async p=>writes.push(p)},'@/services/api':{},'./api':{}},nodes)
  const render=()=>{nodes.length=0;h.render(()=>StockOperationDialog({task:'move',branchId:'B',locations:[{id:'from',label:'Origen'},{id:'to',label:'Destino'}],onClose(){}}))}
  try{render();nodes.find(n=>n.props.id==='operation-origin').props.onChange({target:{value:'from'}});nodes.find(n=>n.props.id==='operation-destination').props.onChange({target:{value:'to'}});nodes.find(n=>n.type?.name==='ProductPicker').props.onPick({id:'p',name:'Producto',stock:999,unitValues:{stock:'1.25'},unitConfiguration:{quantity_decimals:6,base_unit:{label:'kg'}}});render();nodes.find(n=>n.props['aria-label']==='Cantidad de Producto').props.onChange({target:{value:'0.123456'}});render();await nodes.find(n=>n.props.submitText==='Confirmar movimiento').props.onSubmit();await new Promise(resolve=>setImmediate(resolve));assert.equal(writes[0].lines[0].qty,'0.123456')}finally{h.unmount()}
})
test('count full boxes plus loose sums only those two explicit entries into exact base',()=>{
  const m=loadReportModule('../inventory/units/public.ts',{'@/services/api':{}})
  assert.equal(m.countBaseQuantity('2','7','1',0),'15')
  assert.equal(m.countBaseQuantity('0','7','15',0),'15')
  assert.equal(m.countBaseQuantity('2','0.333333333333','0.5',6),null)
  assert.equal(m.countBaseQuantity('2','0.25','0.123456',6),'0.623456')
  assert.throws(()=>m.countBaseQuantity('0.5','7','0',0))
})
test('actual count row saves boxes plus loose once as base and resets composition before re-save',async()=>{
  const h=hookHarness(),nodes=[],writes=[]
  const {LineRow}=loadReportModule('../inventory-count/pages/InventoryCountSessionPage.tsx',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@tanstack/react-query':{useQuery:()=>({data:{items:[{id:'box',name:'Caja 7',factor:'7',active:true}]}})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/services/api':{},'./api':{}},nodes)
  const row={id:'row',product_id:'p',stock_snapshot:'20',qty_counted:null,qty_counted_secondary:null,unit_snapshot:snapshot,product:{name:'Producto',barcode:null},location:{code:'A',warehouse:{name:'Principal'}}}
  const render=()=>{nodes.length=0;h.render(()=>LineRow({row,locked:false,doubleCount:true,fmt:String,onSavePrimary:async n=>writes.push(n),onSaveSecondary:async n=>writes.push(n)}))}
  try{render();nodes.find(n=>n.props['aria-label']==='Presentación para contar Producto').props.onChange({target:{value:'box'}});render();nodes.find(n=>n.props['aria-label']==='Cajas completas de Producto').props.onChange({target:{value:'2'}});nodes.find(n=>n.props['aria-label']==='Cantidad contada de Producto').props.onChange({target:{value:'1'}});render();assert.equal(nodes.find(n=>n.props['aria-label']==='Cantidad contada de Producto').props.onBlur,undefined);await nodes.find(n=>n.props['aria-label']==='Cantidad contada de Producto').props.onKeyDown({key:'Enter'});assert.deepEqual(writes,['15']);render();await nodes.find(n=>n.props['aria-label']==='Cantidad contada de Producto').props.onKeyDown({key:'Enter'});assert.deepEqual(writes,['15','15'])}finally{h.unmount()}
})
test('transfer receipt uses frozen base decimals and rejects quantities above original dispatch',()=>{
  const m=loadReportModule('../transfers/transferViewModel.ts',{'@/services/api':{}})
  const lines=[{id:'L',qty_sent:'1.25',unit_snapshot:{...snapshot,presentation:null,baseUnit:{...snapshot.baseUnit,label:'kg',decimals:6}}}]
  assert.deepEqual(m.transferReceiptLines(lines,{L:'0.123456'}),[{line_id:'L',qty_received:'0.123456'}])
  assert.throws(()=>m.transferReceiptLines(lines,{L:'1.250001'}))
  assert.throws(()=>m.transferReceiptLines([{id:'L',qty_sent:7}],{L:'0.25'}))
})
test('location minimum callback preserves six-place physical base instead of flooring',async()=>{
  const h=hookHarness(),nodes=[],writes=[]
  const row={stock:'1',min_stock:'0',location:{id:'L',code:'A',warehouse:{name:'Principal'},pickable:true}}
  const {ProductLocationsSection}=loadReportModule('../inventory/products/ProductLocationsSection.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/context/useTenant':{useTenant:()=>({branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10})},'@tanstack/react-query':{useQuery:()=>({data:[row]}),useQueryClient:()=>({}),useMutation:o=>({mutate:async p=>{writes.push(p);return o.mutationFn(p)}})},'@/services/stockMoveService':{setLocationMin:async()=>{}},'@/services/api':{},'./api':{}},nodes)
  const render=()=>{nodes.length=0;h.render(()=>ProductLocationsSection({productId:'p',baseDecimals:6,baseLabel:'kg'}))}
  try{render();nodes.find(n=>n.props['aria-label']==='Mínimo interno de A').props.onChange({target:{value:'0.123456'}});render();await nodes.find(n=>n.props.children==='Guardar').props.onClick();assert.equal(writes[0].min_stock,'0.123456')}finally{h.unmount()}
})
test('lot edit sends exact base quantity and compares it to exact already consumed quantity',async()=>{
  const h=hookHarness(),nodes=[],writes=[]
  const lot={id:'lot',lot_code:'L',qty_received:'1.25',qty_remaining:'0.25',expiry_date:null,received_at:'2026-10-18'}
  const {ProductLotsSection}=loadReportModule('../inventory/products/ProductLotsSection.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({timezone:'America/Guatemala'})},'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10})},'@tanstack/react-query':{useQuery:()=>({data:{lots:[lot],reconciliation:{physical:'0.25',lotted:'0.25',unlotted:'0',balanced:true}},refetch:async()=>{}}),useQueryClient:()=>({invalidateQueries(){}})},'@/services/api':{apiFetch:async(path,options)=>writes.push(JSON.parse(options.body))},'./api':{}},nodes)
  const render=()=>{nodes.length=0;h.render(()=>ProductLotsSection({productId:'p',tracksExpiry:false,baseDecimals:6,baseLabel:'kg'}))}
  try{render();nodes.find(n=>n.props['aria-label']==='Editar lote L').props.onClick();render();nodes.find(n=>n.props.id==='lot-qty').props.onChange({target:{value:'1.123456'}});render();await nodes.find(n=>n.props.title==='Corregir lote').props.onSubmit();assert.equal(writes[0].qty_received,'1.123456')}finally{h.unmount()}
})
test('actual transfer PDF prints frozen base quantities and labels without fetching current factors',()=>{
  const {jsPDF}=require('jspdf');let bytes
  const {generateTransferPDF}=loadReportModule('../transfers/documents/generateTransferPDF.ts',{'jspdf':{__esModule:true,default:function(){const doc=new jsPDF();doc.save=()=>{bytes=Buffer.from(doc.output('arraybuffer'))};return doc}},'@/services/api':{apiFetch:()=>assert.fail('historical PDF reloaded catalog')},'./api':{}})
  generateTransferPDF({id:'T',reference:'TR-UNITS-QA',status:'RECIBIDA',sent_at:'2026-10-18T12:00:00Z',fromBranch:{name:'Central'},toBranch:{name:'Bodega'},lines:[{id:'L',product_id:'kg',product:{name:'Producto medido'},qty_sent:'1.123456',qty_received:'0.123456',unit_snapshot:{...snapshot,presentation:null,baseUnit:{...snapshot.baseUnit,label:'kg',decimals:6}}},{id:'U',product_id:'u',product:{name:'Producto por unidad'},qty_sent:7,qty_received:7}]},{companyName:'Auna QA'})
  const parsed=require('node:child_process').spawnSync('pdftotext',['-','-'],{input:bytes});assert.equal(parsed.status,0);const text=parsed.stdout.toString();assert.match(text,/1\.123456 kg/);assert.match(text,/0\.123456 kg/);assert.match(text,/7 unidades/)
  if(process.env.TASK7_ARTIFACT_OUTPUT)require('node:fs').writeFileSync(process.env.TASK7_ARTIFACT_OUTPUT,bytes)
})
test('promotion reference editor separates persisted trigger/gift snapshots from narrow writer IDs',()=>{
  const m=loadReportModule('../promotions/pages/PromotionQuantityReferenceFields.tsx',{'@/services/api':{},'./api':{}})
  const draft=m.promotionReferenceDraft({version:1,trigger:{id:'kg',code:'KG',family:'MASS',factor:'1000'},gift:{id:'g',code:'G',family:'MASS',factor:'1'}})
  assert.deepEqual(draft,{trigger_unit_id:'kg',gift_unit_id:'g'})
  assert.deepEqual(m.promotionReferenceInput(draft),{trigger_unit_id:'kg',gift_unit_id:'g'})
  assert.deepEqual(m.promotionReferenceInput({trigger_unit_id:'kg',gift_unit_id:''}),{trigger_unit_id:'kg'})
  assert.equal(m.promotionReferenceInput({trigger_unit_id:'',gift_unit_id:''}),null)
})
test('promotion quantity rule validation accepts six places and rejects fractional overflow without truncation',()=>{
  const m=loadReportModule('../promotions/pages/promotionTypeConfig.ts',{'@/services/api':{}})
  assert.equal(m.validatePayloadForType('BUY_X_GET_Y',{buy_quantity:'0.123456',get_quantity:'0.25'}).valid,true)
  assert.equal(m.validatePayloadForType('BUY_X_GET_Y',{buy_quantity:'0.1234567',get_quantity:'0.25'}).valid,false)
})
test('real promotion create sends exact trigger/gift quantities and only reference IDs',async()=>{
  const h=hookHarness(),nodes=[],requests=[]
  const Page=loadReportModule('../promotions/pages/PromotionCreatePage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{},useLocation:()=>({pathname:'/promociones/nueva'})},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},branches:[]})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ',inventoryUnitsEnabled:true})},'../coupons/useCouponDesign':{useCouponDesign:()=>({payload:()=>({}),saved(){}})},'./usePromotionDraft':{usePromotionDraft:()=>({clear(){}}),restorableDraft:()=>null},'@tanstack/react-query':{useQuery:()=>({data:[{id:1,name:'BUY_X_GET_Y'}]}),useQueryClient:()=>({invalidateQueries(){}}),useMutation:o=>({mutate:p=>{requests.push(p)}})},'@/services/api':{},'../services/api':{},'./api':{}},nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())}
  try{render();render();for(const [id,value]of [['name','Medida'],['buy_quantity','0.123456'],['get_quantity','0.25']]){nodes.find(n=>n.props.id===id).props.onChange({target:{value}});render()}nodes.find(n=>n.props.id==='applies_to_all').props.onCheckedChange(false);render();nodes.find(n=>n.type?.name==='PromotionApplicableScopeFields').props.onProductsChange([{id:'p',name:'Producto'}]);render();nodes.find(n=>n.type?.name==='PromotionQuantityReferenceFields').props.onChange({trigger_unit_id:'kg',gift_unit_id:'g'});render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(requests[0].buy_quantity,'0.123456');assert.equal(requests[0].get_quantity,'0.25');assert.deepEqual(requests[0].quantity_reference,{trigger_unit_id:'kg',gift_unit_id:'g'})}finally{h.unmount()}
})
test('reference fields show gift own grams and block a volume product before saving a mass rule',()=>{
  const h=hookHarness(),nodes=[],errors=[]
  const units=[{id:'kg',name:'Kilogramo',label:'kg',family:'MASS',active:true},{id:'g',name:'Gramo',label:'g',family:'MASS',active:true}]
  const products=[{id:'p',name:'Aceite',kind:'STANDARD',unitConfiguration:{base_unit:{family:'VOLUME'}}}]
  const {PromotionQuantityReferenceFields}=loadReportModule('../promotions/pages/PromotionQuantityReferenceFields.tsx',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:true})},'@tanstack/react-query':{useQuery:({queryKey})=>({data:queryKey[0].includes('units')?{items:units}:products})},'@/services/api':{},'./api':{}},nodes)
  try{h.render(()=>PromotionQuantityReferenceFields({typeName:'BUY_X_GET_Y',value:{trigger_unit_id:'kg',gift_unit_id:'g'},onChange(){},onError:e=>errors.push(e),productIds:['p'],categoryIds:[],appliesToAll:false,triggerProductId:'',targetProductId:''}));assert.match(errors[0],/Aceite/);assert.ok(nodes.some(n=>n.type==='p'&&JSON.stringify(n.props.children).includes('Regalo en g')))}finally{h.unmount()}
})
test('existing import mapper carries explicit unit/presentation/content and scoped validation into confirmation',async()=>{
  const h=hookHarness(),nodes=[],calls=[],XLSX=require('xlsx'),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{nombre:'Producto',categoria:'General',proveedor:'Proveedor',precio:'1',stock:'2',base_unit_code:'UNIT',presentation_code:'BOX24',presentation_content:'24',quantity_decimals:'0'}]),'Productos');const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'})
  const prior=global.fetch;global.fetch=async(url,options)=>{calls.push({kind:'validate',url,options});return{ok:true,json:async()=>({totals:{valid:1,invalid:0},validRows:[{rowIndex:2,data:{stock:'2'},unitPreview:{baseStock:'48',baseMinimum:'0',unitLabel:'unidades',presentationLabel:'caja',priceCostPolicy:'Precio y costo existentes sin cambios.'}}]})}}
  const Page=loadReportModule('../inventory/pages/ImportPage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B',name:'Central'},registerTenantExitGuard:()=>()=>{}})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@tanstack/react-query':{useQuery:()=>({data:[]})},'@/components/shared/useImportStream':{useImportStream:()=>({start:async(url,body,options)=>{calls.push({kind:'confirm',body,options});return{created:1}},cancel(){}})},'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=> 'token',ApiError:class extends Error{}},'../services/api':{},'./api':{}},nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())},workbench=()=>nodes.find(n=>n.type?.name==='ImportWorkbench').props
  try{render();assert.ok(workbench().fields.some(f=>f.id==='presentation_code'));await workbench().onFile(new File([bytes],'units.xlsx'));render();render();workbench().onValidate();await new Promise(r=>setImmediate(r));render();workbench().onImport();await new Promise(r=>setImmediate(r));assert.equal(calls[0].options.headers['X-Company-Id'],'A');assert.equal(calls[1].options.headers['X-Branch-Id'],'B');assert.equal(calls[1].body.products[0].presentation_code,'BOX24');assert.equal(calls[1].body.products[0].presentation_content,'24')}finally{global.fetch=prior;h.unmount()}
})
