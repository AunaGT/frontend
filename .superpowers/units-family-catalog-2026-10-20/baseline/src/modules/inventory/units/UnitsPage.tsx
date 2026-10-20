import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {usePersistedListUiState} from '@/hooks/usePersistedListUiState'
import {useCardPagination} from '@/hooks/useCardPagination'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Card,CardContent} from '@/components/ui/card'
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table'
import {Pagination} from '@/components/shared/Pagination'
import {ModuleTabBar} from '@/components/shared/ModuleTabs'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {Archive,Pencil,LayoutGrid,Table2} from 'lucide-react'
import {normalizeUnitDecimal,formatUnitDecimal} from '@/lib/unitQuantity'
import {useUnitCatalog} from './useUnitCatalog'
import {saveUnit} from './api'
import type {MeasureUnit} from './types'
import {useTenant} from '@/context/useTenant'

type Draft={id?:string;code:string;family:string;name:string;label:string;factor:string;decimals:string;isStandard?:boolean}
export default function UnitsPage(){
  usePageTrail([{label:'Unidades'}])
  const {inventoryUnitsEnabled,locale}=useSystemSettings(),catalog=useUnitCatalog(inventoryUnitsEnabled),{hasPermission}=useAuthPermissions()
  const {registerTenantExitGuard}=useTenant()
  const canManage=inventoryUnitsEnabled&&catalog.canWrite&&hasPermission('settings.manage')
  const key=JSON.stringify([catalog.scope.companyId,catalog.scope.branchId,canManage]),live=useRef(key);live.current=key
  const [editor,setEditor]=useState<{key:string;draft:Draft}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState(''),[archived,setArchived]=useState(false),[archive,setArchive]=useState<{key:string;unit:MeasureUnit}|null>(null)
  const draft=editor?.key===key?editor.draft:null
  useEffect(()=>{setBusy(false);setError('');setNotice('');setEditor(null);setArchive(null)},[key])
  const guard=useDraftGuard(!!draft,registerTenantExitGuard,key)
  const {page,setPage,pageSize:tablePageSize,setPageSize,viewMode,setViewMode}=usePersistedListUiState('inventario/unidades',{defaultPageSize:50,defaultView:'cards'})
  const cards=useCardPagination({enabled:viewMode==='cards',tablePageSize,onPageChange:setPage,storageKey:'inventario/unidades'})
  const pageSize=viewMode==='cards'?cards.pageSize:tablePageSize
  const filtered=catalog.units.filter(u=>(archived||u.active)&&`${u.name} ${u.code} ${u.family}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,totalPages),items=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize)
  const begin=(unit?:MeasureUnit)=>{if(!canManage||busy)return;guard.request(()=>{setEditor({key,draft:unit?{id:unit.id,code:unit.code,family:unit.family,name:unit.name,label:unit.label,factor:unit.factor,decimals:String(unit.quantity_decimals),isStandard:unit.is_standard}:{code:'',family:'COUNT',name:'',label:'',factor:'1',decimals:'0'}});setError('');setNotice('')})}
  const update=(field:keyof Draft,value:string)=>{if(canManage&&!busy&&draft&&live.current===key)setEditor({key,draft:{...draft,[field]:value}})}
  const save=async()=>{
    if(!canManage||busy||!draft||live.current!==key)return
    const owner=key
    try{
      for(const [field,max] of [['code',40],['family',50],['name',100],['label',50]] as const)if(!draft[field].trim()||draft[field].trim().length>max)throw new Error('Completa código, familia, nombre y etiqueta dentro del límite indicado.')
      if(!/^[0-6]$/.test(draft.decimals))throw new Error('Elige de 0 a 6 decimales.')
      const factor=normalizeUnitDecimal(draft.factor,{decimals:12,max:'99999999.999999999999',allowZero:false})
      setBusy(true);setError('')
      await saveUnit(catalog.scope,{code:draft.code.trim(),family:draft.family.trim(),name:draft.name.trim(),label:draft.label.trim(),factor,quantity_decimals:Number(draft.decimals)},draft.id)
      if(live.current!==owner)return
      setEditor(null);setNotice('Unidad guardada.');await catalog.refetch()
    }catch(e){if(live.current===owner)setError((e as Error).message)}finally{if(live.current===owner)setBusy(false)}
  }
  const confirmArchive=async()=>{
    if(!canManage||busy||!archive||archive.key!==key||live.current!==key)return
    const owner=key;setBusy(true);setError('')
    try{await saveUnit(catalog.scope,{active:false},archive.unit.id);if(live.current!==owner)return;setArchive(null);setNotice('Unidad archivada. Los productos y registros anteriores conservan su unidad.');await catalog.refetch()}catch(e){if(live.current===owner)setError((e as Error).message)}finally{if(live.current===owner)setBusy(false)}
  }
  const actions=(unit:MeasureUnit)=>canManage&&<div className="flex gap-2"><Button type="button" variant="outline" size="icon" aria-label={`Editar ${unit.name}`} disabled={busy} onClick={()=>begin(unit)}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>{unit.active&&<Button type="button" variant="outline" size="icon" aria-label={`Archivar ${unit.name}`} disabled={busy} onClick={()=>{if(canManage&&!busy)guard.request(()=>setArchive({key,unit}))}}><Archive className="h-4 w-4" aria-hidden="true" /></Button>}</div>
  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">{guard.dialog}
    {!inventoryUnitsEnabled?<div className="auna-surface rounded-xl border p-5"><p>Las unidades y presentaciones están desactivadas para esta empresa.</p>{hasPermission('settings.manage')&&<Link className="mt-3 inline-flex py-2 text-brand-orange hover:underline" to="/configuracion?seccion=inventario">Ver configuración de Inventario</Link>}</div>:<>
      <div className="auna-list-toolbar flex flex-wrap items-center gap-3"><div className="w-full max-w-sm"><Label htmlFor="unit-search" className="sr-only">Buscar unidades</Label><Input id="unit-search" placeholder="Buscar unidades" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} /></div><div className="flex items-center gap-2"><Switch id="units-archived" checked={archived} onCheckedChange={value=>{setArchived(value);setPage(1)}} /><Label htmlFor="units-archived">Incluir archivadas</Label></div><div className="ml-auto flex flex-wrap gap-2"><ModuleTabBar items={[{value:'table',label:'',ariaLabel:'Tabla',icon:Table2},{value:'cards',label:'',ariaLabel:'Tarjetas',icon:LayoutGrid}]} value={viewMode} ariaLabel="Vista de unidades" onValueChange={setViewMode} />{canManage&&<Button type="button" onClick={()=>begin()} disabled={busy}>Nueva unidad</Button>}</div></div>
      {draft&&<section className="auna-surface space-y-4 rounded-xl border p-5" aria-label={draft.id?'Editar unidad':'Nueva unidad'}><h2 className="font-semibold">{draft.id?'Editar unidad':'Nueva unidad'}</h2><div className="flex flex-wrap gap-4">{([{field:'code',label:'Código',id:'unit-code'},{field:'family',label:'Familia de medida',id:'unit-family'},{field:'name',label:'Nombre',id:'unit-name'},{field:'label',label:'Etiqueta',id:'unit-label'},{field:'factor',label:'Equivalencia en la familia',id:'unit-factor'},{field:'decimals',label:'Decimales (0 a 6)',id:'unit-decimals'}] as const).map(field=><div key={field.field} className="w-full max-w-[240px] space-y-1.5"><Label htmlFor={field.id}>{field.label}</Label><Input id={field.id} value={draft[field.field]} inputMode={['factor','decimals'].includes(field.field)?'decimal':'text'} disabled={busy||!!draft.isStandard&&!['name','label'].includes(field.field)} onChange={e=>update(field.field,e.target.value)} /></div>)}</div><p className="max-w-xl text-xs text-muted-foreground">La equivalencia compara unidades de una misma familia: kilogramo = 1 y gramo = 0.001. Una unidad estándar o utilizada conserva su definición.</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>guard.request(()=>setEditor(null))}>Cancelar</Button><Button type="button" disabled={busy} onClick={save}>{busy?'Guardando…':'Guardar unidad'}</Button></div></section>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {catalog.isLoading?<p role="status">Cargando unidades…</p>:catalog.isError?<div role="alert">No se pudieron cargar las unidades.<Button type="button" variant="outline" onClick={()=>void catalog.refetch()}>Reintentar</Button></div>:!filtered.length?<CollectionEmptyState filtered={!!search||archived} title="Aquí aparecerán tus unidades" description="Las unidades estándar estarán disponibles al activar esta función." />:viewMode==='table'?<div className="auna-data-table-shell"><Table className="auna-data-table"><caption className="sr-only">Catálogo de unidades de la empresa</caption><TableHeader><TableRow>{['Unidad','Código','Familia','Equivalencia','Decimales','Estado',...(canManage?['Acciones']:[])].map(label=><TableHead key={label} scope="col">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{items.map(unit=><TableRow key={unit.id}><TableCell className="font-medium">{unit.name}</TableCell><TableCell>{unit.code}</TableCell><TableCell>{unit.family}</TableCell><TableCell>{formatUnitDecimal(unit.factor,locale)}</TableCell><TableCell>{unit.quantity_decimals}</TableCell><TableCell>{unit.active?'Activa':'Archivada'}</TableCell>{canManage&&<TableCell>{actions(unit)}</TableCell>}</TableRow>)}</TableBody></Table></div>:<div ref={cards.containerRef} className="auna-record-grid">{items.map(unit=><Card key={unit.id} className="auna-surface"><CardContent className="auna-record-card space-y-3 p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{unit.name}</h2><span className="text-xs text-muted-foreground">{unit.active?'Activa':'Archivada'}</span></div><p className="text-sm text-muted-foreground">{unit.code} · {unit.family}</p><p className="text-sm">{formatUnitDecimal(unit.factor,locale)} · {unit.quantity_decimals} decimales</p>{actions(unit)}</CardContent></Card>)}</div>}
      {!catalog.isLoading&&!catalog.isError&&<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} count={items.length} pageSize={pageSize} itemLabel="unidades" onPageSizeChange={viewMode==='cards'?cards.setCardPageSize:setPageSize} />}
    </>}
    <ConfirmDialog open={!!archive&&archive.key===key} onOpenChange={open=>{if(!open&&!busy)setArchive(null)}} appearance="auna" title="¿Archivar esta unidad?" description="Se retirará de nuevas configuraciones. Los productos y registros anteriores conservarán su unidad." confirmText="Archivar unidad" cancelText="Cancelar" onConfirm={confirmArchive} />
  </div>
}
