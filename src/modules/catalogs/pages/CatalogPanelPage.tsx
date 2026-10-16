import { usePageTrail } from '@/components/layout/PageNavigation'
import { ProductCategoriesPanel } from '../components/ProductCategoriesPanel'
import { PaymentTermsPanel } from '../components/PaymentTermsPanel'
import { PaymentMethodsTab } from '../components/PaymentMethodsTab'
import { CashRegistersTab } from '../components/CashRegistersTab'
import '../catalogs.css'
import { CatalogAccess } from '../components/CatalogAccess'

export type CatalogKind = 'categories' | 'cash-registers' | 'payment-methods' | 'payment-terms'
const labels = { categories: 'Categorías', 'cash-registers': 'Cajas', 'payment-methods': 'Métodos de pago', 'payment-terms': 'Condiciones de pago' }
const panels = { categories: ProductCategoriesPanel, 'cash-registers': CashRegistersTab, 'payment-methods': PaymentMethodsTab, 'payment-terms': PaymentTermsPanel }

export default function CatalogPanelPage({ kind }: { kind: CatalogKind }) {
  usePageTrail([{ label: labels[kind] }])
  const Panel = panels[kind]
  return <CatalogAccess kind={kind}><div className="catalogs-page mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8"><h1 className="sr-only">{labels[kind]}</h1><Panel /></div></CatalogAccess>
}
