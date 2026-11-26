import { useEffect, useRef, useState } from 'react'
import { readConnection, saveConnection, validateLocally } from './api'
import { credentialLabels, endpointLabels, type EndpointAction, type Endpoints, type ConnectionErrors, type ConnectorScope, type Environment, type Credentials, type CredentialField, type Connection, type LocalReview, type Command } from './types'
import { endpointError } from './endpoints'
const emptyFields = (): Credentials => ({ signUser: '', signKey: '', apiUser: '', apiKey: '' })
const endpointActions = Object.keys(endpointLabels) as EndpointAction[]
const endpointFields = (connection?: Connection | null) => Object.fromEntries(endpointActions.map(key => [key, connection?.endpoints?.[key] || ''])) as Record<EndpointAction, string>
type Owner = { key: string; active: boolean; controller: AbortController }
type Model = { owner: Owner; connection: Connection | null; fields: Credentials; endpoints: Record<EndpointAction, string>; loading: boolean; pending: boolean; error: string; fieldErrors: ConnectionErrors; review: LocalReview | null }
const fresh = (owner: Owner): Model => ({ owner, connection: null, fields: emptyFields(), endpoints: endpointFields(), loading: true, pending: false, error: '', fieldErrors: {}, review: null })
const endpointChanges = (value: Model): Partial<Endpoints> => Object.fromEntries(endpointActions.filter(key => value.endpoints[key] !== (value.connection?.endpoints?.[key] || '')).map(key => [key, value.endpoints[key] || null]))
const isDirty = (value: Model) => Object.values(value.fields).some(Boolean) || Object.keys(endpointChanges(value)).length > 0
export function useInfileConnection(scope: ConnectorScope, environment: Environment) {
  const key = JSON.stringify([scope, environment]), live = useRef<Owner | null>(null)
  if (live.current?.key !== key) {
    if (live.current) { live.current.active = false; live.current.controller.abort() }
    live.current = { key, active: true, controller: new AbortController() }
  }
  const owner = live.current
  const [model, setModel] = useState(() => fresh(owner)), state = model.owner === owner ? model : fresh(owner)
  const latest = useRef(state); latest.current = state
  const busy = useRef(false), attempt = useRef<{ signature: string; key: string } | null>(null)
  const activity = useRef({ dirty: false, pending: false })
  activity.current = { dirty: isDirty(state), pending: state.pending || busy.current }
  const current = () => owner.active && live.current === owner
  const patch = (change: Partial<Model>) => { if (current()) setModel(old => ({ ...(old.owner === owner ? old : fresh(owner)), ...change })) }
  const showError = (error: unknown) => {
    if (!current() || (error as Error)?.name === 'AbortError') return
    const e = error as { message?: string; data?: { fields?: ConnectionErrors } }
    // Never render an arbitrary server message that might echo a submitted secret.
    const messages: Record<string, string> = { FISCAL_STORAGE_NOT_READY: 'El administrador debe preparar el almacenamiento fiscal antes de configurar conexiones.', FISCAL_KEYRING_UNAVAILABLE: 'El administrador debe preparar el cifrado del servidor.', FISCAL_STALE_VERSION: 'La conexión cambió en otra sesión. Recarga para revisar la versión actual.', FISCAL_FORBIDDEN: 'No tienes permiso para esta acción.' }
    const code = (error as { data?: { code?: string } })?.data?.code
    patch({ error: messages[code || ''] || 'No se pudo completar la operación. Puedes volver a intentarlo.', fieldErrors: e.data?.fields || {} })
  }
  const reload = async () => {
    if (busy.current || !current()) return
    patch({ loading: true, error: '' })
    try { const connection = await readConnection(scope, environment, owner.controller.signal); if (current()) { attempt.current = null; patch({ connection, fields: emptyFields(), endpoints: endpointFields(connection), review: null, fieldErrors: {} }); activity.current.dirty = false } }
    catch (e) { showError(e) }
    finally { patch({ loading: false }) }
  }
  useEffect(() => {
    owner.active = true; busy.current = false; attempt.current = null
    // A new controller is needed when React StrictMode remounts effects.
    owner.controller = new AbortController()
    void reload()
    return () => { owner.active = false; owner.controller.abort() }
  }, [owner])
  const setField = (field: CredentialField, value: string) => {
    if (!current() || busy.current) return
    activity.current.dirty = true
    patch({ fields: { ...latest.current.fields, [field]: value }, fieldErrors: {}, review: null, error: '' })
  }
  const setEndpoint = (action: EndpointAction, value: string) => {
    if (!current() || busy.current) return
    activity.current.dirty = true
    patch({ endpoints: { ...latest.current.endpoints, [action]: value }, fieldErrors: {}, review: null, error: '' })
  }
  const validateEndpoint = (action: EndpointAction) => {
    if (!current() || busy.current) return
    patch({ fieldErrors: { ...latest.current.fieldErrors, [`endpoints.${action}`]: endpointError(latest.current.endpoints[action]) } })
  }
  const run = async (save: boolean): Promise<Connection | LocalReview | null> => {
    const value = latest.current
    if (!current() || busy.current || value.loading || !value.connection?.capabilities.encryptionReady || scope.branchId === 'all') return null
    const credentials = Object.fromEntries(Object.entries(value.fields).filter(([, text]) => text !== '')) as Partial<Credentials>
    const endpoints = endpointChanges(value)
    if (save) {
      const errors: ConnectionErrors = {}
      for (const field of Object.keys(credentials).length ? Object.keys(credentialLabels) as CredentialField[] : []) {
        if (!value.connection.credentialStatus[field] && !credentials[field] || credentials[field] !== undefined && (!credentials[field]!.trim() || Array.from(credentials[field]!).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || credentials[field]!.length > (field.endsWith('User') ? 256 : 2048))) errors[field] = 'Completa este campo sin saltos de línea.'
      }
      for (const action of Object.keys(endpoints) as EndpointAction[]) {
        const error = endpointError(value.endpoints[action])
        if (error) errors[`endpoints.${action}`] = error
      }
      if (Object.keys(errors).length) { patch({ fieldErrors: errors, error: 'Revisa los campos señalados.' }); return null }
      if (!Object.keys(credentials).length && !Object.keys(endpoints).length) return null
    } else if (!value.connection.id || activity.current.dirty) return null
    busy.current = true; activity.current.pending = true; patch({ pending: true, error: '', fieldErrors: {} })
    const body: Command = { expectedVersion: value.connection.revision, idempotencyKey: '', ...(save && Object.keys(credentials).length ? { credentials } : {}), ...(save && Object.keys(endpoints).length ? { endpoints } : {}) }
    const signature = JSON.stringify([owner.key, save, body])
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() }
    body.idempotencyKey = attempt.current.key
    try {
      const result = save ? await saveConnection(scope, environment, body, owner.controller.signal) : await validateLocally(scope, environment, body, owner.controller.signal)
      if (!current()) return null
      attempt.current = null
      if (save) { patch({ connection: result as Connection, fields: emptyFields(), endpoints: endpointFields(result as Connection), review: null }); activity.current.dirty = false }
      else patch({ review: result as LocalReview })
      return result
    } catch (e) { showError(e); return null }
    finally { if (current()) { busy.current = false; activity.current.pending = false; patch({ pending: false }) } }
  }
  return { ...state, dirty: isDirty(state), activity, setField, setEndpoint, validateEndpoint, reload, save: () => run(true), validate: () => run(false) }
}
