import { LoadingState } from '@/components/shared/LoadingState'
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTenant } from '@/context/useTenant'
import { useToast } from '@/hooks/use-toast'
import { fetchHrDocumentTypes, type DocumentSelection, type DocumentType } from '@/services/hrService'

function DocumentRow({ type, selection, disabled, onSelect, onRemove }: { type: DocumentType; selection?: DocumentSelection; disabled: boolean; onSelect: (file: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null), { toast } = useToast()
  const select = (file?: File) => {
    if (!file || disabled) return
    if (!file.size || file.size > 5 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { toast({ title: 'Archivo no válido', description: 'Usa PDF, JPEG o PNG, hasta 5 MB.', variant: 'destructive' }); return }
    onSelect(file)
  }
  return <div className="hr-document-row"><div className="flex items-start gap-3"><FileText className="h-7 w-7 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="font-medium text-sm">{type.name}{type.required && <span className="text-brand-orange"> *</span>}</p>{type.instructions && <p className="mt-1 text-xs text-muted-foreground">{type.instructions}</p>}</div><Badge variant="outline" className={selection ? 'text-emerald-600 dark:text-emerald-300 shrink-0' : 'shrink-0'}>{selection ? <><CheckCircle2 className="mr-1 h-3 w-3" />Seleccionado</> : type.required ? 'Pendiente' : 'Opcional'}</Badge></div>
    <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-label={`Archivo para ${type.name}`} disabled={disabled} onChange={e => { select(e.target.files?.[0]); e.target.value = '' }} />
    <button type="button" className="auna-file-dropzone hr-document-dropzone" disabled={disabled} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); select(e.dataTransfer.files[0]) }}><UploadCloud className="h-6 w-6 shrink-0" /><span className="min-w-0 text-left"><span className="block text-xs break-all">{selection?.file.name || 'Arrastra un archivo o haz clic para seleccionar'}</span><span className="block text-[11px] text-muted-foreground mt-1">{selection ? `${(selection.file.size / 1024).toFixed(0)} KB · se guardará con el empleado` : 'PDF, JPG o PNG (máx. 5 MB)'}</span></span></button>
    {selection && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>Retirar selección</Button>}
  </div>
}
export function EmployeeDocumentsPanel({ selections, onChange, disabled }: { selections: DocumentSelection[]; onChange: (files: DocumentSelection[]) => void; disabled: boolean }) {
  const { company } = useTenant()
  const query = useQuery({ queryKey: ['hr-document-types', company?.id, 'active'], queryFn: () => fetchHrDocumentTypes() })
  return <Card className="hr-panel"><CardHeader><CardTitle><FileText />Documentos</CardTitle><p className="text-xs text-muted-foreground">Adjunta los documentos definidos por tu empresa. PDF, JPG o PNG, hasta 5 MB por archivo.</p></CardHeader><CardContent className="space-y-3">
    {query.isPending ? <LoadingState variant="cards" message="Cargando requisitos…" /> : query.isError ? <div role="alert"><p className="text-sm">No se pudieron cargar los requisitos.</p><Button type="button" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : query.data.items.length ? query.data.items.map(type => <DocumentRow key={type.id} type={type} selection={selections.find(s => s.typeId === type.id)} disabled={disabled} onSelect={file => onChange([...selections.filter(s => s.typeId !== type.id), { typeId: type.id, file }])} onRemove={() => onChange(selections.filter(s => s.typeId !== type.id))} />) : <div className="hr-document-row text-sm text-muted-foreground">Esta empresa todavía no solicita documentos. Puedes guardar el empleado sin adjuntos.<Link className="block mt-3 text-brand-orange" to="/configuracion">Configurar expedientes en Configuración</Link></div>}
    {selections.filter(selection => query.data && !query.data.items.some(t => t.id === selection.typeId)).map(selection => <div key={selection.typeId} role="alert" className="text-sm"><p>El requisito de {selection.file.name} dejó de estar disponible.</p><Button type="button" variant="outline" disabled={disabled} onClick={() => onChange(selections.filter(s => s !== selection))}>Retirar selección</Button></div>)}
  </CardContent></Card>
}
