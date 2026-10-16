import { useSearchParams } from 'react-router-dom'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ModuleTabsList, ModuleTabsTrigger } from '@/components/shared/ModuleTabs'
import { CreditCard, CalendarDays, Tags, Wallet } from 'lucide-react'
import { PaymentMethodsTab } from '../components/PaymentMethodsTab'
import { CashRegistersTab } from '../components/CashRegistersTab'
import { ProductCategoriesPanel } from '../components/ProductCategoriesPanel'
import { PaymentTermsPanel } from '../components/PaymentTermsPanel'
import '../catalogs.css'
export function CatalogsManagement() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = ['categories', 'payment-terms', 'cash-registers', 'payment-methods'].includes(requestedTab ?? '') ? requestedTab! : 'categories'
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true })
  usePageTrail([{ label: ({categories:'Categorías','cash-registers':'Cajas','payment-methods':'Métodos de pago','payment-terms':'Términos de pago'} as Record<string,string>)[activeTab] || 'Datos maestros' }])
  return (
    <div className="catalogs-page mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
      <h1 className="sr-only">Datos maestros</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <ModuleTabsList aria-label="Catálogos de datos maestros">
            <ModuleTabsTrigger value="categories"><Tags className="h-4 w-4" />Categorías</ModuleTabsTrigger>
            <ModuleTabsTrigger value="cash-registers"><Wallet className="h-4 w-4" />Cajas</ModuleTabsTrigger>
            <ModuleTabsTrigger value="payment-methods" className="whitespace-nowrap">
              <CreditCard className="h-4 w-4" />Métodos de pago
            </ModuleTabsTrigger>
            <ModuleTabsTrigger value="payment-terms" className="whitespace-nowrap">
              <CalendarDays className="h-4 w-4" />Términos de pago
            </ModuleTabsTrigger>
          </ModuleTabsList>
        </div>

        <TabsContent value="payment-methods" className="space-y-5 mt-5">
          <PaymentMethodsTab />
        </TabsContent>

        <TabsContent value="payment-terms" className="space-y-5 mt-5">
          <PaymentTermsPanel />
        </TabsContent>

        <TabsContent value="categories" className="space-y-5 mt-5">
          <ProductCategoriesPanel />
        </TabsContent>

        <TabsContent value="cash-registers" className="space-y-5 mt-5">
          <CashRegistersTab />
        </TabsContent>
      </Tabs>

    </div>
  )
}
