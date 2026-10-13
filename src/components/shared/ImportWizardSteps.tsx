import { Check } from 'lucide-react'
import './dataTransfer.css'

export function ImportWizardSteps({ current, fileName }: { current: 1 | 2 | 3 | 4; fileName?: string }) {
  return <div className="auna-import-steps-wrap">
    <ol className="auna-import-steps" aria-label="Pasos de importación">
      {['Cargar archivo', 'Mapeo de campos', 'Validación', 'Resultado'].map((label, index) => <li key={label} aria-current={current === index + 1 ? 'step' : undefined} className={index + 1 <= current ? 'is-active' : ''}>
        <span>{index + 1 < current ? <Check size={16} /> : index + 1}</span><strong>{label}</strong>
      </li>)}
    </ol>
    {fileName && <p className="auna-import-file">Archivo seleccionado: <strong>{fileName}</strong></p>}
  </div>
}
