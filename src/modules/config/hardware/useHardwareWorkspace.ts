import { useEffect, useRef, useState } from 'react'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useRelatedSettingsEditor, type RelatedEditorProps } from '../useRelatedSettingsEditor'
import { getHardwareWorkspace, saveHardwareWorkstation, saveHardwareDevice, assignHardwareDevices, recordHardwareTest } from './api'
import type { Assignment, DeviceInput, HardwareScope, HardwareTestInput, WorkspaceDto, WorkstationInput } from './types'

export function useHardwareWorkspace(props: RelatedEditorProps) {
  const { hasPermission, permissionsReady } = useAuthPermissions()
  const canRead = permissionsReady && hasPermission('hardware.view'), canManage = hasPermission('hardware.manage'), canTestPrint = hasPermission('hardware.test_print'), canTestDrawer = hasPermission('hardware.test_drawer')
  const permissionsKey = JSON.stringify([canRead, canManage, canTestPrint, canTestDrawer])
  const [dirty, setDirty] = useState(false)
  // This gate serializes any authorized hardware operation; each write below checks its specific permission.
  const gate = useRelatedSettingsEditor(props, dirty, 'hardware.view', permissionsKey)
  const key = gate.key + permissionsKey, scope: HardwareScope = { companyId: gate.companyId, branchId: gate.headers['X-Branch-Id'], userId: gate.userId }
  const live = useRef(key); live.current = key
  const [state, setState] = useState<{ key: string; workspace: WorkspaceDto | null; loading: boolean; error: string; notice: string; fields: Record<string,string> }>({ key, workspace: null, loading: true, error: '', notice: '', fields: {} })
  const visible = state.key === key ? state : { key, workspace: null, loading: true, error: '', notice: '', fields: {} }
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => { setDirty(false) }, [key])
  useEffect(() => {
    if (!canRead || !scope.companyId || !scope.branchId) return
    const ticket = gate.capture(), controller = new AbortController()
    setState({ key, workspace: null, loading: true, error: '', notice: '', fields: {} })
    getHardwareWorkspace(scope, controller.signal).then(workspace => { if (gate.isCurrent(ticket) && live.current === key) setState(old => ({ ...old, key, workspace, loading: false })) }, error => { if (gate.isCurrent(ticket) && live.current === key && !controller.signal.aborted) setState(old => ({ ...old, key, loading: false, error: error.message || 'No se pudo cargar el hardware' })) })
    return () => controller.abort()
  }, [key, reloadKey])
  async function run<T>(permission: boolean, write: () => Promise<T>): Promise<T | null> {
    if (!permission || live.current !== key) return null
    const ticket = gate.begin(); if (!ticket) return null
    setState(old => ({ ...old, error: '', notice: '', fields: {} }))
    let result: T
    try { result = await write() }
    catch (error) { if (gate.isCurrent(ticket) && live.current === key) { const e = error as { message?: string; data?: { fields?: Record<string,string> } }; setState(old => ({ ...old, error: e.message || 'No se pudo guardar', fields: e.data?.fields || {} })) }; gate.end(ticket); return null }
    if (!gate.isCurrent(ticket) || live.current !== key) return null
    setDirty(false)
    try { const workspace = await getHardwareWorkspace(scope); if (gate.isCurrent(ticket) && live.current === key) setState({ key, workspace, loading: false, fields: {}, error: '', notice: 'Cambios guardados.' }) }
    catch { if (gate.isCurrent(ticket) && live.current === key) setState(old => ({ ...old, notice: 'Cambios guardados; no se pudo actualizar la lista. Recarga antes de editar otra vez.', workspace: null, loading: false })) }
    gate.end(ticket)
    return live.current === key && gate.isCurrent(ticket) ? result : null
  }
  return { ...visible, ...scope, canRead, canManage, canTestPrint, canTestDrawer, pending: gate.pending, disabled: gate.disabled,
    setDirty, reload: () => { if (!gate.pending) setReloadKey(n => n + 1) },
    saveWorkstation: (id: string | null, input: WorkstationInput) => run(canManage, () => saveHardwareWorkstation(scope, id, input)),
    saveDevice: (id: string | null, input: DeviceInput) => run(canManage, () => saveHardwareDevice(scope, id, input)),
    assignDevices: (id: string, version: number, assignments: Assignment[]) => run(canManage, () => assignHardwareDevices(scope, id, version, assignments)),
    recordTest: (input: HardwareTestInput) => run(input.kind === 'DRAWER_SIMULATION' ? canTestDrawer : canTestPrint, () => recordHardwareTest(scope, input)),
  }
}
export type HardwareWorkspace = ReturnType<typeof useHardwareWorkspace>
