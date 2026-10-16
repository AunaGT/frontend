import { catalogsModule } from '@/modules/catalogs/manifest'
const Panel = catalogsModule.pages.Panel
export default function CatalogSettingsPage({ kind }: { kind: 'cash-registers' | 'payment-methods' | 'payment-terms' }) { return <Panel kind={kind} /> }
