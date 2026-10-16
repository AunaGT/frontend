import { catalogsModule } from '@/modules/catalogs/manifest'
const Import = catalogsModule.pages.Import
export default function CategoryImportPage() { return <Import catalogType="categories" backPath={catalogsModule.paths.categories} /> }
