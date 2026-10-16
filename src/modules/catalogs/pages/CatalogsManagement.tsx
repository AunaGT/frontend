import { Navigate, useLocation } from 'react-router-dom'
import { legacyCatalogDestination } from '../navigation'

/** Compatibilidad sin montar editores ni iniciar consultas del catálogo anterior. */
export function CatalogsManagement() {
  const { pathname, search } = useLocation()
  return <Navigate to={legacyCatalogDestination(pathname, search)} replace />
}
