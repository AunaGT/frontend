const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../../src')
const target = path.join(root, 'modules/sales/NewSalePage.tsx')
const product = { id: 'p-1', name: 'Producto QA', category: 'Bebidas', brand: 'QA', barcode: '740001', imageUrl: '/qa.png', stock: 20, price: 5, minStock: 0 }

function render({ categories = [], refs = {}, cartOverrides = {}, methods = [{ id: 1, name: 'Efectivo', is_credit: false }, { id: 2, name: 'Crédito', is_credit: true }], state = {}, productsError = false, permissions = ['sales.create'], items = [{ ...product, qty: '2' }], products = [product],pricingReady=true,realCart,unitPreview,unitBatchPreview,checkoutOverrides={},downloadTicket=async()=>{},warehouses=[],posAvailability,stockLocations=async()=>[],inventoryUnitsEnabled=false,scanProduct=async()=>{throw Error('Unexpected scan')},catalog,loadOrder,enabledModules=[],resolveCode } = {}) {
  const tree = ts.createSourceFile(target, fs.readFileSync(target, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const page = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'NewSalePage')
  const names = page.body.statements.flatMap(node => ts.isVariableStatement(node) ? node.declarationList.declarations.filter(d => ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'useState').map(d => d.name.elements[0].name?.text??d.name.elements[1].name.text) : [])
  const refNames=page.body.statements.flatMap(node=>ts.isVariableStatement(node)?node.declarationList.declarations.filter(d=>ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(tree)==='useRef').map(d=>d.name.text):[])
  const values = { productLayout: 'flat', selectedRegisterId: 'register', cashCheckDone: true, cashSessionOpen: true, cashRegisterMeta: { id: 'register', name: 'Caja QA' }, saleStep: 'payment', paymentMethod: { id: 1, name: 'Efectivo', is_credit: false }, amountReceived: '20', ...state }
  const stateUpdates = {}, effects = [], pageRefs = {}
  const removals = []
  const nodes = [], notifications = [], writes = [], quantities = [], promotionRequests = [], cartOptions = [], queryKeys=[],invalidations=[],catalogRequests=[],priceRequests=[],cache = new Map()
  let index = 0,refIndex=0
  const pricingContext=JSON.stringify([products.map(p=>p.unitConfiguration?[p.id,p.unitValues,p.unitConfiguration]:[p.id,p.price,p.priceWholesale,p.pricePromotion,p.promotionValidUntil]),values.salesChannel || 'POS',values.pickedCustomerId==='__none__'?undefined:values.pickedCustomerId])
  const cart = { cartItems: items, hasInvalidQuantities:false,lineTotals:Object.fromEntries(items.map(item=>[item.id,(Number(item.qty)*item.price).toFixed(2)])),cartTotal: items.reduce((sum, item) => sum + Number(item.qty) * item.price, 0), adminAuthorizedProducts: new Set(), repriceCartLines() {}, clearCart() {}, updateQuantity: (...args) => quantities.push(args), removeFromCart: key=>removals.push(key), hydrateFromLines() {}, availabilityDialog: { open: false }, adminAuthDialog: { open: false } }
  cart.getGeneration=()=>0
  const overrides = {
    '@/context/useTenant': {useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},
    '@/hooks/use-toast': { useToast: () => ({ toast: value => notifications.push(value) }) },
    '@tanstack/react-query': { useQuery: options => {queryKeys.push(options.queryKey);return{ data: options.queryKey[0] === 'credit-check' ? { ok: true } : options.queryKey[0]==='warehouses'?warehouses:[], isSuccess: true }}, useQueryClient: () => ({ invalidateQueries: async options => {invalidations.push(options)}, fetchQuery: async options => options.queryFn?.()??[] }) },
    './hooks/usePosAvailability':{usePosAvailability:()=>posAvailability??{availability:{},ensureCurrent:async()=>({availability:{},salesLocation:{configured:true,id:'L'}}),invalidate:async()=>{}}},
    './hooks/usePosCatalog':{usePosCatalog:(_scope,filters)=>{
      catalogRequests.push(filters)
      if(catalog)return catalog
      const filtered=products.filter(p=>!filters.search||p.name.toLowerCase().includes(filters.search.toLowerCase())||(p.barcode??'').includes(filters.search)).filter(p=>!filters.category||filters.search||p.category===filters.category),counts=new Map()
      for(const p of products)counts.set(p.category??'Sin categoría',(counts.get(p.category??'Sin categoría')??0)+1)
      const totalPages=Math.max(1,Math.ceil(filtered.length/filters.pageSize)),page=Math.min(filters.page,totalPages)
      return{data:{items:filtered.slice((page-1)*filters.pageSize,page*filters.pageSize),page,pageSize:filters.pageSize,totalItems:filtered.length,totalPages},retainedProducts:products,isLoading:false,isFetching:false,isSuccess:!productsError,isError:productsError,refetch(){},categories:{data:{items:[...counts].map(([name,count])=>({name,count,image_url:categories.find(c=>c.name===name)?.image_url??null}))},isError:false,isFetching:false,refetch(){}},ensureProducts:async ids=>({items:products.filter(p=>ids.includes(p.id)),missingIds:ids.filter(id=>!products.some(p=>p.id===id))})}
    },preparePosPrices:async(scope,ids)=>{priceRequests.push(ids);return{unit_prices:Object.fromEntries(ids.map(id=>[id,5])),price_tier_used:'LIST'}}},
    '@/services/stockMoveService':{fetchStockByLocation:stockLocations},
    '@/hooks/useProducts': { PRODUCTS_QUERY_KEY: ['products'], useAllProducts: () => ({ data: products, isLoading: false, isFetching: false, isSuccess: !productsError, isError: productsError, refetch() {} }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: categories }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: methods }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(code => permissions.includes(code)) }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', timezone: 'America/Guatemala', currencyCode: 'GTQ', companyName: 'QA', vatRegime: 'general', ivaRate: 12, salesAllowCredit: true, salesShowFiscalFields: true, salesShowChannels: true,inventoryUnitsEnabled }) },
    '@/services/scannerService':{lookupScannedUnitProduct:scanProduct},
    '@/components/shared/ScannerField':{ScannerField:()=>null},
    '@/services/contextScannerService':{resolveContextScan:scanProduct},
    '@/hooks/useExperienceProfile': { useExperienceProfile: () => ({ profile: 'standard', isCompact: false, showAdvancedByDefault: false }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'user', role: { name: 'admin' } } }) },
    '@/context/useModules': { useModules: () => ({ isEnabled: code => enabledModules.includes(code) }) },
    '@/hooks/usePromotions': { usePromotions: options => { promotionRequests.push(options); return { appliedPromotions: [], promotionCodes: [], clearPromotions() {} } } },
    './hooks': { useCart: options => {cartOptions.push(options);return realCart??{...cart,...cartOverrides}}, useSalesData: () => load(path.join(root,'modules/sales/hooks/useSalesData.ts')).useSalesData() },
    './components': { AvailabilityDialog: () => null, AdminAuthDialog: () => null, PromotionCodeInput: () => null, SavedCustomerMany2One: () => null },
    '@/modules/receivables': { checkCustomerCredit() { throw Error('Unexpected request') } },
    '@/modules/cash-closure': { CASH_SESSION_CURRENT_QUERY_KEY: ['cash-current'] },
    '@/services/api': { apiFetch() { throw Error('Unexpected request') }, getApiBaseUrl: () => '' },
    '@/services/saleService': { createSale: async payload => { writes.push(payload); return { id: 'sale' } } },
    './checkout/useCheckoutFlow': {useCheckoutFlow:(scope,allowed,onConfirmed)=>({pending:false,attempt:null,error:null,isCurrent:()=>true,reconcile:async()=>{},submit:async(kind,payload)=>{writes.push(payload);onConfirmed({saleId:'sale',kind},true)},...checkoutOverrides})},
    './documents/saleTicketRecovery':{downloadSavedSaleTicket:downloadTicket},
    '@/services/settingsService': { getCompanyNamePublic: async () => ({ company_name: 'QA' }) },
    '@/utils/pdfBranding': { resolvePdfLogoDataUrl: async () => null },
    './documents/generateSaleTicket': { generateSaleTicket() {} },
    './CashRegisterPicker': { CashRegisterPicker: () => React.createElement('p', null, 'Seleccionar caja') },
    './OpenCashRegisterPrompt': { OpenCashRegisterPrompt: () => React.createElement('p', null, 'Abrir caja') },
  }
  if(loadOrder)overrides['@/services/orderService']={...load(path.join(root,'services/orderService.ts')),fetchOrderById:loadOrder}
  if(resolveCode)overrides['@/services/productService']={...load(path.join(root,'services/productService.ts')),resolvePosCatalogCode:resolveCode}
  if(unitPreview||unitBatchPreview)overrides['@/modules/inventory/units/public']={...require('./loadReportModule.cjs').loadReportModule('../inventory/units/public.ts',{'@/services/api':{}}),previewUnitLine:unitPreview,previewUnitLines:unitBatchPreview??(async(scope,lines,signal)=>({items:await Promise.all(lines.map(async({client_line_key,product_id,...input})=>({client_line_key,preview:await unitPreview(scope,product_id,input,signal)})))}))}
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = name => {
      if (name.endsWith('.css')) return {}
      if (name === 'react' && file === target) return { ...React, useState: initial => { const name = names[index++]; const [value,setValue]=React.useState(name in values ? values[name] : initial);return [value,next=>{stateUpdates[name]=typeof next==='function'?next(value):next;setValue(next)}] },useEffect:(run,deps)=>effects.push({run,deps}),useRef:initial=>{const name=refNames[refIndex++];return pageRefs[name]=React.useRef(name in refs?refs[name]:name==='pricingReadyRef'&&pricingReady?pricingContext:initial)} }
      if (name === 'react/jsx-runtime' && file === target) return { ...runtime, jsx: (type, props, key) => { nodes.push({ type, props }); return runtime.jsx(type, props, key) }, jsxs: (type, props, key) => { nodes.push({ type, props }); return runtime.jsxs(type, props, key) } }
      if (name in overrides) return overrides[name]
      const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      if (!local) return native(name)
      const alias = '@/' + path.relative(root, local)
      if (alias in overrides) return overrides[alias]
      return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  const Page = load(target).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page))), nodes, notifications, writes, quantities, promotionRequests,cartOptions,stateUpdates,effects,removals,pageRefs,queryKeys,invalidations,catalogRequests,priceRequests }
}


module.exports={renderPos:render,product}
