/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Edit, Eye, FileUp, LayoutGrid, List, Mail, MapPin, Phone, Plus, Search, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { ContactImage } from '@/components/shared/ContactImage'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { Pagination } from '@/components/shared/Pagination'
import { recordCardNavigation } from '@/components/shared/recordCardNavigation'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useCardPagination } from '@/hooks/useCardPagination'
import { useCategories } from '@/hooks/useCategories'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { useSuppliers } from '@/hooks/useSuppliers'
import type { Supplier } from '@/types'
import './contactsList.css'

function contactStatus(contact: Supplier) {
  const active = contact.status === 'active'
  return <Badge variant="outline" className={active ? 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>{active ? 'Activo' : 'Inactivo'}</Badge>
}

const SuppliersManagement = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuthPermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [partyFilter, setPartyFilter] = useState<'all' | 'SUPPLIER' | 'CUSTOMER'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const { page: currentPage, setPage: setCurrentPage, pageSize: tablePageSize, setPageSize, viewMode, setViewMode } = usePersistedListUiState('contactos/lista', { defaultPageSize: 10, defaultView: 'cards' })
  const pagination = useCardPagination({ enabled: viewMode === 'cards', tablePageSize, onPageChange: setCurrentPage })
  const pageSize = pagination.pageSize
  const canViewSuppliers = hasPermission('contacts.suppliers.view')
  const canViewClients = hasPermission('contacts.clients.view')
  const canCreate = hasPermission('contacts.suppliers.create') || hasPermission('contacts.clients.create')
  const canImport = hasPermission('contacts.suppliers.import')
  const showPartyFilter = canViewSuppliers && canViewClients
  const { data, isLoading, isFetching, isError, refetch } = useSuppliers({
    includeSummary: true, page: currentPage, pageSize,
    search: searchTerm.trim() || undefined,
    party_type: showPartyFilter && partyFilter !== 'all' ? partyFilter : undefined,
    estado: statusFilter === 'all' ? undefined : statusFilter === '1' ? 1 : 0,
    category_id: canViewSuppliers && categoryFilter !== 'all' ? categoryFilter : undefined,
  })
  const { data: categoriesData } = useCategories()
  const categories = categoriesData ?? []
  const contacts = data?.items ?? []
  const activeCount = Number(showPartyFilter && partyFilter !== 'all') + Number(statusFilter !== 'all') + Number(canViewSuppliers && categoryFilter !== 'all')
  useResetPageOnFilterChange(setCurrentPage, [searchTerm, partyFilter, statusFilter, categoryFilter, pageSize])

  // Preserve older detail links while keeping a single contact editor.
  useEffect(() => {
    const editId = (location.state as { editSupplierId?: string } | null)?.editSupplierId
    if (editId) navigate('/contactos/' + encodeURIComponent(editId) + '?editar=1', { replace: true })
  }, [location.state, navigate])

  const clearFilters = () => { setPartyFilter('all'); setStatusFilter('all'); setCategoryFilter('all') }
  const appliedFilters = [
    ...(showPartyFilter && partyFilter !== 'all' ? [{ label: partyFilter === 'SUPPLIER' ? 'Tipo: Proveedores' : 'Tipo: Clientes', onRemove: () => setPartyFilter('all') }] : []),
    ...(statusFilter !== 'all' ? [{ label: 'Estado: ' + (statusFilter === '1' ? 'Activos' : 'Inactivos'), onRemove: () => setStatusFilter('all') }] : []),
    ...(canViewSuppliers && categoryFilter !== 'all' ? [{ label: 'Categoría: ' + (categories.find(category => String(category.id) === categoryFilter)?.name ?? categoryFilter), onRemove: () => setCategoryFilter('all') }] : []),
  ]

  return <div className="contacts-list mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Contactos</h1>
    <MetricStrip label="Resumen de contactos" loading={isLoading} items={([['total', 'Contactos'], ['active', 'Activos'], ['inactive', 'Inactivos']] as const).map(([key, label]) => ({ label, value: isError ? '—' : data?.summary?.[key] ?? '—' }))} />
    <CompactFilterPanel title="Filtros de contactos" activeCount={activeCount} onClear={clearFilters} appliedFilters={appliedFilters}
      search={<div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" aria-label="Buscar contactos" placeholder="Buscar por nombre, NIT, teléfono o correo…" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></div>}
      actions={<>{canImport && <Button variant="outline" onClick={() => navigate('/contactos/importar')}><FileUp aria-hidden="true" className="mr-2 h-4 w-4" />Importar</Button>}{canCreate && <Button onClick={() => navigate('/contactos/nuevo')}><Plus aria-hidden="true" className="mr-2 h-4 w-4" />Nuevo contacto</Button>}</>}>
      {showPartyFilter && <div className="space-y-2"><Label htmlFor="contact-party-filter">Tipo de contacto</Label><Select value={partyFilter} onValueChange={value => { setPartyFilter(value as typeof partyFilter); setCategoryFilter('all') }}><SelectTrigger id="contact-party-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem><SelectItem value="SUPPLIER">Proveedores</SelectItem><SelectItem value="CUSTOMER">Clientes</SelectItem></SelectContent></Select></div>}
      <div className="space-y-2"><Label htmlFor="contact-status-filter">Estado</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger id="contact-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="1">Activo</SelectItem><SelectItem value="0">Inactivo</SelectItem></SelectContent></Select></div>
      {canViewSuppliers && partyFilter !== 'CUSTOMER' && <div className="space-y-2"><Label htmlFor="contact-category-filter">Categoría</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger id="contact-category-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{categories.map(category => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select></div>}
    </CompactFilterPanel>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold">Contactos <span className="font-normal text-muted-foreground">({data?.totalItems ?? 0})</span></p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">{viewMode === 'cards' ? 'Tarjetas' : 'Filas'} por página<Select value={String(pageSize)} onValueChange={value => { if (viewMode === 'cards') pagination.setCardPageSize(Number(value)); else setPageSize(Number(value)); setCurrentPage(1) }}><SelectTrigger className="w-20" aria-label="Contactos por página"><SelectValue /></SelectTrigger><SelectContent>{(viewMode === 'cards' ? pagination.pageSizeOptions : [...new Set([10, 20, 40, tablePageSize])].sort((a, b) => a - b)).map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></label>
        <ModuleTabBar ariaLabel="Vista de contactos" value={viewMode} onValueChange={setViewMode} items={[{ value: 'table', label: '', ariaLabel: 'Tabla', icon: List }, { value: 'cards', label: '', ariaLabel: 'Tarjetas', icon: LayoutGrid }]} />
      </div>
    </div>

    <section aria-label="Listado de contactos">
      {isFetching && !isLoading && <LoadingIndicator message="Actualizando contactos…" />}
      {isLoading ? <LoadingState variant={viewMode === 'table' ? 'table' : 'cards'} columns={['Contacto', 'NIT', 'Comunicación', 'Dirección', 'Categoría', 'Estado', 'Acciones']} message="Cargando contactos…" />
        : isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-6"><p className="text-destructive">No se pudieron cargar los contactos.</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div>
        : contacts.length === 0 ? <p className="py-10 text-center text-muted-foreground">No hay contactos para mostrar. Ajusta la búsqueda o los filtros.</p>
        : viewMode === 'table' ? <div className="auna-surface overflow-hidden rounded-xl border"><div className="contacts-table-scroll" role="region" tabIndex={0} aria-label="Tabla de contactos">
          <table className="auna-data-table min-w-[1080px]"><thead><tr>{['Contacto', 'NIT', 'Comunicación', 'Dirección', 'Categoría', 'Estado', 'Acciones'].map(title => <th key={title} scope="col" className={title === 'Acciones' ? 'text-right' : 'text-left'}>{title}</th>)}</tr></thead><tbody>
            {contacts.map(contact => <tr key={contact.id}>
              <td><div className="flex items-center gap-3"><ContactImage src={contact.imageUrl} name={contact.name} className="h-10 w-10 shrink-0" /><div className="min-w-0"><div className="font-medium">{contact.name}</div><span className="text-xs text-muted-foreground">{contact.party_type === 'CUSTOMER' ? 'Cliente' : 'Proveedor'}</span></div></div></td>
              <td className="text-sm">{contact.taxId || '—'}</td>
              <td><div className="space-y-1 text-xs">{contact.contact && contact.contact !== contact.name && <p>{contact.contact}</p>}<p>{contact.phone || 'Sin teléfono'}</p><p className="text-muted-foreground">{contact.email || 'Sin correo'}</p></div></td>
              <td className="text-xs text-muted-foreground">{contact.address || 'No registrada'}</td>
              <td className="text-xs text-muted-foreground">{contact.party_type === 'CUSTOMER' ? '—' : contact.categoriesLabel || contact.category || '—'}</td>
              <td>{contactStatus(contact)}</td>
              <td><div className="flex justify-end gap-2"><Button variant="outline" size="icon" aria-label={'Ver ' + contact.name} onClick={() => navigate('/contactos/' + contact.id)}><Eye aria-hidden="true" className="h-4 w-4" /></Button>{hasPermission(contact.party_type === 'CUSTOMER' ? 'contacts.clients.edit' : 'contacts.suppliers.edit') && <Button variant="outline" size="icon" aria-label={'Editar ' + contact.name} onClick={() => navigate('/contactos/' + contact.id + '?editar=1')}><Edit aria-hidden="true" className="h-4 w-4" /></Button>}</div></td>
            </tr>)}
          </tbody></table>
        </div></div> : <div ref={pagination.containerRef} className="auna-record-grid">
          {contacts.map(contact => <Card key={contact.id} className="auna-surface auna-record-card auna-record-interactive contacts-record-card" {...recordCardNavigation(() => navigate('/contactos/' + contact.id))}>
            <div className="auna-record-media"><ContactImage src={contact.imageUrl} name={contact.name} className="h-full w-full rounded-none border-0 bg-transparent object-contain" /></div>
            <div className="auna-record-content">
              <div className="contacts-card-heading"><h2>{contact.name}</h2>{contactStatus(contact)}</div>
              <div className="contacts-card-identity"><Badge variant="outline">{contact.party_type === 'CUSTOMER' ? 'Cliente' : 'Proveedor'}</Badge><span>NIT: {contact.taxId || 'No registrado'}</span></div>
              {contact.party_type !== 'CUSTOMER' && (contact.categoriesLabel || contact.category) && <p className="contacts-card-category">{contact.categoriesLabel || contact.category}</p>}
              <div className="contacts-card-lines">
                {contact.contact && contact.contact !== contact.name && <p className="contacts-card-short"><Users aria-hidden="true" /><span>{contact.contact}</span></p>}
                {contact.phone && <p className="contacts-card-short"><Phone aria-hidden="true" /><span>{contact.phone}</span></p>}
                {contact.email && <p><Mail aria-hidden="true" /><span>{contact.email}</span></p>}
                {contact.address && <p className="text-muted-foreground"><MapPin aria-hidden="true" /><span>{contact.address}</span></p>}
              </div>
            </div>
          </Card>)}
        </div>}
    </section>
    {!isLoading && !isError && <div className="auna-pagination-outside"><Pagination currentPage={data?.page ?? currentPage} totalPages={data?.totalPages ?? 1} totalItems={data?.totalItems ?? 0} count={contacts.length} pageSize={pageSize} itemLabel="contactos" onPageChange={setCurrentPage} loading={isFetching} /></div>}
  </div>
}

export default SuppliersManagement
