import {ModuleTabBar} from '@/components/shared/ModuleTabs'

export type InventoryCatalog = 'goods' | 'services' | 'packages'

export function InventoryCatalogNav({value,servicesEnabled,onValueChange}:{value:InventoryCatalog;servicesEnabled:boolean;onValueChange:(value:InventoryCatalog)=>void}){
 const items:{value:InventoryCatalog;label:string}[]=[{value:'goods',label:'Productos'},...(servicesEnabled?[{value:'services' as const,label:'Servicios'}]:[]),{value:'packages',label:'Paquetes'}]
 return <ModuleTabBar items={items} value={value} onValueChange={onValueChange} ariaLabel="Catálogo de inventario"/>
}
