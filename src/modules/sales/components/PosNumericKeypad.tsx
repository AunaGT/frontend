import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PosNumericKeypad({ disabled = false, decimalEnabled = true, onKey }: {
  disabled?: boolean
  decimalEnabled?: boolean
  onKey: (key: string) => void
}) {
  return <div className="pos-numeric-keypad" role="group" aria-label="Teclado numérico">
    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'decimal', '0', 'backspace'].map(key => {
      const blocked = disabled || (key === 'decimal' && !decimalEnabled)
      return <Button key={key} type="button" variant="outline" disabled={blocked}
        aria-label={key === 'decimal' ? 'Separador decimal' : key === 'backspace' ? 'Borrar último dígito' : `Número ${key}`}
        onClick={() => { if (!blocked) onKey(key) }}>
        {key === 'decimal' ? '.' : key === 'backspace' ? <Delete className="h-5 w-5" aria-hidden="true" /> : key}
      </Button>
    })}
  </div>
}
