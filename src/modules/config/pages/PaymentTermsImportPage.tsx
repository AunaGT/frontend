import { catalogsModule } from '@/modules/catalogs/manifest'
const Import = catalogsModule.pages.Import
export default function PaymentTermsImportPage() { return <Import catalogType="payment-terms" backPath={catalogsModule.paths.paymentTerms} /> }
