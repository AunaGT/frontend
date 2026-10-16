import { catalogsModule } from './manifest'
import { matchPath } from 'react-router-dom'

/** Los enlaces guardados seleccionan un destino interno; nunca una URL de retorno. */
export function legacyCatalogDestination(pathname: string, search: string): string {
  const paths = catalogsModule.paths
  const params = new URLSearchParams(search)
  const importing = !!(matchPath(paths.import, pathname) || matchPath(paths.legacyImport, pathname))
  const selector = params.get(importing ? 'type' : 'tab')
  const destinations = new Map<string, string>([
    ['cash-registers', paths.cashRegisters],
    ['payment-methods', paths.paymentMethods],
    ['payment-terms', paths.paymentTerms],
  ])
  const destination = importing
    ? selector === 'payment-terms' ? paths.paymentTermsImport : paths.categoriesImport
    : destinations.get(selector ?? '') ?? paths.categories
  params.delete('tab'); params.delete('type')
  const query = params.toString()
  return destination + (query ? `?${query}` : '')
}
