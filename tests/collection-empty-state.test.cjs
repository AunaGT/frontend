const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')

test('illustrated empty state keeps artwork decorative and renders the real next action',()=>{
  const {EmptyState}=loadReportModule('../../components/shared/EmptyState.tsx')
  const html=renderToStaticMarkup(React.createElement(EmptyState,{illustration:true,title:'Luce vacío, ¿no?',description:'Agrega tu primer producto para empezar.',action:React.createElement('a',{href:'/inventario/nuevo'},'Nuevo producto')}))
  assert.match(html,/src="\/illustrations\/empty-states\/workspace-flat.png"/)
  assert.match(html,/alt=""/)
  assert.match(html,/width="180" height="120"/)
  assert.match(html,/href="\/inventario\/nuevo"/)
  assert.match(html,/Luce vacío, ¿no\?/)
})

test('filtered collections never show a creation action and can clear the caller filters',()=>{
  let resets=0;const nodes=[]
  const {CollectionEmptyState}=loadReportModule('../../components/shared/CollectionEmptyState.tsx',{},nodes)
  const html=renderToStaticMarkup(React.createElement(CollectionEmptyState,{title:'Tu próximo contacto empieza aquí',filtered:true,onReset:()=>resets++,action:React.createElement('a',{href:'/contactos/nuevo'},'Nuevo contacto')}))
  assert.match(html,/Busquemos por otro lado/)
  assert.doesNotMatch(html,/Nuevo contacto|\/contactos\/nuevo|Tu próximo contacto empieza aquí/)
  nodes.find(n=>n.props.children==='Limpiar filtros'&&n.props.onClick).props.onClick()
  assert.equal(resets,1)
})

test('read-only and compact collections have no invented action or oversized artwork',()=>{
  const {CollectionEmptyState}=loadReportModule('../../components/shared/CollectionEmptyState.tsx')
  const html=renderToStaticMarkup(React.createElement(CollectionEmptyState,{title:'Cada movimiento deja su huella',description:'Los cambios futuros aparecerán aquí.',compact:true}))
  assert.match(html,/width="96" height="64"/)
  assert.doesNotMatch(html,/<button|<a\s/)
})

test('legacy unavailable/error states retain their icon and do not acquire empty artwork',()=>{
  const {EmptyState}=loadReportModule('../../components/shared/EmptyState.tsx')
  const html=renderToStaticMarkup(React.createElement(EmptyState,{title:'Cotización no disponible',icon:props=>React.createElement('svg',props),action:React.createElement('button',null,'Reintentar')}))
  assert.match(html,/Cotización no disponible/);assert.match(html,/<svg/);assert.match(html,/Reintentar/)
  assert.doesNotMatch(html,/workspace-flat.png/)
})

test('product selector distinguishes a truly empty catalog from a failed request',()=>{
  const boundary=({children})=>React.createElement('div',null,children)
  const popover=Object.fromEntries(['Popover','PopoverContent','PopoverTrigger'].map(k=>[k,boundary]))
  const command=Object.fromEntries(['Command','CommandEmpty','CommandGroup','CommandInput','CommandItem','CommandList'].map(k=>[k,boundary]))
  const render=(isError)=>{
    const {ProductCombobox}=loadReportModule('../../components/shared/ProductCombobox.tsx',{
      '@/components/ui/popover':popover,'@/components/ui/command':command,
      '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},
      '@/services/api':{apiFetch(){throw Error('No network in SSR')}},
      '@/services/productService':{fetchAllProducts(){throw Error('No network in SSR')}},
      '@/utils':{formatMoney:String},
      '@tanstack/react-query':{useQuery:()=>({data:[],isLoading:false,isError,refetch(){}})},
    })
    return renderToStaticMarkup(React.createElement(ProductCombobox,{value:'',onChange(){}}))
  }
  assert.match(render(false),/workspace-flat.png/)
  assert.doesNotMatch(render(true),/workspace-flat.png/)
  assert.match(render(true),/Reintentar/)
})

for(const name of ['ProductPicker','SupplierPicker'])test(name+' illustrates only successful empty searches and resets the live query',()=>{
  const boundary=({children})=>React.createElement('div',null,children)
  const nodes=[],changes=[]
  let status='empty',index=0
  const mocks={
    react:{...React,useState:initial=>{const i=index++;return [i===0?true:i===1||i===2?'zzzz':initial,value=>changes.push([i,value])]}},
    '@/components/ui/popover':Object.fromEntries(['Popover','PopoverContent','PopoverTrigger'].map(k=>[k,boundary])),
    '@/components/ui/command':Object.fromEntries(['Command','CommandEmpty','CommandGroup','CommandInput','CommandItem','CommandList'].map(k=>[k,boundary])),
    '@/components/ui/scroll-area':{ScrollArea:boundary},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:false})},
    '@/services/productService':{fetchProducts(){},adaptApiProduct:v=>v},
    '@/services/api':{apiFetch(){throw Error('No network in picker presentation test')}},
    '@/services/supplierService':{fetchSuppliers(){}},
    '@tanstack/react-query':{useInfiniteQuery:()=>({data:{pages:[{items:[]}]},isFetching:status==='loading',isError:status==='error'})},
  }
  const Component=loadReportModule('../../components/shared/'+name+'.tsx',mocks,nodes)[name]
  const render=()=>{index=0;nodes.length=0;return renderToStaticMarkup(React.createElement(Component,{branchId:'branch',onPick(){},onSelect(){},label:'Proveedor'}))}
  const html=render();assert.match(html,/workspace-flat.png/);assert.match(html,/Busquemos por otro lado/)
  nodes.find(n=>n.props.children==='Limpiar filtros'&&n.props.onClick).props.onClick()
  assert.ok(changes.some(([i,v])=>i===1&&v===''));assert.ok(changes.some(([i,v])=>i===2&&v===''))
  for(const value of ['loading','error']){status=value;assert.doesNotMatch(render(),/workspace-flat.png/)}
})
