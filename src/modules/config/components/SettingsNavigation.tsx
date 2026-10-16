import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SETTINGS_SECTIONS, findSettingsSections, type SettingsSection } from '../settingsModel'

export function SettingsNavigation({ active, onSelect }: { active: SettingsSection; onSelect: (id: SettingsSection) => void }) {
  const [search, setSearch] = useState(''), matches = findSettingsSections(search)
  const groups = [...new Set(matches.map(s => s.group))]
  return <nav className="config-navigation" aria-label="Secciones de configuración">
    <label className="grid gap-2 text-sm font-medium">Buscar un ajuste<Input type="search" value={search} placeholder="Ej. billetes, servicios…" onChange={e => setSearch(e.target.value)} /></label>
    <div className="config-mobile-section"><label className="grid gap-2 text-sm">Sección<select className="auna-control auna-control-select w-full" value={active} onChange={e => onSelect(e.target.value as SettingsSection)}>{SETTINGS_SECTIONS.map(s => <option key={s.id} value={s.id}>{s.group} · {s.label}</option>)}</select></label></div>
    <div className={`config-section-menu ${search.trim() ? 'is-searching' : ''}`}>{groups.map(group => <div key={group} className="config-nav-group"><p>{group}</p><ul>{matches.filter(s => s.group === group).map(s => <li key={s.id}><button type="button" aria-current={active === s.id ? 'page' : undefined} onClick={() => onSelect(s.id)}>{s.label}</button></li>)}</ul></div>)}</div>
    {!matches.length && <div className="text-sm text-muted-foreground" role="status">No encontramos ese ajuste.<Button type="button" variant="ghost" onClick={() => setSearch('')}>Limpiar búsqueda</Button></div>}
  </nav>
}
