import { BarcodeLookup } from '@/components/shared/BarcodeLookup'
import { usePageTrail } from '@/components/layout/PageNavigation'
const ScannerManagement = () => {
  usePageTrail([{label:'Lector de códigos'}])
  return <main className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8"><h1 className="sr-only">Lector de códigos</h1><BarcodeLookup /></main>
}
export default ScannerManagement
