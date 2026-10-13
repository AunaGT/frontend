const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

test('settings refresh fails closed and discards out-of-order service capability responses', async () => {
  let state
  const generation = { current: 0 }
  const requests = []
  const { SystemSettingsProvider } = loadReportModule('../../context/SystemSettingsContext.tsx', {
    react: { ...React, useState(initial) { state ??= initial; return [state, next => { state = typeof next === 'function' ? next(state) : next }] },
      useCallback: fn => fn, useEffect() {}, useRef: () => generation },
    '@/services/settingsService': { getPublicSettings: () => new Promise(resolve => requests.push(resolve)) },
  })
  const render = () => SystemSettingsProvider({ children: null }).props.value
  assert.equal(render().inventoryServicesEnabled, false)
  render().refetch()
  render().refetch()
  assert.equal(render().inventoryServicesEnabled, false)
  requests[1]({ inventory_services_enabled: 'false' })
  await new Promise(resolve => setImmediate(resolve))
  requests[0]({ inventory_services_enabled: 'true' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(render().inventoryServicesEnabled, false)
  render().refetch()
  requests[2]({ inventory_services_enabled: 'true' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(render().inventoryServicesEnabled, true)
  render().refetch()
  assert.equal(render().inventoryServicesEnabled, false)
})
test('public settings hook exposes the service capability and defaults to false without its provider',()=>{
  let context={inventoryServicesEnabled:true}
  const {useSystemSettings}=loadReportModule('../../hooks/useSystemSettings.ts',{
    react:{...React,useContext:()=>context},
    '@/context/SystemSettingsContext':{SystemSettingsContext:{}},
  })
  assert.equal(useSystemSettings().inventoryServicesEnabled,true)
  context=undefined
  assert.equal(useSystemSettings().inventoryServicesEnabled,false)
})
