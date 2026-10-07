import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/context/useTenant'
import { ApiError } from '@/services/api'
import { createEmployeeWithDocuments, fetchHrDocumentTypes, fetchLinkableUsers, uploadEmployeePhoto, type DocumentSelection, type EmployeePayload } from '@/services/hrService'
import { EmployeeForm } from './EmployeeForm'
import { EmployeeDocumentsPanel } from './EmployeeDocumentsPanel'
import { EmployeePhotoPicker } from './EmployeePhotoPicker'
import './hr.css'

const emptyForm: EmployeePayload = { first_name: '', last_name: '', hire_date: '', base_salary: 0, bonificacion_incentivo: 250, pay_frequency: 'MENSUAL', payment_method: 'EFECTIVO' }
export default function EmployeeCreatePage() {
  const navigate = useNavigate(), { toast } = useToast(), { company } = useTenant(), qc = useQueryClient()
  const [form, setForm] = useState<EmployeePayload>(emptyForm), [documents, setDocuments] = useState<DocumentSelection[]>([]), [photo, setPhoto] = useState<File | null>(null), [preview, setPreview] = useState<string>(), [uploadingPhoto, setUploadingPhoto] = useState(false)
  const attempt = useRef<{ payload: string; documents: DocumentSelection[]; id: string }>()
  useEffect(() => { if (!photo) { setPreview(undefined); return } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url) }, [photo])
  const types = useQuery({ queryKey: ['hr-document-types', company?.id, 'active'], queryFn: () => fetchHrDocumentTypes() })
  const users = useQuery({ queryKey: ['hr-linkable-users', company?.id, 'new'], queryFn: () => fetchLinkableUsers() })
  const create = useMutation({ mutationFn: () => {
    const payload = JSON.stringify(form), old = attempt.current
    if (!old || old.payload !== payload || old.documents.length !== documents.length || old.documents.some((d, i) => d.typeId !== documents[i]?.typeId || d.file !== documents[i]?.file)) attempt.current = { payload, documents: [...documents], id: crypto.randomUUID() }
    return createEmployeeWithDocuments(form, documents, attempt.current!.id)
  }, onSuccess: async employee => {
    if (photo) { setUploadingPhoto(true); try { await uploadEmployeePhoto(employee.id, photo) } catch (error) { toast({ title: 'Empleado guardado; fotografía pendiente', description: error instanceof Error ? error.message : 'Intenta cargarla en el expediente', variant: 'destructive' }) } finally { setUploadingPhoto(false) } }
    void qc.invalidateQueries({ queryKey: ['hr-employees'] }); toast({ title: 'Empleado guardado' }); navigate(`/rrhh/empleados/${employee.id}`)
  }, onError: (error: Error) => { if (error instanceof ApiError && error.status === 409) void qc.invalidateQueries({ queryKey: ['hr-document-types'] }); toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' }) } })
  const busy = create.isPending || uploadingPhoto
  return <div className="hr-record-page"><div className="hr-record-container space-y-5"><h1 className="sr-only">Nuevo empleado</h1>
    <form onSubmit={event => { event.preventDefault(); if (!Number.isFinite(form.base_salary) || form.base_salary < 0) { toast({ title: 'Revisa el salario base', variant: 'destructive' }); return } create.mutate() }}>
      <div className="hr-create-grid">
        <div className="space-y-4"><EmployeeForm value={form} onChange={setForm} disabled={busy} /><div><label htmlFor="hr-user">Usuario del sistema</label><select id="hr-user" className="auna-control auna-control-select hr-native-select" disabled={busy || users.isPending || users.isError} value={form.user_id || ''} onChange={e => setForm({ ...form, user_id: e.target.value || null })}><option value="">Sin vincular</option>{users.data?.items.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select>{users.isError && <p className="text-xs text-destructive">No se pudo cargar el selector de usuarios.</p>}</div></div>
        <div className="hr-create-aside space-y-4"><EmployeePhotoPicker preview={preview} onFileSelect={setPhoto} onReject={message => toast({ title: 'Imagen no válida', description: message, variant: 'destructive' })} disabled={busy} isUploading={uploadingPhoto} selectionLabel={photo?.name} onClearSelection={() => setPhoto(null)} /><EmployeeDocumentsPanel selections={documents} onChange={setDocuments} disabled={busy} /></div>
      </div>
      <div className="flex justify-end gap-3 mt-5"><Button type="button" variant="outline" disabled={busy} onClick={() => navigate('/rrhh')}>Cancelar</Button><Button type="submit" disabled={busy || types.isPending || types.isError} className="bg-brand-orange text-white hover:bg-brand-orange-strong">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{busy ? 'Guardando expediente…' : 'Guardar empleado'}</Button></div>
    </form></div></div>
}
