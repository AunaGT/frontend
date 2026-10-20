import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/context/useTenant'
import { createHrDocumentType, fetchHrDocumentTypes, updateHrDocumentType, type DocumentType } from '@/services/hrService'
import { useRelatedSettingsEditor, type RelatedEditorProps } from '../useRelatedSettingsEditor'

const empty = { name: '', instructions: '', required: false, active: true, sort_order: 0 }
const documentForm = (type: typeof empty | DocumentType) => ({ name: type.name, instructions: type.instructions || '', required: type.required, active: type.active, sort_order: type.sort_order })
export function HrDocumentsSettings(props: RelatedEditorProps = {}) {
  const { company } = useTenant(), { hasPermission } = useAuthPermissions(), { toast } = useToast(), qc = useQueryClient()
  const canManage = hasPermission('settings.manage')
  const [editing, setEditing] = useState<DocumentType | null>(null), [open, setOpen] = useState(false), [form, setForm] = useState(empty)
  const [discard, setDiscard] = useState(false)
  const baseline = useRef(empty)
  const dirty = open && JSON.stringify(form) !== JSON.stringify(baseline.current)
  const scope = useRelatedSettingsEditor(props, dirty)
  const dialogOwner = useRef<ReturnType<typeof scope.capture> | null>(null)
  const query = useQuery({ queryKey: ['hr-document-types', scope.companyId, 'administrative', scope.userId], queryFn: ({ signal }) => fetchHrDocumentTypes({ includeInactive: true }, { headers: scope.headers, signal }), enabled: !!scope.companyId && !!scope.userId && scope.isCurrent() })
  const editable = !scope.disabled && !scope.pending
  function start(type?: DocumentType) {
    if (!editable || !scope.isCurrent()) return
    const value = documentForm(type || empty); baseline.current = value; dialogOwner.current = scope.capture()
    setEditing(type || null); setForm(value); setDiscard(false); setOpen(true)
  }
  function change<K extends keyof typeof empty>(field: K, value: (typeof empty)[K]) {
    if (!editable || !dialogOwner.current || !scope.isCurrent(dialogOwner.current)) return
    setForm(old => ({ ...old, [field]: value }))
  }
  function close() {
    if (scope.pending) return
    if (dirty) setDiscard(true)
    else setOpen(false)
  }
  async function save() {
    if (!dialogOwner.current || !scope.isCurrent(dialogOwner.current) || !form.name.trim() || !Number.isSafeInteger(form.sort_order) || form.sort_order < 0) return
    const ticket = scope.begin(); if (!ticket) return
    const payload = structuredClone(form), id = editing?.id, headers = scope.headers
    let persisted = false
    try {
      if (id) await updateHrDocumentType(id, payload, { headers })
      else await createHrDocumentType(payload, { headers })
      persisted = true
      if (!scope.isCurrent(ticket)) return
      baseline.current = payload; setOpen(false)
      await Promise.all([qc.invalidateQueries({ queryKey: ['hr-document-types', scope.companyId] }, { throwOnError: true }), qc.invalidateQueries({ queryKey: ['hr-employee-documents'], refetchType: 'none' })])
      if (!scope.isCurrent(ticket)) return
      toast({ title: 'Requisito documental guardado' })
    } catch (error) {
      if (!scope.isCurrent(ticket)) return
      toast({ title: persisted ? 'Requisito guardado; no se pudo actualizar la lista.' : 'No se pudo guardar', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: persisted ? undefined : 'destructive' })
    } finally { scope.end(ticket) }
  }
  const visibleDialog = open && props.active !== false && !!dialogOwner.current && scope.isCurrent(dialogOwner.current)
  return <Card className="config-panel"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-brand-orange" />Expedientes de empleados</CardTitle><CardDescription className="mt-2">Define qué documentos solicita esta empresa. PDF, JPEG o PNG, hasta 5 MB por archivo. Desactivar conserva las versiones existentes y no afecta la nómina.</CardDescription></div>{canManage && <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong shrink-0" disabled={!editable || query.isPending || query.isError} onClick={() => start()}><Plus className="mr-2 h-4 w-4" />Añadir requisito</Button>}</CardHeader><CardContent>
    {query.isFetching && query.data && <LoadingIndicator message="Actualizando requisitos…" />}{query.isError ? <div role="alert"><p>No se pudieron cargar los requisitos.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : <div className="auna-data-table-shell auna-table-embedded overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Instrucciones</TableHead><TableHead>Obligatorio</TableHead><TableHead>Estado</TableHead><TableHead>Orden</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{query.isPending && <TableLoadingRows columns={6} message="Cargando requisitos…" />}{query.data?.items.map(type => <TableRow key={type.id}><TableCell className="font-medium">{type.name}</TableCell><TableCell>{type.instructions || 'Sin instrucciones'}</TableCell><TableCell>{type.required ? 'Sí' : 'Opcional'}</TableCell><TableCell>{type.active ? 'Activo' : 'Inactivo'}</TableCell><TableCell>{type.sort_order}</TableCell><TableCell className="text-right">{canManage && <Button variant="ghost" size="icon" disabled={!editable} aria-label={`Editar ${type.name}`} onClick={() => start(type)}><Pencil className="h-4 w-4" /></Button>}</TableCell></TableRow>)}{!query.isPending && !query.data?.items.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground"><CollectionEmptyState compact title="Cada expediente, con sus requisitos" description="Configura los documentos que necesitas. Mientras tanto, puedes crear empleados sin documentos." action={canManage && <Button disabled={!editable} onClick={() => start()}>Nuevo requisito</Button>} /></TableCell></TableRow>}</TableBody></Table></div>}
    <Dialog open={visibleDialog} onOpenChange={value => { if (!value) close() }}><DialogContent variant="auna"><DialogHeader><DialogTitle>{editing ? 'Editar requisito' : 'Nuevo requisito documental'}</DialogTitle><DialogDescription>Este requisito se aplica solo a {company?.name || 'la empresa activa'}. Los cambios se guardan al confirmar.</DialogDescription></DialogHeader><form onSubmit={async e => { e.preventDefault(); await save() }} className="space-y-4"><div><Label htmlFor="hr-type-name">Nombre</Label><Input id="hr-type-name" required maxLength={100} disabled={!editable} value={form.name} onChange={e => change('name', e.target.value)} /></div><div><Label htmlFor="hr-type-instructions">Instrucciones</Label><Textarea id="hr-type-instructions" maxLength={500} disabled={!editable} value={form.instructions} onChange={e => change('instructions', e.target.value)} /></div><div><Label htmlFor="hr-type-order">Orden</Label><Input id="hr-type-order" type="number" min={0} step={1} required disabled={!editable} value={form.sort_order} onChange={e => change('sort_order', Number(e.target.value))} /></div><div className="flex items-center justify-between"><Label htmlFor="hr-type-required">Obligatorio al crear empleado</Label><Switch id="hr-type-required" disabled={!editable} checked={form.required} onCheckedChange={required => change('required', required)} /></div><div className="flex items-center justify-between"><Label htmlFor="hr-type-active">Activo</Label><Switch id="hr-type-active" disabled={!editable} checked={form.active} onCheckedChange={active => change('active', active)} /></div>{editing && !form.active && <p className="text-sm text-muted-foreground">Se dejará de solicitar este documento. Los archivos existentes se conservarán.</p>}<DialogFooter><Button type="button" variant="outline" disabled={scope.pending} onClick={close}>Cancelar</Button><Button type="submit" disabled={!editable || !form.name.trim()} className="bg-brand-orange text-white hover:bg-brand-orange-strong">{scope.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar requisito</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={discard && visibleDialog} onOpenChange={setDiscard}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>¿Descartar cambios del requisito?</AlertDialogTitle><AlertDialogDescription>Los cambios sin guardar de este requisito se perderán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction disabled={scope.pending} onClick={() => { if (!scope.pending) { setOpen(false); setDiscard(false); setForm(baseline.current) } }}>Descartar cambios</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CardContent></Card>
}
