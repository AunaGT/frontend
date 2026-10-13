import type { ReactNode } from 'react'
import { BarChart3, Boxes, ShieldCheck } from 'lucide-react'
import { AunaBrand } from '@/components/branding/AunaBrand'

interface AuthLayoutProps {
  children: ReactNode
}

const benefits = [
  { icon: BarChart3, text: 'Información clara para decidir mejor' },
  { icon: Boxes, text: 'Operación conectada en un solo lugar' },
  { icon: ShieldCheck, text: 'Acceso seguro según tu rol' },
]

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-brand-surface text-brand-navy lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-brand-navy px-12 py-10 text-white lg:flex lg:flex-col xl:px-20 xl:py-14">
        <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-brand-orange/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 translate-y-1/3 rounded-full border-[52px] border-brand-orange/10" />

        <AunaBrand inverse showTagline />

        <div className="relative my-auto max-w-xl py-16">
          <span className="inline-flex rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
            Gestión empresarial
          </span>
          <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Todo lo que necesitas para avanzar, en un solo lugar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 xl:text-lg">
            Supervisa ventas, inventario y finanzas con información actualizada de tu empresa.
          </p>

          <ul className="mt-10 grid gap-4 text-sm text-slate-200">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-brand-orange">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">Empresas que avanzan Guatemala</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  )
}
