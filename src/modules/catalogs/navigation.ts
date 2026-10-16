import { catalogsModule } from './manifest'

/** Los enlaces guardados seleccionan un destino interno; nunca una URL de retorno. */
export function legacyCatalogDestination(pathname: string, search: string): string {
  const paths = catalogsModule.paths
  const params = new URLSearchParams(search)
  const importing = pathname === paths.import || pathname === paths.legacyImport
  const selector = params.get(importing ? 'type' : 'tab')
  const destination = importing
    ? selector === 'payment-terms' ? paths.paymentTermsImport : paths.categoriesImport
    : ({ 'cash-registers': paths.cashRegisters, 'payment-methods': paths.paymentMethods, 'payment-terms': paths.paymentTerms } as Record<string, string>)[selector ?? ''] ?? paths.categories
  params.delete('tab'); params.delete('type')
  const query = params.toString()
  return destination + (query ? `?${query}` : '')
}
