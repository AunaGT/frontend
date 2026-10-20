import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Pagination } from '@/components/shared/Pagination'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import type { RelatedEditorProps } from '../useRelatedSettingsEditor'
import { useHardwareWorkspace } from './useHardwareWorkspace'
import { HardwareWorkstationEditor } from './HardwareWorkstationEditor'
import { HardwareDeviceEditor } from './HardwareDeviceEditor'
import { HardwareErrors } from './HardwareFields'
import { HardwareDiagnostics } from './HardwareDiagnostics'
import { HardwareHistory } from './HardwareHistory'
import { PrintHistory } from './printing/PrintHistory'
import { DrawerPolicy } from './drawer/DrawerPolicy'
import { kindLabels, rememberWorkstation, stateLabels } from './model'

export function HardwareSettingsSection(props: RelatedEditorProps) {
  const h = useHardwareWorkspace(props), [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [localNotice, setLocalNotice] = useState(''), dirty = useRef(false)
  const tab = params.get('panel') === 'gaveta' ? 'policy' : params.get('panel') === 'impresiones' ? 'prints' : params.get('panel') === 'pruebas' ? 'tests' : params.get('panel') === 'historial' ? 'history' : params.get('equipos') === 'si' ? 'devices' : 'stations', stationId = params.get('puesto'), deviceId = params.get('equipo')
  const editor = params.get('vista') === 'editar' && (stationId || deviceId)
  const goto = (patch: Record<string,string | null>) => {
    if (h.pending || (dirty.current && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?'))) return
    dirty.current = false; h.setDirty(false); setLocalNotice(''); setPage(1)
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) value === null ? next.delete(key) : next.set(key, value)
    setParams(next)
  }
  const back = () => goto({ puesto: null, equipo: null, vista: null })
  const changed = (value: boolean) => { dirty.current = value; h.setDirty(value) }
  if (!h.canRead) return <p className="text-sm text-muted-foreground">Necesitas permiso para consultar puestos y equipos.</p>
  if (h.loading) return <LoadingState message="Cargando puestos y equipos…" />
  if (!h.workspace) return <div className="space-y-3"><HardwareErrors fields={h.fields} error={h.error} />{h.notice && <p role="status">{h.notice}</p>}<Button variant="outline" onClick={h.reload}>Reintentar</Button></div>
  const { workstations, devices, registers } = h.workspace
  const station = workstations.find(w => w.id === stationId), device = devices.find(d => d.id === deviceId)
  const disabled = !h.canManage || h.disabled || h.pending
  const switcher = <div className="flex flex-wrap gap-2" aria-label="Contenido de hardware">{[['stations',`Puestos (${workstations.length})`],['devices',`Equipos (${devices.length})`],['tests','Pruebas'],['history','Historial'],['prints','Documentos'],['policy','Política de gaveta']].map(([id,label])=><Button key={id} variant={tab===id?'default':'outline'} disabled={h.pending} onClick={()=>goto({panel:id==='policy'?'gaveta':id==='prints'?'impresiones':id==='tests'?'pruebas':id==='history'?'historial':null,equipos:id==='devices'?'si':null})}>{label}</Button>)}</div>
  const section = <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Hardware y puntos de cobro</h3><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Organiza qué caja y equipos utiliza cada puesto. Registrar un equipo no verifica su conexión.</p></div><Button variant="outline" disabled={h.pending || dirty.current} onClick={h.reload}>Actualizar</Button></div>
    <HardwareErrors fields={h.fields} error={h.error} />
    {(h.notice || localNotice) && <p role="status" className="text-sm">{localNotice || h.notice}</p>}
  </div>
  if(tab==='policy')return <div className="space-y-5">{section}{switcher}<DrawerPolicy key={JSON.stringify([h.companyId,h.branchId,h.userId])} scope={{companyId:h.companyId,branchId:h.branchId,userId:h.userId}} canManage={!disabled} onDirty={changed}/></div>
  if (editor) {
    if ((stationId && stationId !== 'nuevo' && !station) || (deviceId && deviceId !== 'nuevo' && !device)) return <div className="space-y-4">{section}<p role="alert">No encontramos este registro en la sucursal activa.</p><Button variant="outline" onClick={back}>Volver al listado</Button></div>
    return <div className="space-y-5">{section}{deviceId ? <HardwareDeviceEditor key={`${deviceId}-${device?.version || 0}`} device={device} devices={devices} disabled={disabled} fields={h.fields} onDirty={changed} onBack={back} onSave={async input => {
      const result = await h.saveDevice(device?.id || null, input)
      if (result) { dirty.current = false; const next = new URLSearchParams(params); next.set('equipo', result.id); setParams(next, { replace: true }) }
    }} /> : <HardwareWorkstationEditor key={`${stationId}-${station?.version || 0}`} station={station} workspace={h.workspace} disabled={disabled} fields={h.fields} onDirty={changed} onBack={back} onSave={async input => {
      const result = await h.saveWorkstation(station?.id || null, input)
      if (result) { dirty.current = false; const next = new URLSearchParams(params); next.set('puesto', result.id); setParams(next, { replace: true }) }
    }} onAssign={async items => { if (!station) return; const result = await h.assignDevices(station.id, station.version, items); if (result) dirty.current = false }} onRemember={station ? () => { try { rememberWorkstation({ companyId: h.companyId, branchId: h.branchId, userId: h.userId }, station); setLocalNotice(`Este navegador recordará ${station.name}. El servidor seguirá comprobando tus permisos.`) } catch (e) { setLocalNotice((e as Error).message) } } : undefined} />}</div>
  }
  if(tab==='prints'||tab==='tests'||tab==='history')return <div className="space-y-5">{section}{switcher}{tab==='prints'?<PrintHistory key={JSON.stringify([h.companyId,h.branchId,h.userId])} scope={{companyId:h.companyId,branchId:h.branchId,userId:h.userId}}/>:tab==='tests'?<HardwareDiagnostics key={JSON.stringify([h.companyId,h.branchId,h.userId,h.canTestPrint,h.canTestDrawer])} hardware={h}/>:<HardwareHistory scope={{companyId:h.companyId,branchId:h.branchId,userId:h.userId}}/>}</div>
  const rows = (tab === 'devices' ? devices : workstations).filter(row => `${row.name} ${row.code}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), currentPage = Math.min(page, totalPages), visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const create = () => goto(tab === 'devices' ? { equipo: 'nuevo', puesto: null, vista: 'editar' } : { puesto: 'nuevo', equipo: null, vista: 'editar' })
  return <div className="space-y-5">{section}
    <div className="flex flex-wrap items-center justify-between gap-3">{switcher}{h.canManage && <Button disabled={disabled} onClick={create}>{tab === 'devices' ? 'Registrar equipo' : 'Crear puesto'}</Button>}</div>
    <Input type="search" className="max-w-md" aria-label="Buscar puestos o equipos" placeholder="Buscar por nombre o código…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
    {visible.length ? <><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>{tab === 'devices' ? 'Tipo' : 'Caja de Auna'}</TableHead><TableHead>Configuración</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{visible.map(row => <TableRow key={row.id}><TableCell><span className="font-medium">{row.name}</span><small className="block text-muted-foreground">{row.code}</small></TableCell><TableCell>{'kind' in row ? kindLabels[row.kind] : registers.find(r => r.id === row.cashRegisterId)?.name || 'Sin caja'}</TableCell><TableCell>{stateLabels[row.state]}<small className="block text-muted-foreground">Registrado · pendiente de prueba física</small></TableCell><TableCell><Button size="sm" variant="ghost" aria-label={`${h.canManage ? 'Configurar' : 'Consultar'} ${row.name}`} onClick={() => goto(tab === 'devices' ? { equipo: row.id, puesto: null, vista: 'editar' } : { puesto: row.id, equipo: null, vista: 'editar' })}>{h.canManage ? 'Configurar' : 'Consultar'}</Button></TableCell></TableRow>)}</TableBody></Table><div className="hardware-pagination"><Pagination currentPage={currentPage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} count={visible.length} itemLabel={tab === 'devices' ? 'equipos' : 'puestos'} onPageChange={setPage} onPageSizeChange={setPageSize} /></div></> : <CollectionEmptyState title={tab === 'devices' ? 'Aquí empieza tu equipo de trabajo' : 'Démosle un lugar a tu próxima venta'} description={tab === 'devices' ? 'Registra lectores, impresoras o gavetas y asígnalos a tus puestos.' : 'Crea un puesto y vincula la caja y los equipos que utilizará.'} filtered={!!search.trim()} onReset={() => setSearch('')} action={h.canManage && <Button onClick={create} disabled={disabled}>{tab === 'devices' ? 'Registrar equipo' : 'Crear puesto'}</Button>} />}
    <p className="border-t border-border pt-4 text-xs text-muted-foreground">Sin conector instalado. La apertura de gaveta y la impresión automática todavía no están habilitadas.</p>
  </div>
}
