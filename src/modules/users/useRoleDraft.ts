import { useEffect, useRef, useState } from 'react'
import { createRole, updateRole, type Role } from '@/services/userService'
import { roleDraft } from './roleEditorModel.mjs'
export type RoleContext = { companyId: string; userId: string }
type Draft = { name: string; description: string; selected: string[] }
const same = (a: Draft, b: Draft) => a.name === b.name && a.description === b.description && [...a.selected].sort().join('|') === [...b.selected].sort().join('|')
export function useRoleDraft({ context, id, role, canManage }: { context: RoleContext; id?: number; role?: Role; canManage: boolean }) {
  const key = JSON.stringify([context.companyId, context.userId, id, canManage])
  const live = useRef({ key, epoch: 0, pending: false, edits: 0, active: true })
  if (live.current.key !== key) live.current = { key, epoch: live.current.epoch + 1, pending: false, edits: 0, active: true }
  const renderEpoch = live.current.epoch, renderEdits = live.current.edits
  const latest = useRef(role); latest.current = role
  const baseline = useRef<{ key: string; value: Draft; revision?: number }>({ key, value: roleDraft(undefined) })
  const [state, setState] = useState<{ key: string; value: Draft; busy: boolean; conflict: boolean; error: string | null }>({ key, value: roleDraft(undefined), busy: false, conflict: false, error: null })
  const current = state.key === key ? state : { key, value: roleDraft(undefined), busy: false, conflict: false, error: null }
  const dirty = baseline.current.key === key && !same(current.value, baseline.current.value)
  function reset(candidate = latest.current) {
    if (!live.current.active || live.current.key !== key || live.current.epoch !== renderEpoch || live.current.edits !== renderEdits) return
    const value: Draft = roleDraft(candidate)
    baseline.current = { key, value, revision: candidate?.revision }
    setState({ key, value, busy: false, conflict: false, error: null })
  }
  useEffect(() => {
    if (baseline.current.key !== key || state.key !== key) { reset(); return }
    if (!dirty && !live.current.pending) reset()
    else if (role && baseline.current.revision !== role.revision) setState(s => ({ ...s, conflict: true }))
  }, [key, role])
  useEffect(() => { live.current.active = true; return () => { live.current.epoch++; live.current.pending = false; live.current.active = false } }, [])
  function field<K extends keyof Draft>(name: K, value: Draft[K]) {
    if (!live.current.active || live.current.epoch !== renderEpoch || live.current.key !== key || !canManage || role?.protected || live.current.pending) return
    live.current.edits++
    setState(s => ({ ...s, value: { ...s.value, [name]: value }, error: null }))
  }
  async function save(): Promise<Role | undefined> {
    if (!live.current.active || live.current.epoch !== renderEpoch || live.current.pending || live.current.key !== key || !canManage || !context.companyId || !context.userId || role?.protected || current.conflict || !current.value.name.trim() || (id && (!role || role.id !== id || !dirty))) return
    const epoch = live.current.epoch, revision = baseline.current.revision
    live.current.pending = true
    setState(s => ({ ...s, busy: true, error: null }))
    try {
      const payload = { name: current.value.name.trim(), description: current.value.description, permissions: current.value.selected }
      const saved = id ? await updateRole(id, { ...payload, expectedRevision: revision! }) : await createRole(payload)
      if (epoch !== live.current.epoch || live.current.key !== key) return
      const value: Draft = roleDraft(saved)
      baseline.current = { key, value, revision: saved.revision }
      setState({ key, value, busy: false, conflict: false, error: null })
      return saved
    } catch (e) {
      if (epoch === live.current.epoch && live.current.key === key) setState(s => ({ ...s, busy: false, error: (e as Error).message, conflict: (e as { status?: number }).status === 409 || s.conflict }))
    } finally {
      if (epoch === live.current.epoch && live.current.key === key) live.current.pending = false
    }
  }
  async function restore(load: () => Promise<Role | undefined>) {
    if (!live.current.active || live.current.key !== key || live.current.epoch !== renderEpoch || live.current.pending || !canManage) return
    live.current.pending = true; setState(s => ({ ...s, busy: true, error: null }))
    try { const fresh = await load(); reset(fresh) }
    catch (e) { if (live.current.key === key && live.current.epoch === renderEpoch) setState(s => ({ ...s, error: (e as Error).message })) }
    finally { if (live.current.key === key && live.current.epoch === renderEpoch) { live.current.pending = false; setState(s => ({ ...s, busy: false })) } }
  }
  return { ...current.value, dirty, busy: current.busy, conflict: current.conflict, error: current.error, setName: (v: string) => field('name', v), setDescription: (v: string) => field('description', v), setSelected: (v: string[]) => field('selected', v), reset, restore, save }
}
