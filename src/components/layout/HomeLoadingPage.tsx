import { LoadingState } from '@/components/shared/LoadingState'
import { Skeleton } from '@/components/ui/skeleton'

/** Public placeholders only: no cached identity, tenant data, queries or private routes. */
export function HomeModuleLoading() {
  return <LoadingState message="Preparando Inicio…" variant="cards" rows={9} />
}

export function HomeLoadingPage() {
  return <div aria-label="Inicio" aria-busy="true" className="min-h-screen bg-brand-surface dark:bg-brand-navy">
    <header aria-hidden="true" className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
      <Skeleton className="h-7 w-32" /><Skeleton className="h-8 w-8 rounded-full" />
    </header>
    <main className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="sr-only">Inicio</h1>
      <div aria-hidden="true" className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-72 max-w-full" /></div>
        <Skeleton className="h-20 w-52 rounded-xl" />
      </div>
      <Skeleton aria-hidden="true" className="mt-6 h-10 w-full" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <HomeModuleLoading />
        <aside aria-hidden="true" className="space-y-4"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-36 w-full rounded-xl" /></aside>
      </div>
    </main>
  </div>
}
