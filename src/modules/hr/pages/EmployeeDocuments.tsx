import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useToast } from '@/hooks/use-toast'
import { accessEmployeeDocument, archiveEmployeeDocument, fetchEmployeeDocuments, uploadEmployeeDocument, type DocumentVersion } from '@/services/hrService'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PdfDocumentPreview } from '@/components/shared/pdf/PdfDocumentPreview'
import { useTenant } from '@/context/useTenant'
import { employeeDocumentPdf } from './employeeDocumentPdf'

export function EmployeeDocuments({ employeeId }: { employeeId: string }) {
  const { hasPermission, user } = useAuthPermissions(), { toast } = useToast(), qc = useQueryClient()
  const [confirmation, setConfirmation] = useState<DocumentVersion | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ file: File; typeId: string } | null>(null)
  const [preview, setPreview] = useState<{ scope: string; item: DocumentVersion; pdf: Blob | null; error: string | null } | null>(null)
  const { company, branch } = useTenant(), canView = hasPermission('hr.documents.view')
  const scope = JSON.stringify([user?.id, company?.id, branch?.id, employeeId, canView])
  const liveScope = useRef(scope), contextVersion = useRef(0), viewVersion = useRef(0), controller = useRef<AbortController | null>(null)
  liveScope.current = scope
  useEffect(() => {
    setPreview(null)
    return () => { contextVersion.current++; viewVersion.current++; controller.current?.abort() }
  }, [scope])
  const closePreview = () => { viewVersion.current++; controller.current?.abort(); setPreview(null) }
  const query = useQuery({ queryKey: ['hr-employee-documents', employeeId], queryFn: () => fetchEmployeeDocuments(employeeId), enabled: canView })
  const operation = useMutation({ onMutate: action => { if ('file' in action) setPendingUpload(action) }, mutationFn: async (action: { file: File; typeId: string } | { document: DocumentVersion }) => {
    if ('file' in action) return uploadEmployeeDocument(employeeId, action.typeId, action.file)
    return archiveEmployeeDocument(employeeId, action.document.id, !!action.document.archived_at)
  }, onSuccess: () => { setPendingUpload(null); setConfirmation(null); qc.invalidateQueries({ queryKey: ['hr-employee-documents', employeeId] }); qc.invalidateQueries({ queryKey: ['hr-employee-overview', employeeId] }); qc.invalidateQueries({ queryKey: ['hr-employee-history', employeeId] }); toast({ title: 'Expediente documental actualizado' }) }, onError: (error: Error) => { qc.invalidateQueries({ queryKey: ['hr-employee-documents', employeeId] }); toast({ title: 'No se pudo actualizar el documento', description: error.message, variant: 'destructive' }) } })
  const access = useMutation({ mutationFn: async ({ item, download }: { item: DocumentVersion; download: boolean }) => {
    if (!canView || liveScope.current !== scope) return
    const owner = scope, epoch = contextVersion.current
    const current = () => liveScope.current === owner && contextVersion.current === epoch
    if (download) {
      try {
        const result = await accessEmployeeDocument(employeeId, item.id, true)
        if (!current()) return
        const link = document.createElement('a'); link.href = result.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; link.click()
      } catch (error) { if (current()) throw error }
      return
    }
    controller.current?.abort()
    const request = new AbortController(), version = ++viewVersion.current
    controller.current = request
    const visible = () => current() && version === viewVersion.current
    setPreview({ scope: owner, item, pdf: null, error: null })
    try {
      const result = await accessEmployeeDocument(employeeId, item.id, false)
      if (!visible()) return
      const response = await fetch(result.url, { signal: request.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error('No se pudo cargar el archivo. Reintenta para obtener un enlace nuevo.')
      const blob = await response.blob()
      if (!visible()) return
      const pdf = await employeeDocumentPdf(blob, item.mime_type)
      if (visible()) setPreview({ scope: owner, item, pdf, error: null })
    } catch (error) {
      if (visible()) setPreview({ scope: owner, item, pdf: null, error: error instanceof Error ? error.message : 'No se pudo preparar la vista previa.' })
    }
  }, onError: (error: Error) => toast({ title: 'No se pudo abrir el archivo', description: error.message, variant: 'destructive' }) })
  if (query.isPending) return <Card className="hr-panel"><CardHeader><CardTitle>Documentos del expediente</CardTitle></CardHeader><CardContent><LoadingState variant="cards" message="Cargando documentos…" /></CardContent></Card>
  if (query.isError) return <div><p>No se pudieron cargar los documentos.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
  return <Card className="hr-panel"><CardHeader><CardTitle><FileText />Documentos del expediente</CardTitle><p className="text-sm text-muted-foreground">PDF, JPEG o PNG · máximo 5 MB. Reemplazar conserva la versión anterior. Los enlaces de acceso caducan.</p></CardHeader><CardContent className="space-y-4">{query.isFetching && <LoadingIndicator message="Actualizando documentos…" />}
    <div className="hr-document-scroll" role="region" aria-label="Documentos del expediente" tabIndex={0}>
    {!!query.data.requirements.length && <ul className="hr-document-list" aria-label="Requisitos documentales">{query.data.requirements.map(type => <li className="hr-document-row" key={type.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{type.name}</strong><p className="text-xs text-muted-foreground">{type.instructions || (type.required ? 'Requerido' : 'Opcional')}</p></div>{hasPermission('hr.documents.manage') && <label className="cursor-pointer text-brand-orange">Cargar o reemplazar<input type="file" className="sr-only" disabled={operation.isPending} accept="application/pdf,image/jpeg,image/png" aria-label={`Cargar ${type.name}`} onChange={e => { const file = e.target.files?.[0]; if (file) operation.mutate({ typeId: type.id, file }); e.target.value = '' }} /></label>}</div><p className="mt-2 text-xs">{query.data.items.some(item => item.type_id === type.id && !item.archived_at) ? 'Documento vigente disponible' : type.required ? 'Pendiente de carga' : 'Sin documento'}</p></li>)}</ul>}
    {pendingUpload && <div className="hr-document-row"><p className="text-sm break-all">{operation.isPending ? 'Cargando' : 'Carga pendiente'}: {pendingUpload.file.name}</p>{!operation.isPending && <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={!query.data.requirements.some(type => type.id === pendingUpload.typeId)} onClick={() => operation.mutate(pendingUpload)}>Reintentar carga</Button><Button size="sm" variant="ghost" onClick={() => setPendingUpload(null)}>Descartar selección</Button></div>}{!query.data.requirements.some(type => type.id === pendingUpload.typeId) && <p className="text-xs text-destructive">El tipo fue desactivado. Conservamos la selección, pero debes elegir un tipo activo para cargarlo.</p>}</div>}
    {!query.data.requirements.length && <CollectionEmptyState compact title="El expediente documental empieza aquí" description="No hay tipos de documento activos para esta empresa. Configura los requisitos para habilitar su carga." />}
    {!!query.data.requirements.length && !query.data.items.length && <CollectionEmptyState compact title="Los documentos tienen su lugar" description="Carga un archivo desde los requisitos del expediente para conservar aquí sus versiones." />}
    {!!query.data.items.length && <ul className="hr-document-list" aria-label="Versiones de documentos">{query.data.items.map(item => <li key={item.id} className="hr-document-row flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><button type="button" className="break-all text-left font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange disabled:opacity-50" aria-label={"Ver "+item.original_name} disabled={access.isPending || !canView} onClick={() => access.mutate({ item, download: false })}>{item.original_name}</button><p className="text-xs text-muted-foreground">{item.archived_at ? 'Versión archivada' : 'Vigente'} · {new Date(item.created_at).toLocaleDateString('es-GT')} · {(item.size_bytes / 1024).toFixed(0)} KB</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={access.isPending || !canView} onClick={() => access.mutate({ item, download: false })}><Eye className="mr-1 h-4 w-4" />Ver</Button><Button variant="outline" size="sm" disabled={access.isPending || !canView} onClick={() => access.mutate({ item, download: true })}><Download className="mr-1 h-4 w-4" />Descargar</Button>{hasPermission('hr.documents.archive') && <Button variant="outline" size="sm" disabled={operation.isPending} onClick={() => setConfirmation(item)}>{item.archived_at ? 'Restaurar' : 'Archivar'}</Button>}</div></li>)}</ul>}
    </div>
    <Dialog open={preview?.scope === scope && canView} onOpenChange={open => { if (!open) closePreview() }}>
      <DialogContent variant="auna" className="max-w-[95vw] max-h-[95dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{preview?.scope === scope ? preview.item.original_name : 'Vista previa del documento'}</DialogTitle><DialogDescription>Vista previa del expediente. La descarga conserva el archivo original.</DialogDescription></DialogHeader>
        {preview?.scope === scope && canView && (preview.pdf ? <PdfDocumentPreview pdf={preview.pdf} downloadLabel="Descargar original" onDownload={() => access.mutate({ item: preview.item, download: true })} /> : preview.error ? <div role="alert" className="space-y-3"><p className="text-sm">{preview.error}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={access.isPending || !canView} onClick={() => access.mutate({ item: preview.item, download: false })}>Reintentar vista previa</Button><Button variant="outline" disabled={access.isPending || !canView} onClick={() => access.mutate({ item: preview.item, download: true })}>Descargar original</Button></div></div> : <LoadingState variant="page" message="Preparando vista previa…" />)}
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open && !operation.isPending) setConfirmation(null) }}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>{confirmation?.archived_at ? 'Restaurar documento' : 'Archivar documento'}</AlertDialogTitle><AlertDialogDescription>{confirmation?.archived_at ? 'Se restaurará solo si no existe otra versión vigente del mismo tipo.' : 'El archivo se conserva en el historial. Si es requerido, el expediente quedará pendiente hasta cargar o restaurar una versión.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={operation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={operation.isPending} onClick={e => { e.preventDefault(); if (confirmation) operation.mutate({ document: confirmation }) }}>{operation.isPending ? 'Guardando…' : 'Confirmar'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CardContent></Card>
}
