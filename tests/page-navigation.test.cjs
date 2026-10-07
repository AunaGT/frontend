const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../src')
const overrides = new Map(), cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  const nativeRequire = mod.require.bind(mod)
  mod.require = name => {
    if (overrides.has(name)) return overrides.get(name)
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return nativeRequire(name)
    const resolved = ['', '.tsx', '.ts', '.mjs', '.js', '/index.tsx', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    return load(resolved)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {fileName:file, compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText, file)
  return mod.exports
}
test('deep routes distinguish static pages, aliases, nested modules and editing without displaying ids', () => {
  const file = path.join(root, 'components/layout/pageTrail.ts')
  assert.ok(fs.existsSync(file), 'The private navbar needs the shared route trail resolver')
  const { getRouteTrail, selectPageTrail } = load(file)
  const users = {code:'users',label:'Usuarios',path:'/usuarios'}
  const inventory = {code:'inventory',label:'Inventario',path:'/inventario'}
  const cases = [
    ['/usuarios/roles-permisos/nuevo','',users,['Usuarios','Roles y permisos','Nuevo rol']],
    ['/usuarios/roles-permisos/61','',users,['Usuarios','Roles y permisos','Detalle']],
    ['/usuarios/u1','?edit=1',users,['Usuarios','Detalle','Editar']],
    ['/inventario/lotes','',inventory,['Inventario','Lotes y caducidades']],
    ['/inventario/nuevo','',inventory,['Inventario','Nuevo producto']],
    ['/productos/p1','',inventory,['Inventario','Detalle']],
    ['/returns/new','',{code:'returns',label:'Devoluciones',path:'/devoluciones'},['Devoluciones','Nueva devolución']],
    ['/inventario/registrar-ingreso','',{code:'merchandise',label:'Mercancía',path:'/mercancia'},['Mercancía','Registrar ingreso']],
    ['/inventario/inventariado/nuevo','',{code:'inventory-count',label:'Inventariado',path:'/inventario/inventariado'},['Inventariado','Nueva sesión']],
    ['/rrhh/empleados/e1','?editar=1',{code:'hr',label:'RRHH',path:'/rrhh'},['RRHH','Empleados','Detalle','Editar']],
    ['/promociones/p1/editar','',{code:'promotions',label:'Promociones',path:'/promociones'},['Promociones','Detalle','Editar']],
    ['/proveedores/importar','',{code:'contacts',label:'Contactos',path:'/contactos'},['Contactos','Importar']],
    ['/catalogos','',{code:'catalogs',label:'Datos maestros',path:'/datos-maestros'},['Datos maestros']],
    ['/dashboard','',{code:'analytics',label:'Análisis',path:'/analisis'},['Análisis']],
    ['/mi-perfil','',undefined,['Mi perfil']], ['/','',undefined,[]], ['/desconocida','',undefined,[]],
  ]
  for (const [url, search, owner, expected] of cases) assert.deepEqual(getRouteTrail(url,search,owner).map(item=>item.label), expected, url)
  const fallback = [{label:'Ventas'}]
  assert.deepEqual(selectPageTrail('/ventas', fallback, {owner:'old',routeKey:'/usuarios/u1',items:[{label:'Editar'}]}), fallback)
  assert.deepEqual(selectPageTrail('/ventas', fallback, {owner:'current',routeKey:'/ventas',items:[{label:'Ventas'},{label:'Completadas'}]}).map(x=>x.label), ['Ventas','Completadas'])
})
test('breadcrumbs provide explicit ancestor links and only mark the final location current', () => {
  const file = path.join(root, 'components/layout/PageNavigation.tsx')
  assert.ok(fs.existsSync(file), 'The private navbar needs accessible breadcrumbs')
  const { PageBreadcrumbs } = load(file)
  const html = renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(PageBreadcrumbs,{items:[{label:'Usuarios',to:'/usuarios'},{label:'Detalle',to:'/usuarios/u1'},{label:'Editar'}]})))
  assert.match(html,/aria-label="Navegación de la vista"/)
  assert.match(html,/href="\/usuarios"/)
  assert.match(html,/href="\/usuarios\/u1"/)
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1)
  assert.match(html,/aria-hidden="true"/)
})
test('local trail publishes after render and obsolete cleanup cannot clear a newer page', () => {
  const file = path.join(root, 'components/layout/PageNavigation.tsx')
  assert.ok(fs.existsSync(file), 'Local editing must be able to publish a page trail')
  let state=null, effect, id='A', route={pathname:'/usuarios/u1',search:''}, updates=0
  const setOverride = value => {updates++;state=typeof value==='function'?value(state):value}
  overrides.set('react',{...React,useContext:()=>({setOverride,routeKey:route.pathname+route.search}),useId:()=>id,useEffect:callback=>{effect=callback}})
  overrides.set('react-router-dom',{...require('react-router-dom'),useLocation:()=>route})
  cache.delete(file)
  try {
    const {usePageTrail}=load(file)
    usePageTrail([{label:'Detalle'},{label:'Editar'}]);assert.equal(updates,0)
    const cleanupA=effect();assert.equal(state.items.at(-1).label,'Editar')
    id='B';route={pathname:'/ventas',search:''};usePageTrail([{label:'Ventas'}]);const cleanupB=effect()
    cleanupA();assert.equal(state.items.at(-1).label,'Ventas')
    cleanupB();assert.equal(state,null)
  } finally {overrides.clear();cache.clear()}
})
test('navbar keeps the current route readable without adding an unauthorized ancestor link', () => {
  let allowed = false
  overrides.set('@/config/appModules', {getUserRole:()=>({user:null}),findModuleForPath:()=>({id:'users',label:'Usuarios',path:'/usuarios'})})
  overrides.set('@/context/useAuth', {useAuth:()=>({user:{name:'Prueba',email:'test@example.test'},logout(){}})})
  overrides.set('@/hooks/useAuthPermissions', {useAuthPermissions:()=>({hasPermission:code=>allowed && code==='users.view'})})
  overrides.set('@/hooks/useSystemSettings', {useSystemSettings:()=>({companyName:'Auna',companyLogoUrl:null})})
  overrides.set('@/hooks/useActiveAlertsCount', {useActiveAlertsCount:()=>({data:0})})
  overrides.set('@/modules/receivables', {useOverdueReceivablesCount:()=>({data:{count:0}})})
  overrides.set('next-themes', {useTheme:()=>({resolvedTheme:'dark',setTheme(){}})})
  overrides.set('./AppLauncher', {AppLauncher:()=>null})
  overrides.set('./TenantSwitcher', {TenantSwitcher:()=>null})
  cache.clear()
  try {
    const {TopBar}=load(path.join(root,'components/layout/TopBar.tsx'))
    const render=()=>renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/usuarios/u1?edit=1']},React.createElement(TopBar)))
    const denied=render()
    assert.match(denied,/aria-current="page">Editar/)
    assert.doesNotMatch(denied,/href="\/usuarios"/)
    allowed=true;assert.match(render(),/href="\/usuarios"/)
  } finally {overrides.clear();cache.clear()}
})
