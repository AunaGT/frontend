import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { SETTINGS_SECTIONS, findSettingsSections, type SettingsSection } from '../settingsModel'
import {ConfiguracionIcon,SucursalesIcon,ReporteFinancieroIcon,InventarioIcon,VentasIcon,CotizacionesIcon,PedidosIcon,DevolucionesIcon,CierreCajaIcon,RrhhIcon,NominaIcon,UsuariosIcon,ReportesIcon} from '@/components/icons/CustomIcons'
const icons={empresa:SucursalesIcon,regional:ConfiguracionIcon,fiscal:ReporteFinancieroIcon,plantillas:ReportesIcon,inventario:InventarioIcon,ventas:VentasIcon,cotizaciones:CotizacionesIcon,pedidos:PedidosIcon,devoluciones:DevolucionesIcon,caja:CierreCajaIcon,hardware:CierreCajaIcon,rrhh:RrhhIcon,nomina:NominaIcon,modulos:ConfiguracionIcon,accesos:UsuariosIcon,historial:ReportesIcon}

export function SettingsNavigation({ active, onSelect,companyName='Empresa activa',sections=SETTINGS_SECTIONS }: { active: SettingsSection; onSelect: (id: SettingsSection) => void;companyName?:string;sections?:typeof SETTINGS_SECTIONS }) {
  const [search, setSearch] = useState(''), matches = findSettingsSections(search).filter(s=>sections.some(allowed=>allowed.id===s.id))
  const groups = [...new Set(matches.map(s => s.group))]
  return <nav className="config-navigation" aria-label="Secciones de configuración">
    <div className="config-navigation-heading"><ConfiguracionIcon className="h-6 w-6" aria-hidden="true"/><span>Ajustes de empresa</span></div>
    <label className="grid gap-2 text-sm font-medium">Buscar un ajuste<Input type="search" value={search} placeholder="Ej. billetes, servicios…" onChange={e => setSearch(e.target.value)} /></label>
    <div className="config-mobile-section"><label className="grid gap-2 text-sm">Sección<select className="auna-control auna-control-select w-full" value={active} onChange={e => onSelect(e.target.value as SettingsSection)}>{sections.map(s => <option key={s.id} value={s.id}>{s.group} · {s.label}</option>)}</select></label></div>
    <div className={`config-section-menu ${search.trim() ? 'is-searching' : ''}`}>{groups.map(group => <div key={group} className="config-nav-group"><p>{group}</p><ul>{matches.filter(s => s.group === group).map(s => {const Icon=icons[s.id];return <li key={s.id}><button type="button" aria-current={active === s.id ? 'page' : undefined} onClick={() => onSelect(s.id)}><span className="config-nav-icon" aria-hidden="true"><Icon className="h-6 w-6"/></span><span>{s.label}</span></button></li>})}</ul></div>)}</div>
    {!matches.length && <CollectionEmptyState compact title="Tus ajustes aparecerán aquí" description="No hay secciones disponibles en este contexto." filtered={Boolean(search.trim())} onReset={() => setSearch('')} />}
    <div className="config-navigation-identity"><span>Empresa activa</span><strong>{companyName}</strong><small>Los cambios se aplican solo a esta empresa.</small></div>
  </nav>
}
