import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/services/api'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils'
import { formatQuantity } from '@/lib/commercialQuantity'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingState } from '@/components/shared/LoadingState'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'

type HistoryPage = {items:{id:string;item_name:string;unit_label:string;qty:string;net_total:string;price:string;sale:{id:string;reference:string;date:string;customer:string;status:{name:string}}}[];page:number;pageSize:number;totalItems:number;totalPages:number;nextPage:number|null;prevPage:number|null}

export function ProductCommercialHistory({productId}:{productId:string}) {
  const {page,setPage,pageSize,setPageSize}=usePersistedListUiState('inventario/producto/ventas', {defaultPageSize:10})
  const {locale,currencyCode}=useSystemSettings()
  const query=useQuery({queryKey:['product-commercial-history',productId,page,pageSize],queryFn:()=>apiFetch<HistoryPage>(`/api/products/${productId}/commercial-history?page=${page}&pageSize=${pageSize}`)})
  const data=query.data
  if (query.isLoading) return <LoadingState variant="table" message="Cargando historial de ventas…" />
  if (query.isError) return <p role="alert" className="text-sm text-destructive">No se pudo cargar el historial.</p>
  return <section className="space-y-4" aria-label="Historial de ventas">
    <p className="text-sm text-muted-foreground">Ventas registradas en las sucursales a las que tienes acceso. Las cantidades conservan la unidad original.</p>
    {!data?.items.length ? <CollectionEmptyState compact title="La historia comercial está por comenzar" description="Este artículo todavía no tiene ventas registradas en las sucursales a las que tienes acceso. Aquí podrás consultar cada venta cuando se registre." /> : <>
      <div className="auna-data-table-shell overflow-x-auto"><table className="auna-data-table"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Cantidad</th><th>Total neto</th><th>Estado</th></tr></thead><tbody>
        {data.items.map(line=><tr key={line.id}><td><Link to={`/ventas/${line.sale.id}`} className="font-medium text-brand-orange underline-offset-4 hover:underline">{line.sale.reference || line.sale.id}</Link></td><td>{new Date(line.sale.date).toLocaleDateString(locale)}</td><td>{line.sale.customer || 'Consumidor final'}</td><td>{formatQuantity(String(line.qty),locale)} {line.unit_label}</td><td>{formatMoney(Number(line.net_total),locale,currencyCode)}</td><td>{line.sale.status?.name || '—'}</td></tr>)}
      </tbody></table></div>
      <div className="auna-pagination-outside"><Pagination currentPage={data.page} totalPages={data.totalPages} totalItems={data.totalItems} count={data.items.length} pageSize={data.pageSize} itemLabel="partidas" onPageChange={setPage} onPageSizeChange={setPageSize} hasNextPage={data.nextPage!==null} hasPrevPage={data.prevPage!==null} loading={query.isFetching} /></div>
    </>}
  </section>
}
