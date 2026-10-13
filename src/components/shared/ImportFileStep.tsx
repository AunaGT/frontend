import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { downloadFile, getAuthToken } from '@/services/api'
import { ImportWizardSteps } from './ImportWizardSteps'
import { validateImportFile } from './importFile.mjs'

export function ImportFileStep({ title, description, templatePath, templateName, backLabel, onBack, onFile }: {
  title: string
  description: string
  templatePath: string
  templateName: string
  backLabel: string
  onBack: () => void
  onFile: (file: File) => void
}) {
  const [error, setError] = useState('')
  const accept = (file?: File) => {
    if (!file) return
    const problem = validateImportFile(file)
    setError(problem || '')
    if (!problem) onFile(file)
  }
  return <main className="auna-import-page">
    <div className="auna-import-container">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>← {backLabel}</Button>
      <h1 className="auna-import-title">{title}</h1>
      <p className="auna-import-subtitle">{description}</p>
    </div>
    <ImportWizardSteps current={1} />
    <section className="auna-import-upload-panel auna-import-container" aria-label="Cargar archivo">
      <header><h2>1. Cargar archivo</h2><p>Selecciona un archivo antes de mapear y validar los datos.</p></header>
      <div className="auna-import-upload-grid">
        <ImageUploadDropzone className="auna-import-file-drop" accept=".xlsx,.xls,.csv" maxSizeBytes={10 * 1024 * 1024} fileLabel="archivo" formatsLabel="XLSX, XLS o CSV" validateFile={validateImportFile} onReject={setError} onFileSelect={accept} />
        <div className="auna-import-upload-help"><FileSpreadsheet size={26} /><h3>Usa la plantilla del módulo</h3><p>La primera fila debe contener los nombres de las columnas. Podrás revisar el mapeo y los errores antes de guardar datos.</p><Button type="button" variant="outline" onClick={() => { const token = getAuthToken(); void downloadFile(templatePath, templateName, token ? { Authorization: `Bearer ${token}` } : undefined).catch(error => setError(error instanceof Error ? error.message : 'No se pudo descargar la plantilla.')) }}><Download size={16} className="mr-2" />Descargar plantilla</Button></div>
      </div>
      {error && <p className="auna-import-error" role="alert">{error}</p>}
    </section>
  </main>
}
