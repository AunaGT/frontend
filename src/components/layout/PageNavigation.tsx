import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { PageTrailItem, PageTrailOverride } from './pageTrail'
import './pageNavigation.css'

const PageNavigationContext = createContext<{ routeKey: string; override: PageTrailOverride | null; setOverride: Dispatch<SetStateAction<PageTrailOverride | null>> } | null>(null)

export function PageNavigationProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageTrailOverride | null>(null)
  const location = useLocation()
  const routeKey = location.pathname + location.search
  const value = useMemo(() => ({ routeKey, override, setOverride }), [routeKey, override])
  return <PageNavigationContext.Provider value={value}>{children}</PageNavigationContext.Provider>
}

export function usePageNavigation() { return useContext(PageNavigationContext) }

export function usePageTrail(items: PageTrailItem[] | null) {
  const context = usePageNavigation()
  const owner = useId()
  const routeKey = context?.routeKey ?? ''
  const serialized = JSON.stringify(items)
  const setOverride = context?.setOverride
  useEffect(() => {
    if (!setOverride || serialized === 'null') return
    setOverride({ owner, routeKey, items: JSON.parse(serialized) as PageTrailItem[] })
    return () => setOverride(previous => previous?.owner === owner ? null : previous)
  }, [setOverride, owner, routeKey, serialized])
}

export function PageBreadcrumbs({ items }: { items: PageTrailItem[] }) {
  if (!items.length) return null
  return <nav className="auna-page-breadcrumbs" aria-label="Navegación de la vista"><ol>{items.map((item, index) => <li key={`${index}-${item.label}`}>
    {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    {index === items.length - 1 ? <span aria-current="page">{item.label}</span> : item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
  </li>)}</ol></nav>
}
