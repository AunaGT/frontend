import {Eye,Pencil} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Card,CardContent} from '@/components/ui/card'
import {recordCardNavigation} from '@/components/shared/recordCardNavigation'
import {CatalogImage} from '../components/CatalogImage'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import type {PackageSummary} from './types'

export function PackageStatus({row}:{row:PackageSummary}){
 return <Badge variant="secondary" className={!row.archivedAt&&row.activeVersion?'border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300':undefined}>{row.archivedAt?'Archivado':row.activeVersion?'Activo · v'+row.activeVersion:'Borrador'}</Badge>
}
export function packageMoney(value:string|null|undefined,currency:string,locale:string){
 return value==null?'Sin precio':new Intl.NumberFormat(locale,{style:'currency',currency}).format(Number(value))
}
export function PackageResults({rows,viewMode,canEdit,onView,onEdit,containerRef}:{rows:PackageSummary[];viewMode:'cards'|'table';canEdit:boolean;onView:(id:string)=>void;onEdit:(id:string)=>void;containerRef?:(node:HTMLDivElement|null)=>void}){
 const {locale='es-GT',currencyCode='GTQ'}=useSystemSettings()
 const price=(r:PackageSummary)=>(r.priceFrom!==r.priceTo&&r.priceFrom!=null?'Desde ':'')+packageMoney(r.priceFrom,r.currency||currencyCode,locale)
 const actions=(r:PackageSummary)=><div className="flex shrink-0 justify-end gap-1"><Button variant="outline" size="icon" aria-label={'Vista previa de '+r.name} onClick={()=>onView(r.id)}><Eye className="h-4 w-4" aria-hidden="true"/></Button>{canEdit&&!r.archivedAt&&<Button variant="ghost" size="icon" aria-label={'Editar '+r.name} onClick={()=>onEdit(r.id)}><Pencil className="h-4 w-4" aria-hidden="true"/></Button>}</div>
 if(viewMode==='table')return <div className="auna-data-table-shell"><div className="overflow-x-auto" role="region" aria-label="Tabla de paquetes" tabIndex={0}><table className="auna-data-table min-w-[850px]"><caption className="sr-only">Paquetes, opciones, precios y estado</caption><thead><tr><th scope="col">Paquete</th><th scope="col">Opciones</th><th scope="col">Precio guardado</th><th scope="col">Sucursales</th><th scope="col">Estado</th><th scope="col" className="text-right">Acciones</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th scope="row"><div className="flex items-center gap-3"><CatalogImage name={r.name} src={r.imageUrl} className="h-10 w-10 shrink-0"/><Button variant="link" className="h-auto whitespace-normal p-0 text-left font-semibold text-foreground" onClick={()=>onView(r.id)}>{r.name||'Paquete sin nombre'}</Button></div></th><td>{r.variantCount??'—'}</td><td className="whitespace-nowrap font-semibold tabular-nums">{price(r)}</td><td>{r.branchIds.length}</td><td><PackageStatus row={r}/></td><td>{actions(r)}</td></tr>)}</tbody></table></div></div>
 return <div role="region" aria-label="Tarjetas de paquetes" className="min-w-0"><div ref={containerRef} className="auna-record-grid">{rows.map(r=><Card key={r.id} className="product-card auna-surface auna-record-interactive h-full" {...recordCardNavigation(()=>onView(r.id))}><CardContent className="auna-record-card"><CatalogImage name={r.name} src={r.imageUrl} className="auna-record-media"/><div className="auna-record-content"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 text-sm font-semibold leading-snug">{r.name||'Paquete sin nombre'}</strong><PackageStatus row={r}/></div><p className="mt-1 text-xs text-muted-foreground">{r.variantCount??0} opciones · {r.branchIds.length} {r.branchIds.length===1?'sucursal':'sucursales'}</p><div className="mt-2"><p className="text-sm font-semibold tabular-nums">{price(r)}</p><p className="text-xs text-muted-foreground">Precio guardado</p></div></div></CardContent></Card>)}</div></div>
}
