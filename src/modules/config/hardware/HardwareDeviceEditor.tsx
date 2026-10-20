import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HardwareField, HardwareInput, HardwareState } from './HardwareFields'
import { kindLabels, newDevice } from './model'
import type { Device, DeviceInput, HardwareKind, HardwareProfile } from './types'
export function HardwareDeviceEditor({ device, devices, disabled, fields, onSave, onDirty, onBack }: { device?: Device; devices: Device[]; disabled: boolean; fields: Record<string,string>; onSave: (value: DeviceInput) => Promise<unknown>; onDirty: (value: boolean) => void; onBack: () => void }) {
  const initial: DeviceInput = device ? { code: device.code, name: device.name, notes: device.notes, state: device.state, kind: device.kind, connection: device.connection, profile: device.profile, expectedVersion: device.version } : newDevice()
  const [value, setValue] = useState(initial), dirty = JSON.stringify(value) !== JSON.stringify(initial)
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  const profile = <K extends keyof HardwareProfile>(key: K, v: HardwareProfile[K]) => setValue(old => ({ ...old, profile: { ...old.profile, [key]: v } }))
  const change = <K extends keyof DeviceInput>(key: K, v: DeviceInput[K]) => setValue(old => ({ ...old, [key]: v }))
  const numeric = (key: keyof HardwareProfile, label: string, min: number, max: number, step = 1) => <HardwareField key={key} id={`hardware-profile.${key}`} label={label} error={fields[`profile.${key}`]}><Input id={`hardware-profile.${key}`} type="number" step={step} min={min} max={max} required value={String(value.profile[key] ?? '')} disabled={disabled} onChange={e => profile(key, e.target.value === '' ? undefined : Number(e.target.value))} /></HardwareField>
  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); void onSave(value) }}>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={onBack}>Volver a equipos</Button><span className="text-xs text-muted-foreground">Configuración declarada · pendiente de prueba física</span></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <HardwareInput id="hardware-name" label="Nombre del equipo" value={value.name} onChange={v => change('name', v)} disabled={disabled} error={fields.name} />
      <HardwareInput id="hardware-code" label="Código interno" value={value.code} onChange={v => change('code', v)} disabled={disabled} error={fields.code} maxLength={40} />
      <HardwareField id="hardware-kind" label="Tipo de equipo" hint="El registro no detecta ni conecta el aparato."><select id="hardware-kind" className="auna-control auna-control-select w-full" disabled={disabled} value={value.kind} onChange={e => { const next = newDevice(e.target.value as HardwareKind); setValue(old => ({ ...old, kind: next.kind, connection: next.connection, profile: next.profile })) }}>{Object.entries(kindLabels).map(([kind,label]) => <option key={kind} value={kind}>{label}</option>)}</select></HardwareField>
      <HardwareState value={value.state} onChange={v => change('state', v)} disabled={disabled} />
    </div>
    <section className="space-y-4 border-t border-border pt-5" aria-label="Perfil del equipo">
      <p className="text-sm text-muted-foreground">{value.kind === 'SCANNER' ? 'Modo teclado (HID): el lector escribe donde esté el cursor. No permite verificar conexión, marca ni modelo.' : value.kind === 'CASH_DRAWER' ? 'Ruta declarada a través de una impresora de tickets. Este bloque no envía pulsos ni valida compatibilidad eléctrica.' : 'PDF y selección manual desde el sistema. Estas medidas no configuran el driver ni confirman impresión física.'}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {value.kind === 'SCANNER' ? <><HardwareField id="hardware-suffix" label="Al terminar de leer"><select id="hardware-suffix" className="auna-control auna-control-select w-full" value={value.profile.scannerSuffix} disabled={disabled} onChange={e => profile('scannerSuffix', e.target.value as HardwareProfile['scannerSuffix'])}><option value="ENTER">Enter</option><option value="TAB">Tab</option><option value="NONE">Sin sufijo (confirmación manual)</option></select></HardwareField>{numeric('scannerMinLength','Longitud mínima',1,128)}{numeric('scannerMaxLength','Longitud máxima',1,128)}</> : value.kind === 'CASH_DRAWER' ? <HardwareField id="hardware-profile.parentPrinterId" label="Impresora de tickets de la gaveta" error={fields['profile.parentPrinterId']}><select id="hardware-profile.parentPrinterId" required className="auna-control auna-control-select w-full" disabled={disabled} value={value.profile.parentPrinterId || ''} onChange={e => profile('parentPrinterId', e.target.value)}><option value="">Selecciona una impresora</option>{devices.filter(d => d.id !== device?.id && d.kind === 'RECEIPT_PRINTER' && d.state !== 'DISABLED').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></HardwareField> : <>
          {numeric('widthMm','Ancho del papel (mm)',10,420,.1)}{numeric('heightMm','Alto del papel (mm)',10,420,.1)}{numeric('dpi','Resolución declarada (DPI)',100,1200)}
          <HardwareField id="hardware-orientation" label="Orientación"><select id="hardware-orientation" className="auna-control auna-control-select w-full" value={value.profile.orientation} disabled={disabled} onChange={e => profile('orientation', e.target.value as HardwareProfile['orientation'])}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></HardwareField>
          {numeric('offsetXMm','Corrección horizontal (mm)',-20,20,.1)}{numeric('offsetYMm','Corrección vertical (mm)',-20,20,.1)}{numeric('copies','Copias de prueba',1,100)}
        </>}
      </div>
    </section>
    <HardwareField id="hardware-notes" label="Modelo, driver o notas (opcional)"><Input id="hardware-notes" maxLength={500} value={value.notes} disabled={disabled} onChange={e => change('notes', e.target.value)} /></HardwareField>
    <div className="config-section-actions"><p className="text-xs text-muted-foreground">No se instalará ningún conector ni se enviarán comandos.</p><Button type="submit" disabled={disabled || !dirty}>Guardar equipo</Button></div>
  </form>
}
