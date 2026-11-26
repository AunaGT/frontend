import {useState} from 'react'
import {Search} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Button} from '@/components/ui/button'
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select'
import {credentialStatuses,scopeLabels,emptyCredentialFilters,sensitiveSearch} from './model'
import type {CredentialFiltersValue,CredentialStatus,ScopeCode} from './types'

export function CredentialFilters({value,onApply,disabled=false}:{value:CredentialFiltersValue;onApply:(value:CredentialFiltersValue)=>void;disabled?:boolean}){
 const [draft,setDraft]=useState(value),[error,setError]=useState('')
 return <form className="integration-filters" onSubmit={e=>{e.preventDefault();if(disabled||error)return;if(sensitiveSearch(draft.q)){setError('Busca por nombre o identificador público; nunca pegues una clave privada.');return}setError('');onApply({...draft,q:draft.q.trim()})}}>
  <div className="integration-filter-search"><Label htmlFor="integration-search">Buscar claves</Label><Input id="integration-search" value={draft.q} maxLength={100} disabled={disabled} placeholder="Nombre o identificador público" aria-invalid={!!error} aria-describedby={error?'integration-search-error':undefined} onChange={e=>{const q=e.target.value;if(sensitiveSearch(q)){setDraft({...draft,q:''});setError('Busca por nombre o identificador público; nunca pegues una clave privada.')}else{setDraft({...draft,q});setError('')}}}/>{error&&<p id="integration-search-error" role="alert" className="auna-field-message text-destructive">{error}</p>}</div>
  <div className="integration-filter-status"><Label htmlFor="integration-status">Estado</Label><Select value={draft.status} disabled={disabled} onValueChange={status=>setDraft({...draft,status:status as CredentialStatus|'ALL'})}><SelectTrigger id="integration-status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los estados</SelectItem>{Object.entries(credentialStatuses).map(([code,label])=><SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></div>
  <div className="integration-filter-scope"><Label htmlFor="integration-scope">Permiso</Label><Select value={draft.scope} disabled={disabled} onValueChange={scope=>setDraft({...draft,scope:scope as ScopeCode|'ALL'})}><SelectTrigger id="integration-scope"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los permisos</SelectItem>{Object.entries(scopeLabels).map(([code,label])=><SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></div>
  <div className="integration-actions"><Button type="submit" variant="outline" disabled={disabled||!!error}><Search size={16} aria-hidden="true"/>Buscar</Button><Button type="button" variant="ghost" disabled={disabled} onClick={()=>{if(disabled)return;setDraft(emptyCredentialFilters);setError('');onApply(emptyCredentialFilters)}}>Limpiar</Button></div>
 </form>
}
