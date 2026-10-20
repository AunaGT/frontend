import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HardwareField, HardwareInput, HardwareState } from './HardwareFields'
import { newWorkstation, roleKinds, roleLabels, workstationInput } from './model'
import type { Assignment, HardwareRole, WorkspaceDto, Workstation, WorkstationInput } from './types'
export function HardwareWorkstationEditor({ station, workspace, disabled, fields, onSave, onAssign, onDirty, onBack, onRemember }: {
  station?: Workstation; workspace: WorkspaceDto; disabled: boolean; fields: Record<string,string>; onSave: (value: WorkstationInput) => Promise<unknown>; onAssign: (items: Assignment[]) => Promise<unknown>; onDirty: (value: boolean) => void; onBack: () => void; onRemember?: () => void
}) {
  const initial = station ? workstationInput(station) : newWorkstation()
  const [value, setValue] = useState(initial), [assignments, setAssignments] = useState<Assignment[]>(workspace.assignments.filter(a => a.workstationId === station?.id).map(({ role, deviceId }) => ({ role, deviceId })))
  const baseAssignments = workspace.assignments.filter(a => a.workstationId === station?.id).map(({ role, deviceId }) => ({ role, deviceId }))
  const dataDirty = JSON.stringify(value) !== JSON.stringify(initial), assignmentsDirty = JSON.stringify(assignments) !== JSON.stringify(baseAssignments)
  const metadataDisabled = disabled || assignmentsDirty
  useEffect(() => { onDirty(dataDirty || assignmentsDirty) }, [dataDirty, assignmentsDirty, onDirty])
  const change = <K extends keyof WorkstationInput>(key: K, next: WorkstationInput[K]) => setValue(old => ({ ...old, [key]: next }))
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={onBack}>Volver a puestos</Button><span className="text-xs text-muted-foreground">{station ? 'Puesto registrado' : 'Nuevo puesto'} · pendiente de prueba física</span></div>
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); void onSave(value) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <HardwareInput id="hardware-name" label="Nombre del puesto" value={value.name} onChange={v => change('name', v)} disabled={metadataDisabled} error={fields.name} />
        <HardwareInput id="hardware-code" label="Código interno" value={value.code} onChange={v => change('code', v)} disabled={metadataDisabled} maxLength={40} error={fields.code} />
        <HardwareField id="hardware-cashRegisterId" label="Caja de Auna" error={fields.cashRegisterId} hint="Opcional para oficina o impresión de etiquetas."><select id="hardware-cashRegisterId" className="auna-control auna-control-select w-full" value={value.cashRegisterId || ''} disabled={metadataDisabled} onChange={e => change('cashRegisterId', e.target.value || null)}><option value="">Sin caja</option>{workspace.registers.map(r => <option key={r.id} value={r.id} disabled={!r.active}>{r.name}{!r.active ? ' · deshabilitada' : ''}</option>)}</select></HardwareField>
        <HardwareState value={value.state} onChange={v => change('state', v)} disabled={metadataDisabled} />
        <HardwareField id="hardware-notes" label="Notas (opcional)"><Input id="hardware-notes" value={value.notes} maxLength={500} disabled={metadataDisabled} onChange={e => change('notes', e.target.value)} /></HardwareField>
      </div>
      <div className="config-section-actions"><p className="text-xs text-muted-foreground">Una caja solo puede tener un puesto principal habilitado.</p><Button type="submit" disabled={disabled || !dataDirty || assignmentsDirty}>Guardar puesto</Button></div>
    </form>
    <section className="space-y-4 border-t border-border pt-5" aria-labelledby="hardware-assignments-title"><h3 id="hardware-assignments-title" className="font-semibold">Equipos de este puesto</h3>
      {!station ? <p className="text-sm text-muted-foreground">Guarda el puesto para asignarle equipos y preparar sus pruebas.</p> : <>
        <p className="text-sm text-muted-foreground">Primero guarda los datos del puesto; después guarda las asignaciones. No cambies equipos durante un turno abierto.</p>
        <div className="grid gap-4 sm:grid-cols-2">{(Object.keys(roleLabels) as HardwareRole[]).map(role => <HardwareField key={role} id={`hardware-role-${role}`} label={roleLabels[role]}><select id={`hardware-role-${role}`} className="auna-control auna-control-select w-full" value={assignments.find(a => a.role === role)?.deviceId || ''} disabled={disabled || dataDirty} onChange={e => setAssignments(old => [...old.filter(a => a.role !== role), ...(e.target.value ? [{ role, deviceId: e.target.value }] : [])].sort((a,b) => a.role.localeCompare(b.role)))}><option value="">Sin asignar</option>{workspace.devices.filter(d => d.kind === roleKinds[role]).map(d => <option key={d.id} value={d.id} disabled={d.state === 'DISABLED'}>{d.name}{d.state !== 'ACTIVE' ? ' · borrador' : ''}</option>)}</select></HardwareField>)}</div>
        <div className="flex flex-wrap gap-3"><Button disabled={disabled || dataDirty || !assignmentsDirty} onClick={() => void onAssign(assignments)}>Guardar asignaciones</Button>{assignmentsDirty&&<Button variant="outline" disabled={disabled} onClick={()=>setAssignments(baseAssignments)}>Restablecer asignaciones</Button>}{onRemember && <Button variant="outline" disabled={disabled || dataDirty || assignmentsDirty || station.state === 'DISABLED'} onClick={onRemember}>Recordar este puesto en este navegador</Button>}</div>
      </>}
    </section>
  </div>
}
