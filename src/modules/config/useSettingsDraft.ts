import { useCallback, useEffect, useRef, useState } from 'react'
import { getActiveBranchId, getActiveCompanyId } from '@/services/api'
import { getSettings, updateSettings, uploadCompanyLogo, removeCompanyLogo, type SettingsScope, type SystemSettings } from '@/services/settingsService'
import { SECTION_KEYS, sameSection, sectionPayload, sectionValues, validateSection, type EditableSection, type FieldErrors, type SectionValues } from './settingsModel'

export type SettingsEditorContext = SettingsScope & { userId: string; ready: boolean; canRead: boolean; canManage: boolean; consolidated: boolean }
export type EditorActivity = { dirty: boolean; pending: boolean }
export type SaveOutcome = 'saved' | 'saved-refresh-failed' | 'invalid' | 'failed' | 'ignored'
type Drafts = Record<EditableSection, SectionValues>
type Status = 'unavailable' | 'loading' | 'ready' | 'error'
const makeDrafts = (settings: SystemSettings): Drafts => Object.fromEntries(Object.keys(SECTION_KEYS).map(id => [id, sectionValues(id as EditableSection, settings)])) as Drafts
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.'
function initial(key: string, epoch: number) {
  return { key, epoch, active: true, blocked: false, status: 'unavailable' as Status, confirmed: {} as SystemSettings, drafts: makeDrafts({}),
    errors: {} as Partial<Record<EditableSection, FieldErrors>>, error: null as string | null, loadError: null as string | null,
    busy: false, activities: {} as Partial<Record<'rrhh' | 'modulos', EditorActivity>>, controller: null as AbortController | null }
}

