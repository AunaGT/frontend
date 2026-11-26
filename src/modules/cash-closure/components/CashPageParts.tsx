import type { ReactNode } from 'react'
import { ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Piezas comunes de las páginas de efectivo (movimientos, traslados, entrega de turno, custodias).
export function CashPageHeader({ title, subtitle, backLabel, onBack, actions }: { title: string; subtitle: ReactNode; backLabel: string; onBack: () => void; actions?: ReactNode }) {
  return <header className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:flex sm:flex-wrap sm:items-center">
    <Button variant="outline" size="icon" aria-label={backLabel} onClick={onBack}><ArrowLeft aria-hidden size={18} /></Button>
    <div className="min-w-0 sm:flex-1"><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
    {actions&&<div className="col-span-2 flex flex-wrap justify-end gap-2 sm:ml-auto">{actions}</div>}
  </header>
}
export function Notice({ children, role }: { children: ReactNode; role?: 'alert' }) {
  return <div role={role} className="auna-surface flex items-start gap-2 rounded-xl border p-4 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{children}</div>
}
export function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-3' : undefined}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words">{children}</dd></div>
}
