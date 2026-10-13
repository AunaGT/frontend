import { ArrowRight, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AunaBrand } from '@/components/branding/AunaBrand'
import { Button } from '@/components/ui/button'

const NotFound = () => (
  <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-brand-surface text-brand-navy dark:bg-brand-navy dark:text-white">
    <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" aria-hidden="true" />

    <header className="auna-not-found-inner relative flex items-center justify-between px-6 py-7 sm:px-10">
      <Link to="/" aria-label="Volver al inicio de Auna ERP">
        <AunaBrand logoClassName="w-28 sm:w-32" />
      </Link>
      <span className="rounded-full border border-brand-navy/10 bg-white/70 px-3 py-1.5 text-xs font-semibold tracking-wide dark:border-white/15 dark:bg-white/5">
        ERROR 404
      </span>
    </header>

    <main className="auna-not-found-inner auna-not-found-main relative grid flex-1 items-center gap-12 px-6 pb-16 pt-8 sm:px-10 lg:gap-16">
      <section className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">Página no encontrada</p>
        <h1 className="auna-not-found-title mt-5 font-semibold leading-tight tracking-tight">
          Parece que tomaste otra ruta.
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
          No encontramos la página que buscas. Regresa al inicio y continúa con los módulos de tu empresa.
        </p>
        <Button asChild className="mt-9 h-12 rounded-xl bg-brand-orange px-6 text-white shadow-lg shadow-brand-orange/20 hover:bg-brand-orange-strong focus-visible:ring-brand-orange">
          <Link to="/">Volver al inicio <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
        </Button>
      </section>

      <div className="auna-not-found-visual relative mx-auto flex items-center justify-center overflow-hidden border border-white/80 bg-white/70 dark:border-white/10 dark:bg-white/5" aria-hidden="true">
        <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border-[42px] border-brand-orange/10" />
        <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full border-[35px] border-blue-500/10" />
        <span className="auna-not-found-code relative -mt-8 select-none font-black leading-none">
          4<span className="text-brand-orange">0</span>4
        </span>
        <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-xl border border-brand-navy/10 bg-white px-4 py-3 text-sm font-medium shadow-lg dark:border-white/10 dark:bg-slate-800">
          <SearchX className="h-5 w-5 text-brand-orange" />
          Ruta no disponible
        </div>
      </div>
    </main>

    <footer className="auna-not-found-inner relative border-t border-brand-navy/10 px-6 py-5 text-xs text-muted-foreground sm:px-10 dark:border-white/10">
      Auna ERP · Tu negocio en movimiento
    </footer>
  </div>
)

export default NotFound
