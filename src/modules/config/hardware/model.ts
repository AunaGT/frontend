import type { DeviceInput, HardwareKind, HardwareScope, Workstation, WorkstationInput } from './types'
export const kindLabels = { SCANNER: 'Lector de códigos', RECEIPT_PRINTER: 'Impresora de tickets', LABEL_PRINTER: 'Impresora de etiquetas', OFFICE_PRINTER: 'Impresora general', CASH_DRAWER: 'Gaveta de efectivo' } as const
export const roleLabels = { SCANNER: 'Lector', RECEIPT: 'Tickets', LABEL: 'Etiquetas', OFFICE: 'Documentos generales', DRAWER: 'Gaveta' } as const
export const roleKinds = { SCANNER: 'SCANNER', RECEIPT: 'RECEIPT_PRINTER', LABEL: 'LABEL_PRINTER', OFFICE: 'OFFICE_PRINTER', DRAWER: 'CASH_DRAWER' } as const
export const stateLabels = { DRAFT: 'Borrador', ACTIVE: 'Habilitado', DISABLED: 'Deshabilitado' } as const
export const newWorkstation = (): WorkstationInput => ({ code: '', name: '', notes: '', state: 'DRAFT', cashRegisterId: null })
export function newDevice(kind: HardwareKind = 'SCANNER'): DeviceInput {
  return { code: '', name: '', notes: '', kind, state: 'DRAFT', connection: kind === 'SCANNER' ? 'HID' : kind === 'CASH_DRAWER' ? 'PRINTER_PORT' : 'SYSTEM_PRINTER', profile: kind === 'SCANNER' ? { scannerSuffix: 'ENTER', scannerMinLength: 1, scannerMaxLength: 128 } : kind === 'CASH_DRAWER' ? {} : { widthMm: kind === 'RECEIPT_PRINTER' ? 80 : kind === 'LABEL_PRINTER' ? 60 : 210, heightMm: kind === 'RECEIPT_PRINTER' ? 160 : kind === 'LABEL_PRINTER' ? 40 : 297, dpi: 203, orientation: 'portrait', offsetXMm: 0, offsetYMm: 0, copies: 1 } }
}
const key = (scope: HardwareScope) => `hardware:workstation:${JSON.stringify([scope.companyId, scope.branchId, scope.userId])}`
export function rememberWorkstation(scope: HardwareScope, station: Workstation, storage: Pick<Storage, 'setItem'> = localStorage) {
  if (!station.id || station.companyId !== scope.companyId || station.branchId !== scope.branchId || station.state === 'DISABLED') throw new Error('Este puesto no está disponible en el contexto actual')
  storage.setItem(key(scope), station.id)
}
export function rememberedWorkstation(scope: HardwareScope, stations: Workstation[], storage: Pick<Storage, 'getItem' | 'removeItem'> = localStorage) {
  const id = storage.getItem(key(scope))
  if (!id) return null
  if (stations.some(w => w.id === id && w.companyId === scope.companyId && w.branchId === scope.branchId && w.state !== 'DISABLED')) return id
  storage.removeItem(key(scope)); return null
}
export function workstationInput(row: Workstation): WorkstationInput { const { code, name, notes, state, cashRegisterId, version } = row; return { code, name, notes, state, cashRegisterId, expectedVersion: version } }
