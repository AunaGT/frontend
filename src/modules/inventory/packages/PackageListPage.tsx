import {useEffect,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {InventoryCatalogNav} from '../components/InventoryCatalogNav'
import {Pagination} from '@/components/shared/Pagination'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {Plus,Search,ChevronDown} from 'lucide-react'
import {CompactFilterPanel} from '@/components/shared/CompactFilterPanel'
import {QuickProductScan} from '@/components/scanner/QuickProductScan'
import {Switch} from '@/components/ui/switch'
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Badge} from '@/components/ui/badge'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {usePackageScope} from './usePackageScope'
import {fetchPackages,packageError} from './api'
import type {PackageScope,PackageSummary} from './types'
export function PackageLibrary({scope,canEdit}:{scope:PackageScope;canEdit:boolean}){
 const navigate=useNavigate(),{inventoryServicesEnabled}=useSystemSettings()
 const [rows,setRows]=useState<PackageSummary[]>([]),[search,setSearch]=useState(''),[cursor,setCursor]=useState<string|undefined>(),[back,setBack]=useState<(string|undefined)[]>([]),[next,setNext]=useState<string|null>(null),[archived,setArchived]=useState(false),[pending,setPending]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0)
 useEffect(()=>{const abort=new AbortController();setPending(true);setNext(null);setError('');const timer=setTimeout(()=>void fetchPackages(scope,{q:search,cursor,includeArchived:archived},abort.signal).then(r=>{if(!abort.signal.aborted){setRows(r.items);setNext(r.nextCursor)}}).catch(e=>{if(!abort.signal.aborted)setError(packageError(e))}).finally(()=>{if(!abort.signal.aborted)setPending(false)}),150);return()=>{clearTimeout(timer);abort.abort()}},[scope,search,cursor,archived,reload])
 return <main className="inventory-products-page auna-page-fluid mx-auto w-full min-w-0 p-4 sm:p-8 space-y-5"><h1 className="sr-only">Paquetes comerciales</h1>
 <InventoryCatalogNav value="packages" servicesEnabled={inventoryServicesEnabled} onValueChange={value=>{if(value!=='packages')navigate(value==='services'?'/inventario?tipo=services':'/inventario')}}/>
 <div className="auna-list-toolbar space-y-3">
  <CompactFilterPanel title="Filtros de paquetes" activeCount={archived?1:0} onClear={()=>{setArchived(false);setCursor(undefined);setBack([])}} appliedFilters={archived?[{label:'Incluye archivados',onRemove:()=>{setArchived(false);setCursor(undefined);setBack([])}}]:[]}
   search={<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/><Input id="package-search" aria-label="Buscar paquetes" className="pl-10" value={search} onChange={e=>{setSearch(e.target.value);setCursor(undefined);setBack([])}} placeholder="Buscar por nombre del paquete…"/></div>}
   actions={<div className="flex flex-wrap items-center justify-end gap-2 shrink-0"><QuickProductScan label="Localizar por código"/><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label="Menú de acciones del inventario">Acciones<ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>navigate('/inventario/unidades')}>Unidades y presentaciones</DropdownMenuItem></DropdownMenuContent></DropdownMenu>{canEdit&&<Button size="sm" asChild><Link to="/inventario/paquetes/nuevo"><Plus className="h-4 w-4" aria-hidden="true"/>Nuevo paquete</Link></Button>}</div>}>
   <div className="flex min-h-10 items-center gap-2"><Switch id="package-archived" checked={archived} onCheckedChange={value=>{setArchived(value);setCursor(undefined);setBack([])}}/><Label htmlFor="package-archived" className="text-sm font-normal">Incluir archivados</Label></div>
  </CompactFilterPanel>
 </div>
 <section className="auna-surface-flat min-w-0 space-y-4" aria-labelledby="packages-results-heading">
 <div><h2 id="packages-results-heading" className="text-base font-semibold">Paquetes {!pending&&!error&&<span className="font-normal text-muted-foreground">· {rows.length} en esta página</span>}</h2><p className="mt-1 text-sm text-muted-foreground">Combina productos y servicios sin duplicar existencias. Las opciones se acuerdan al cotizar.</p></div>
 {error?<div role="alert" className="rounded-lg border border-destructive/40 p-3">{error}<Button variant="outline" onClick={()=>setReload(n=>n+1)}>Reintentar</Button></div>:pending?<p role="status">Cargando paquetes…</p>:!rows.length?<CollectionEmptyState title="Todo lo que ofreces, en un paquete" description="Reúne artículos y servicios de tu catálogo sin duplicar existencias ni precios de venta." filtered={!!search||archived} onReset={()=>{setSearch('');setArchived(false);setCursor(undefined);setBack([])}} action={canEdit?<Button asChild><Link to="/inventario/paquetes/nuevo">Crear primer paquete</Link></Button>:undefined}/>:<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(row=><li key={row.id} className="rounded-xl border bg-card p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold break-words">{row.name||'Paquete sin nombre'}</h3><Badge variant="secondary">{row.archivedAt?'Archivado':row.activeVersion?'Activo · v'+row.activeVersion:'Borrador'}</Badge></div><p className="text-sm text-muted-foreground">{row.branchIds.length} {row.branchIds.length===1?'sucursal':'sucursales'} · Revisión {row.version}</p><Button variant="outline" asChild><Link to={'/inventario/paquetes/'+row.id+'/editar'}>{canEdit&&!row.archivedAt?'Editar paquete':'Ver paquete'}</Link></Button></li>)}</ul>}
 </section>
 <Pagination currentPage={back.length+1} itemLabel="paquetes" loading={pending} hasPrevPage={back.length>0} hasNextPage={!error&&!!next} onPageChange={page=>{if(pending)return;if(page===back.length&&back.length){setCursor(back.at(-1));setBack(rows=>rows.slice(0,-1))}else if(!error&&page===back.length+2&&next){setBack(rows=>[...rows,cursor]);setCursor(next)}}}/></main>
}
export default function PackageListPage(){const context=usePackageScope();if(!context.scope||!context.canRead)return <p className="p-6" role="status">Selecciona una empresa y sucursal con permiso para consultar Inventario.</p>;return <PackageLibrary key={context.key} scope={context.scope} canEdit={context.canEdit}/>}
