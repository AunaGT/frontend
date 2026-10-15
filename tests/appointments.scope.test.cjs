const test = require('node:test'), assert = require('node:assert/strict')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('Agenda queda disponible sin catálogo ni contactos y sin conceder permisos',()=>{
  const {useAgendaContext}=loadReportModule('../appointments/useAgendaContext.ts',{
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},isConsolidated:false})},
    '@/context/useModules':{useModules:()=>({isLoading:false,isError:false,isEnabled:code=>code==='appointments'||code==='branches'})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({permissionsReady:true,hasPermission:code=>code==='appointments.view'})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:false,timezone:'America/Guatemala'})},
  })
  const ctx=useAgendaContext()
  assert.equal(ctx.ready,true); assert.equal(ctx.writable,true)
  assert.equal(ctx.canUseCatalog,false); assert.equal(ctx.canUseContacts,false)
})
test('mutación doble envía una vez, conserva clave al reintentar y descarta tenant tardío', async () => {
  const h = hookHarness(), writes = []; let finish
  const hooks = loadReportModule('../appointments/hooks.ts', { react: h.hooks,
    './api': { appointmentQueryKey: (s, k, p) => ['appointments', s.companyId, s.branchId, k, p], mutateAgenda: async (path, scope, body) => { writes.push(body); return new Promise(resolve => { finish = resolve }) } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }), useQuery() {} },
  })
  const A = { companyId: 'A', branchId: '1' }, B = { companyId: 'B', branchId: '2' }, body = { idempotencyKey: 'same-attempt', notes: 'Conservar' }
  let state = h.render(() => hooks.useAgendaMutation(A))
  const first = state.submit('/bookings', body)
  await state.submit('/bookings', body)
  assert.equal(writes.length, 1)
  state = h.render(() => hooks.useAgendaMutation(B)); finish({ id: 'old' })
  assert.equal(await first, null)
  assert.equal(h.render(() => hooks.useAgendaMutation(B)).error, null)
})
