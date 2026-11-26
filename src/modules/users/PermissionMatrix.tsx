import type { Permission } from '@/services/userService'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { Switch } from '@/components/ui/switch'
import { groupPermissionsByModule, formatPermissionGroupLabel, sortPermissionGroupEntries } from '@/lib/permissionGroups'

const columns = [['view', 'Lectura'], ['create', 'Crear'], ['edit', 'Editar'], ['delete', 'Eliminar'], ['approve', 'Aprobar']]
export function PermissionMatrix({ catalog, selected, onChange, disabled = false }: { catalog: Permission[]; selected: string[]; onChange: (codes: string[]) => void; disabled?: boolean }) {
  function toggle(code: string) {
    if (disabled) return
    const next = new Set(selected)
    if (next.has(code)) {
      next.delete(code)
      // Quitar también los permisos dependientes; no dejar editar sin lectura.
      let changed = true
      while (changed) { changed = false; for (const p of catalog) if (next.has(p.code) && p.implies?.some(c => !next.has(c))) { next.delete(p.code); changed = true } }
    } else {
      const include = (c: string) => { if (next.has(c)) return; next.add(c); catalog.find(p => p.code === c)?.implies?.forEach(include) }
      include(code)
    }
    onChange([...next])
  }
  const control = (p: Permission) => <Switch key={p.code} aria-label={p.name} title={[p.description, p.implies?.length ? `Incluye: ${p.implies.map(code => catalog.find(item => item.code === code)?.name || 'Permiso relacionado').join(', ')}` : ''].filter(Boolean).join('. ')} checked={selected.includes(p.code)} disabled={disabled} onCheckedChange={() => toggle(p.code)}/>
  const requirements = catalog.filter(p=>selected.includes(p.code)).flatMap(p=>(p.requirements??[]).map(requirement=>({...requirement,missing:requirement.permissions.filter(code=>!selected.includes(code))}))).filter(requirement=>requirement.missing.length)
  if (!catalog.length) return <CollectionEmptyState compact title="Los permisos aparecerán aquí" description="No hay permisos disponibles en este catálogo para configurar." />
  return <div className="space-y-3"><div className="overflow-x-auto"><table className="users-table"><thead><tr><th>Módulo</th>{columns.map(([code, label]) => <th key={code}>{label}</th>)}<th>Otras acciones</th></tr></thead><tbody>{sortPermissionGroupEntries(groupPermissionsByModule(catalog)).map(([key, perms]) => {
    const extra = perms.filter(p => !columns.some(([action]) => p.code.split('.').pop() === action))
    return <tr key={key}><td><strong>{formatPermissionGroupLabel(key)}</strong><p className="users-muted text-xs mt-1">{perms.length} {perms.length === 1 ? 'permiso' : 'permisos'}</p></td>{columns.map(([action]) => { const matches = perms.filter(p => p.code.split('.').pop() === action); return <td key={action}>{matches.length ? <div className="space-y-3">{matches.map(p => matches.length === 1 ? control(p) : <label key={p.code} className="flex items-center justify-between gap-3 text-xs min-w-40">{p.name}{control(p)}</label>)}</div> : <span className="users-muted text-xs">No aplica</span>}</td> })}<td>{extra.length ? <details><summary className="cursor-pointer text-sm">{extra.length} {extra.length === 1 ? 'acción' : 'acciones'}</summary><div className="space-y-3 py-3 min-w-48">{extra.map(p => <label key={p.code} className="flex items-center justify-between gap-3 text-xs">{p.name}{control(p)}</label>)}</div></details> : <span className="users-muted">—</span>}</td></tr>
  })}</tbody></table></div>{requirements.length>0&&<section aria-label="Requisitos de acciones específicas" className="rounded-lg border border-border bg-muted/30 p-3 text-sm"><p className="font-medium">Para estas acciones específicas</p><p className="users-muted mt-1 text-xs">Estos permisos no se activan solos. Agrégalos solo si el rol también debe realizar la acción indicada.</p><ul className="mt-2 space-y-1">{requirements.map(requirement=><li key={requirement.action}><span className="font-medium">{requirement.action}</span>: Requiere además {requirement.missing.map(code=>catalog.find(p=>p.code===code)?.name??code).join(', ')}.</li>)}</ul></section>}</div>
}
