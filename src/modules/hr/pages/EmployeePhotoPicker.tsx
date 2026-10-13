import { UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'

export function EmployeePhotoPicker({ preview, onFileSelect, onReject, disabled, isUploading, selectionLabel, onClearSelection }: {
  preview?: string; onFileSelect: (file: File) => void; onReject: (message: string) => void; disabled?: boolean; isUploading?: boolean; selectionLabel?: string | null; onClearSelection?: () => void
}) {
  return <Card className="auna-surface hr-panel hr-photo-picker"><CardHeader><CardTitle><UserRound />Fotografía del empleado</CardTitle></CardHeader><CardContent><div className="flex items-start gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted/30">{preview ? <img src={preview} alt="Vista previa de la fotografía del empleado" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9 text-muted-foreground" />}</div><ImageUploadDropzone className="min-w-0 flex-1" onFileSelect={onFileSelect} onReject={onReject} disabled={disabled} isUploading={isUploading} accept="image/jpeg,image/png" formatsLabel="JPG, PNG" fileLabel="imagen" validateFile={file => !file.size ? 'La imagen está vacía.' : !['image/jpeg', 'image/png'].includes(file.type) ? 'Selecciona una imagen JPG o PNG.' : null} selectionLabel={selectionLabel} onClearSelection={onClearSelection} helperText="Opcional. Se conserva en el expediente privado." /></div></CardContent></Card>
}