export function useSettingsDraft({ context, refresh }: { context: SettingsEditorContext; refresh: () => Promise<boolean> }) {
  const key = JSON.stringify([context.userId, context.companyId, context.branchId, context.ready, context.canRead, context.canManage, context.consolidated])
  const live = useRef(initial(key, 0)), [, render] = useState(0)
  if (live.current.key !== key) {
    live.current.controller?.abort()
    live.current = initial(key, live.current.epoch + 1)
  }
  const owner = live.current, epoch = owner.epoch
  const paint = () => render(n => n + 1)
  const scopeMatches = () => context.companyId === getActiveCompanyId() && context.branchId === getActiveBranchId()
  const current = () => live.current === owner && owner.active && !owner.blocked && owner.epoch === epoch && scopeMatches()
  const readable = () => context.ready && !!context.userId && !!context.companyId && !!context.branchId && (context.canRead || context.canManage)
  const pending = () => owner.busy || Object.values(owner.activities).some(a => a?.pending)
  const canStartOperation = () => current() && readable() && context.canManage && !context.consolidated && owner.status === 'ready' && !pending()
  const dirty = (id: EditableSection) => owner.status === 'ready' && !sameSection(id, owner.drafts[id], sectionValues(id, owner.confirmed))

  async function load() {
    if (live.current !== owner || !owner.active || owner.blocked || !readable() || !scopeMatches() || pending()) return
    owner.controller?.abort()
    const controller = new AbortController(), loadEpoch = ++owner.epoch
    owner.controller = controller; owner.status = 'loading'; owner.loadError = null; paint()
    try {
      const settings = await getSettings({ scope: { companyId: context.companyId, branchId: context.branchId }, signal: controller.signal })
      if (live.current !== owner || !owner.active || owner.blocked || owner.epoch !== loadEpoch || !scopeMatches()) return
      owner.confirmed = settings; owner.drafts = makeDrafts(settings); owner.errors = {}; owner.error = null; owner.status = 'ready'; paint()
    } catch (error) {
      if (live.current !== owner || !owner.active || owner.blocked || owner.epoch !== loadEpoch || !scopeMatches()) return
      owner.status = 'error'; owner.loadError = message(error); paint()
    }
  }

  useEffect(() => {
    owner.active = true
    void load()
    function invalidate(event: Event) {
      if (live.current !== owner) return
      if (event.type === 'tenant:changed' && scopeMatches()) return
      if (event.type === 'storage' && (event as StorageEvent).key != null && !['tenant:companyId', 'tenant:branchId', 'auth:user', 'auth:isAuthenticated'].includes((event as StorageEvent).key!)) return
      owner.controller?.abort(); owner.epoch++; owner.blocked = true; owner.busy = false
      owner.confirmed = {}; owner.drafts = makeDrafts({}); owner.activities = {}; owner.status = 'unavailable'; paint()
    }
    if (typeof window !== 'undefined') for (const name of ['tenant:changed', 'auth:unauthorized', 'storage']) window.addEventListener(name, invalidate)
    return () => {
      owner.active = false; owner.epoch++; owner.controller?.abort()
      if (typeof window !== 'undefined') for (const name of ['tenant:changed', 'auth:unauthorized', 'storage']) window.removeEventListener(name, invalidate)
    }
  }, [key]) // The owner and its handlers belong to this context, not the selected section.

  function setField(id: EditableSection, field: keyof SystemSettings, value: unknown) {
    if (!canStartOperation() || !(SECTION_KEYS[id] as readonly string[]).includes(field)) return
    owner.drafts = { ...owner.drafts, [id]: { ...owner.drafts[id], [field]: structuredClone(value) } }
    const errors = Object.fromEntries(Object.entries(owner.errors[id] || {}).filter(([key]) => key !== field && !key.startsWith(`${field}.`)))
    owner.errors = { ...owner.errors, [id]: errors }; owner.error = null; paint()
  }
  function reset(id: EditableSection) {
    if (!canStartOperation()) return
    owner.drafts = { ...owner.drafts, [id]: sectionValues(id, owner.confirmed) }
    owner.errors = { ...owner.errors, [id]: {} }; owner.error = null; paint()
  }
  async function mutate(run: () => Promise<SystemSettings>, confirm: (result: SystemSettings) => void): Promise<SaveOutcome> {
    if (!canStartOperation()) return 'ignored'
    owner.busy = true; owner.error = null; paint()
    try {
      const result = await run()
      if (!current()) return 'ignored'
      confirm(result); paint()
      let refreshed = false
      try { refreshed = await refresh() } catch { /* The write already committed; refresh is a separate result. */ }
      if (!current()) return 'ignored'
      return refreshed === false ? 'saved-refresh-failed' : 'saved'
    } catch (error) {
      if (!current()) return 'ignored'
      owner.error = message(error); paint(); return 'failed'
    } finally {
      if (current()) { owner.busy = false; paint() }
    }
  }
  async function save(id: EditableSection): Promise<SaveOutcome> {
    if (!canStartOperation() || !dirty(id)) return 'ignored'
    const errors = validateSection(id, owner.drafts[id])
    owner.errors = { ...owner.errors, [id]: errors }; paint()
    if (Object.keys(errors).length) return 'invalid'
    const payload = structuredClone(sectionPayload(id, owner.drafts[id]))
    const expectedRevisions=Object.fromEntries(Object.keys(payload).map(key=>[key,owner.confirmed._revisions?.[key]??0]))
    return mutate(() => updateSettings(payload, { scope: { companyId: context.companyId, branchId: context.branchId },expectedRevisions }), result => {
      const confirmed = sectionValues(id, { ...payload, ...result })
      owner.confirmed = { ...owner.confirmed, ...confirmed,_revisions:{...owner.confirmed._revisions,...Object.fromEntries(Object.keys(payload).map(key=>[key,result._revisions?.[key]??expectedRevisions[key]]))} }
      owner.drafts = { ...owner.drafts, [id]: confirmed }; owner.errors = { ...owner.errors, [id]: {} }
    })
  }
  function uploadLogo(file: File) {
    return mutate(async () => uploadCompanyLogo(file, { scope: { companyId: context.companyId, branchId: context.branchId },expectedRevision:owner.confirmed._revisions?.company_logo_url??0 }), result => {
      owner.confirmed = { ...owner.confirmed, company_logo_url: result.company_logo_url,_revisions:{...owner.confirmed._revisions,...result._revisions} };owner.error=result.warning??null
    })
  }
  function removeLogo() {
    return mutate(async () => (await removeCompanyLogo({ scope: { companyId: context.companyId, branchId: context.branchId },expectedRevision:owner.confirmed._revisions?.company_logo_url??0 }))||{company_logo_url:''}, result => {
      owner.confirmed = { ...owner.confirmed, company_logo_url: result.company_logo_url,_revisions:{...owner.confirmed._revisions,...result._revisions} };owner.error=result.warning??null
    })
  }
  async function reloadSection(id:EditableSection){
    if(!canStartOperation())return false
    owner.busy=true;paint()
    try{
      const result=await getSettings({scope:{companyId:context.companyId,branchId:context.branchId}})
      if(!current())return false
      const confirmed=sectionValues(id,result),revisions=Object.fromEntries(SECTION_KEYS[id].map(key=>[key,result._revisions?.[key]??0]))
      owner.confirmed={...owner.confirmed,...confirmed,_revisions:{...owner.confirmed._revisions,...revisions}}
      if(id==='empresa')owner.confirmed={...owner.confirmed,company_logo_url:result.company_logo_url,_revisions:{...owner.confirmed._revisions,company_logo_url:result._revisions?.company_logo_url??0}}
      owner.drafts={...owner.drafts,[id]:confirmed};owner.errors={...owner.errors,[id]:{}};owner.error=null;return true
    }catch(error){if(current())owner.error=message(error);return false}
    finally{if(current()){owner.busy=false;paint()}}
  }
  const reportActivity = useCallback((id: 'rrhh' | 'modulos', activity: EditorActivity) => {
    if (!current()) return
    const old = owner.activities[id]
    if (old?.dirty === activity.dirty && old?.pending === activity.pending) return
    owner.activities = { ...owner.activities, [id]: activity }; paint()
  }, [key, epoch])

  return { status: owner.status, loadError: owner.loadError, confirmed: owner.confirmed, drafts: owner.drafts, errors: owner.errors, error: owner.error,
    pending: pending(), hasChanges: (Object.keys(SECTION_KEYS) as EditableSection[]).some(dirty) || Object.values(owner.activities).some(a => a?.dirty),
    logoUrl: owner.confirmed.company_logo_url || '', dirty, setField, reset, save, uploadLogo, removeLogo, reloadSection, reportActivity, canStartOperation,
    getActivity: (): EditorActivity => ({ pending: pending(), dirty: (Object.keys(SECTION_KEYS) as EditableSection[]).some(dirty) || Object.values(owner.activities).some(a => a?.dirty) }),
    reload: async () => {
      if (current() && !pending() && !(Object.keys(SECTION_KEYS) as EditableSection[]).some(dirty) && !Object.values(owner.activities).some(a => a?.dirty)) await load()
    } }
}
