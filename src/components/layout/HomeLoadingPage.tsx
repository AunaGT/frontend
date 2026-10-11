import { LoadingState } from '@/components/shared/LoadingState'
import { Skeleton } from '@/components/ui/skeleton'

/** Public placeholders only: no cached identity, tenant data, queries or private routes. */
export function HomeModuleLoading() {
  return <LoadingState message="Preparando Inicio…" variant="cards" rows={10} className="p-0 [&>div.grid]:lg:grid-cols-3 [&>div.grid]:xl:grid-cols-5" />
}

export function HomeLoadingPage() {
  return <div aria-label="Inicio" aria-busy="true" className="min-h-screen bg-brand-surface dark:bg-brand-navy">
    <header aria-hidden="true" className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
      <Skeleton className="h-7 w-32" /><Skeleton className="h-8 w-8 rounded-full" />
    </header>
    <main className="mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
      <h1 className="sr-only">Inicio</h1>
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-64 max-w-full" /></div>
        <Skeleton className="h-16 w-52 rounded-lg" />
      </div>
      <div aria-hidden="true" className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-3 w-28" /><div className="flex flex-wrap gap-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-28" />)}</div></div>
        <div className="w-full max-w-[420px] space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-full" /></div>
      </div>
      <HomeModuleLoading />
    </main>
  </div>
}
