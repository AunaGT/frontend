import type { Permission } from '@/services/userService'
import { Switch } from '@/components/ui/switch'
import { groupPermissionsByModule, formatPermissionGroupLabel, sortPermissionGroupEntries } from '@/lib/permissionGroups'

const columns = [['view', 'Lectura'], ['create', 'Crear'], ['edit', 'Editar'], ['delete', 'Eliminar'], ['approve', 'Aprobar']]
export function PermissionMatrix({ catalog, selected, onChange, disabled = false }: { catalog: Permission[]; selected: string[]; onChange: (codes: string[]) => void; disabled?: boolean }) {
  function toggle(code: string) {
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
  const control = (p: Permission) => <Switch key={p.code} aria-label={p.name} title={[p.description, p.implies?.length ? `Incluye: ${p.implies.join(', ')}` : ''].filter(Boolean).join('. ')} checked={selected.includes(p.code)} disabled={disabled} onCheckedChange={() => toggle(p.code)}/>
  return <div className="overflow-x-auto"><table className="users-table"><thead><tr><th>Módulo</th>{columns.map(([code, label]) => <th key={code}>{label}</th>)}<th>Otras acciones</th></tr></thead><tbody>{sortPermissionGroupEntries(groupPermissionsByModule(catalog)).map(([key, perms]) => {
    const extra = perms.filter(p => !columns.some(([action]) => p.code.split('.').pop() === action))
    return <tr key={key}><td><strong>{formatPermissionGroupLabel(key)}</strong><p className="users-muted text-xs mt-1">{perms.length} {perms.length === 1 ? 'permiso' : 'permisos'}</p></td>{columns.map(([action]) => { const p = perms.find(p => p.code.split('.').pop() === action); return <td key={action}>{p ? control(p) : <span className="users-muted text-xs">No aplica</span>}</td> })}<td>{extra.length ? <details><summary className="cursor-pointer text-sm">{extra.length} {extra.length === 1 ? 'acción' : 'acciones'}</summary><div className="space-y-3 py-3 min-w-48">{extra.map(p => <label key={p.code} className="flex items-center justify-between gap-3 text-xs">{p.name}{control(p)}</label>)}</div></details> : <span className="users-muted">—</span>}</td></tr>
  })}</tbody></table></div>
}
