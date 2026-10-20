import {useEffect,useRef,useState} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {usePersistedListUiState} from '@/hooks/usePersistedListUiState'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table'
import {Pagination} from '@/components/shared/Pagination'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {Archive,Pencil,ArrowLeft,ChevronRight} from 'lucide-react'
import {normalizeUnitDecimal,formatUnitDecimal} from '@/lib/unitQuantity'
import {useUnitCatalog} from './useUnitCatalog'
import {saveUnit} from './api'
import type {MeasureUnit} from './types'
import {useTenant} from '@/context/useTenant'

type Draft={id?:string;code:string;family:string;name:string;label:string;factor:string;decimals:string;isStandard?:boolean}
const familyNames:Record<string,string>={COUNT:'Conteo',MASS:'Peso',VOLUME:'Volumen',LENGTH:'Longitud',AREA:'Área',TIME:'Tiempo',SESSION:'Sesiones',WORK:'Trabajos',VISIT:'Visitas',EVENT:'Eventos'}
type Family={code:string;name:string;units:MeasureUnit[];reference?:MeasureUnit}
function groupFamilies(units:MeasureUnit[]):Family[]{
  const groups=new Map<string,MeasureUnit[]>()
  for(const unit of units)groups.set(unit.family,[...(groups.get(unit.family)??[]),unit])
  return [...groups].map(([code,rows])=>{
    const sorted=rows.slice().sort((a,b)=>a.name.localeCompare(b.name,'es'))
    const references=sorted.filter(unit=>normalizeUnitDecimal(unit.factor,{decimals:12,max:'99999999.999999999999',allowZero:false})==='1')
    return {code,name:familyNames[code]??code,units:sorted,reference:references.find(unit=>unit.is_standard)??references.find(unit=>unit.active)??references[0]}
  }).sort((a,b)=>a.name.localeCompare(b.name,'es'))
}
export default function UnitsPage(){
  const [params,setParams]=useSearchParams(),selectedCode=params.get('familia')??''
  const {inventoryUnitsEnabled,locale}=useSystemSettings(),catalog=useUnitCatalog(inventoryUnitsEnabled),{hasPermission}=useAuthPermissions()
  const families=groupFamilies(catalog.units),family=families.find(group=>group.code===selectedCode)
  usePageTrail(selectedCode?[{label:'Unidades',to:'/inventario/unidades'},{label:family?.name??'Familia'}]:[{label:'Unidades'}])
  const {registerTenantExitGuard}=useTenant()
  const canManage=inventoryUnitsEnabled&&catalog.canWrite&&hasPermission('settings.manage')
  const key=JSON.stringify([catalog.scope.companyId,catalog.scope.branchId,canManage,selectedCode]),live=useRef(key);live.current=key
  const [editor,setEditor]=useState<{key:string;draft:Draft}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState(''),[archived,setArchived]=useState(false),[archive,setArchive]=useState<{key:string;unit:MeasureUnit}|null>(null)
  const draft=editor?.key===key?editor.draft:null
  useEffect(()=>{setBusy(false);setError('');setNotice('');setEditor(null);setArchive(null);setSearch('')},[key])
  const guard=useDraftGuard(!!draft,registerTenantExitGuard,key)
  const {page,setPage,pageSize,setPageSize}=usePersistedListUiState('inventario/unidades/'+(selectedCode?encodeURIComponent(selectedCode):'familias'),{defaultPageSize:50})
  const visibleUnits=(group:Family)=>group.units.filter(unit=>archived||unit.active)
  const query=search.trim().toLocaleLowerCase('es')
  const matches=(value:string)=>value.toLocaleLowerCase('es').includes(query)
  const filteredFamilies=families.filter(group=>visibleUnits(group).length&&matches(group.name+' '+group.code+' '+visibleUnits(group).map(unit=>unit.name+' '+unit.code+' '+unit.label).join(' ')))
  const filteredUnits=family?visibleUnits(family).filter(unit=>matches(unit.name+' '+unit.code+' '+unit.label)):[]
  const totalItems=selectedCode?filteredUnits.length:filteredFamilies.length
  const totalPages=Math.max(1,Math.ceil(totalItems/pageSize)),currentPage=Math.min(page,totalPages)
  const from=(currentPage-1)*pageSize,to=currentPage*pageSize
  const familyItems=filteredFamilies.slice(from,to),unitItems=filteredUnits.slice(from,to)
  const navigateFamily=(code:string)=>guard.request(()=>{
    setEditor(null);setArchive(null);setSearch('');setError('');setNotice('');setPage(1)
    const next=new URLSearchParams(params);if(code)next.set('familia',code);else next.delete('familia');setParams(next)
  })
  const begin=(unit?:MeasureUnit)=>{
    if(!canManage||busy||!family||unit&&unit.family!==family.code)return
    guard.request(()=>{setEditor({key,draft:unit?{id:unit.id,code:unit.code,family:family.code,name:unit.name,label:unit.label,factor:unit.factor,decimals:String(unit.quantity_decimals),isStandard:unit.is_standard}:{code:'',family:family.code,name:'',label:'',factor:'1',decimals:String(family.reference?.quantity_decimals??0)}});setError('');setNotice('')})
  }
  const update=(field:keyof Draft,value:string)=>{if(canManage&&!busy&&draft&&live.current===key)setEditor({key,draft:{...draft,[field]:value}})}
  const save=async()=>{
    if(!canManage||busy||!draft||!family||live.current!==key)return
    const owner=key
    try{
      for(const [field,max] of [['code',40],['name',100],['label',50]] as const)if(!draft[field].trim()||draft[field].trim().length>max)throw new Error('Completa código, nombre y etiqueta dentro del límite indicado.')
      if(!/^[0-6]$/.test(draft.decimals))throw new Error('Elige de 0 a 6 decimales.')
      const factor=normalizeUnitDecimal(draft.factor,{decimals:12,max:'99999999.999999999999',allowZero:false})
      setBusy(true);setError('')
      await saveUnit(catalog.scope,{code:draft.code.trim(),family:family.code,name:draft.name.trim(),label:draft.label.trim(),factor,quantity_decimals:Number(draft.decimals)},draft.id)
      if(live.current!==owner)return
      setEditor(null);setNotice('Unidad guardada.');await catalog.refetch()
    }catch(e){if(live.current===owner)setError((e as Error).message)}finally{if(live.current===owner)setBusy(false)}
  }
  const confirmArchive=async()=>{
    if(!canManage||busy||!archive||archive.key!==key||live.current!==key)return
    const owner=key;setBusy(true);setError('')
    try{await saveUnit(catalog.scope,{active:false},archive.unit.id);if(live.current!==owner)return;setArchive(null);setNotice('Unidad archivada. Los productos y registros anteriores conservan su unidad.');await catalog.refetch()}catch(e){if(live.current===owner)setError((e as Error).message)}finally{if(live.current===owner)setBusy(false)}
  }
  const equivalence=(unit:MeasureUnit)=>'1 '+unit.label+' = '+formatUnitDecimal(unit.factor,locale)+' '+(family?.reference?.label??'unidades de referencia')
  let draftEquivalence=''
  if(draft)try{draftEquivalence='1 '+(draft.label.trim()||'nueva unidad')+' = '+formatUnitDecimal(normalizeUnitDecimal(draft.factor,{decimals:12,max:'99999999.999999999999',allowZero:false}),locale)+' '+(family?.reference?.label??'unidades de referencia')}catch{/* The draft can be incomplete while typing. */}
  const fields=[{field:'name',label:'Nombre',id:'unit-name'},{field:'code',label:'Código',id:'unit-code'},{field:'label',label:'Abreviatura o etiqueta',id:'unit-label'},{field:'factor',label:family?.reference?'Equivalencia en '+family.reference.label:'Equivalencia en la referencia de la familia',id:'unit-factor'},{field:'decimals',label:'Decimales (0 a 6)',id:'unit-decimals'}] as const
  const actions=(unit:MeasureUnit)=>canManage&&<div className="flex gap-2"><Button type="button" variant="outline" size="icon" aria-label={'Editar '+unit.name} disabled={busy} onClick={()=>begin(unit)}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>{unit.active&&<Button type="button" variant="outline" size="icon" aria-label={'Archivar '+unit.name} disabled={busy} onClick={()=>guard.request(()=>setArchive({key,unit}))}><Archive className="h-4 w-4" aria-hidden="true" /></Button>}</div>
  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">{guard.dialog}
    {!inventoryUnitsEnabled?<div className="space-y-3"><p>Las unidades y presentaciones están desactivadas para esta empresa.</p>{hasPermission('settings.manage')&&<Link className="inline-flex py-2 text-brand-orange hover:underline" to="/configuracion?seccion=inventario">Ver configuración de Inventario</Link>}</div>:<>
      <div className="flex flex-wrap items-center gap-3">
        {selectedCode?<><Button type="button" variant="outline" disabled={busy} onClick={()=>navigateFamily('')}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Volver a familias</Button><p className="text-sm text-muted-foreground">{family?.reference?'Referencia: '+family.reference.name+' ('+family.reference.label+').':family?'Las equivalencias usan la referencia de esta familia.':'Esta familia no está disponible en la empresa actual.'}</p></>:<p className="max-w-2xl text-sm text-muted-foreground">Elige una familia para consultar sus unidades y agregar otras. Las cajas y paquetes se configuran en cada producto.</p>}
      </div>
      <div className="auna-list-toolbar flex flex-wrap items-center gap-3"><div className="w-full max-w-sm"><Label htmlFor="unit-search" className="sr-only">{selectedCode?'Buscar unidades':'Buscar familias o unidades'}</Label><Input id="unit-search" placeholder={selectedCode?'Buscar unidades':'Buscar familias o unidades'} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} /></div><div className="flex items-center gap-2"><Switch id="units-archived" checked={archived} onCheckedChange={value=>{setArchived(value);setPage(1)}} /><Label htmlFor="units-archived">Incluir archivadas</Label></div>{canManage&&family&&<Button type="button" className="ml-auto" onClick={()=>begin()} disabled={busy}>Nueva unidad</Button>}</div>
      {draft&&<section className="space-y-4 border-y py-5" aria-label={draft.id?'Editar unidad':'Nueva unidad'}><h2 className="font-semibold">{draft.id?'Editar unidad':'Nueva unidad'}</h2><div className="flex flex-wrap gap-4">{fields.map(field=><div key={field.field} className="w-full max-w-[240px] space-y-1.5"><Label htmlFor={field.id}>{field.label}</Label><Input id={field.id} value={draft[field.field]} inputMode={['factor','decimals'].includes(field.field)?'decimal':'text'} aria-describedby={field.field==='factor'?'unit-equivalence':undefined} disabled={busy||!!draft.isStandard&&!['name','label'].includes(field.field)} onChange={e=>update(field.field,e.target.value)} /></div>)}</div><p id="unit-equivalence" role="status" className="text-sm text-muted-foreground">{draftEquivalence||'Indica cuántas unidades de referencia contiene una nueva unidad.'}</p><p className="max-w-2xl text-xs text-muted-foreground">La familia se asigna automáticamente. Una unidad estándar o utilizada conserva su definición.</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>guard.request(()=>setEditor(null))}>Cancelar</Button><Button type="button" disabled={busy} onClick={save}>{busy?'Guardando…':'Guardar unidad'}</Button></div></section>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {catalog.isLoading?<p role="status">Cargando unidades…</p>:catalog.isError?<div role="alert">No se pudieron cargar las unidades.<Button type="button" variant="outline" onClick={()=>void catalog.refetch()}>Reintentar</Button></div>:!totalItems?<CollectionEmptyState filtered={!!search||archived} title={search?'No encontramos esa coincidencia':selectedCode?'Hagamos espacio para otra medida':'Todo empieza con una buena medida'} description={search?'Prueba con otro nombre, código o abreviatura.':family?'Agrega una unidad para seguir completando esta familia.':'Las familias disponibles aparecerán aquí con sus unidades.'} />:<div className="auna-data-table-shell"><Table className="auna-data-table"><caption className="sr-only">{selectedCode?'Unidades de '+family?.name:'Familias de unidades de la empresa'}</caption><TableHeader><TableRow>{(selectedCode?['Unidad','Código','Abreviatura','Equivalencia','Decimales','Estado',...(canManage?['Acciones']:[])]:['Familia','Cantidad','Unidades incluidas','Unidad de referencia']).map(label=><TableHead key={label} scope="col">{label}</TableHead>)}</TableRow></TableHeader><TableBody>
        {selectedCode?unitItems.map(unit=><TableRow key={unit.id}><TableCell className="font-medium">{unit.name}</TableCell><TableCell>{unit.code}</TableCell><TableCell>{unit.label}</TableCell><TableCell className="whitespace-nowrap">{equivalence(unit)}</TableCell><TableCell>{unit.quantity_decimals}</TableCell><TableCell>{unit.active?'Activa':'Archivada'}</TableCell>{canManage&&<TableCell>{actions(unit)}</TableCell>}</TableRow>):familyItems.map(group=>{const units=visibleUnits(group);return <TableRow key={group.code} className="cursor-pointer" onClick={()=>navigateFamily(group.code)}><TableCell><Button type="button" variant="link" className="h-auto p-0 font-medium text-foreground" aria-label={'Abrir familia '+group.name} onClick={event=>{event?.stopPropagation();navigateFamily(group.code)}}>{group.name}<ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button></TableCell><TableCell className="whitespace-nowrap">{units.length+' '+(units.length===1?'unidad':'unidades')}</TableCell><TableCell className="max-w-xl">{units.map(unit=>unit.name).join(', ')}</TableCell><TableCell>{group.reference?group.reference.name+' ('+group.reference.label+')':'Sin referencia definida'}</TableCell></TableRow>})}
      </TableBody></Table></div>}
      {!catalog.isLoading&&!catalog.isError&&<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} count={selectedCode?unitItems.length:familyItems.length} pageSize={pageSize} itemLabel={selectedCode?'unidades':'familias'} onPageSizeChange={setPageSize} />}
    </>}
    <ConfirmDialog open={!!archive&&archive.key===key} onOpenChange={open=>{if(!open&&!busy)setArchive(null)}} appearance="auna" title="¿Archivar esta unidad?" description="Se retirará de nuevas configuraciones. Los productos y registros anteriores conservarán su unidad." confirmText="Archivar unidad" cancelText="Cancelar" onConfirm={confirmArchive} />
  </div>
}
