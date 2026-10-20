import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useModules } from '@/context/useModules'
import { lookupScannedProduct, shouldSubmitScan } from '@/services/scannerService'
import type { ApiProduct } from '@/types/product'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CollectionEmptyState } from './CollectionEmptyState'

export function BarcodeLookup() {
  const { company, branch, isConsolidated } = useTenant(), { user, hasPermission, permissionsReady } = useAuthPermissions(), { enabledModuleCodes } = useModules()
  const scope = { companyId: company?.id || '', branchId: branch?.id || '', canViewProducts: permissionsReady && hasPermission('products.view'), inventoryEnabled: !!enabledModuleCodes?.has('inventory') }
  const key = JSON.stringify([scope, user?.id]), live = useRef(key); live.current = key
  const owner = useRef<AbortController | null>(null), [code, setCode] = useState(''), [suffix, setSuffix] = useState<'ENTER' | 'TAB' | 'NONE'>('ENTER')
  const input = useRef<HTMLInputElement>(null), refocus = useRef(false)
  const [state, setState] = useState<{ key: string; pending: boolean; message: string; error: boolean; recent: { code: string; product: ApiProduct | null; time: string }[] }>({ key, pending: false, message: '', error: false, recent: [] })
  const visible = state.key === key ? state : { key, pending: false, message: '', error: false, recent: [] }
  useEffect(() => { setCode(''); return () => { owner.current?.abort(); owner.current = null } }, [key])
  const allowed = !!scope.companyId && !!scope.branchId && !isConsolidated && scope.canViewProducts && scope.inventoryEnabled
  useEffect(() => { if (!visible.pending && allowed && refocus.current) { refocus.current = false; input.current?.focus(); input.current?.select() } }, [visible.pending, allowed, key])
  async function lookup(restoreFocus=true) {
    if (!allowed || owner.current || !code.length) return
    const controller = new AbortController(), snapshot = code; owner.current = controller; refocus.current = restoreFocus
    setState(old => ({ ...(old.key === key ? old : { key, recent: [] }), pending: true, error: false, message: '' }))
    try {
      const product = await lookupScannedProduct(scope, snapshot, { signal: controller.signal })
      if (controller.signal.aborted || live.current !== key) return
      setCode('')
      setState(old => ({ key, pending: false, error: false, message: product ? `Encontramos ${product.name}. No se modificaron existencias.` : 'Este código todavía no aparece en el catálogo de esta sucursal.', recent: [{ code: snapshot, product, time: new Date().toLocaleTimeString() }, ...old.recent].slice(0,10) }))
    } catch (error) {
      if (!controller.signal.aborted && live.current === key) setState(old => ({ ...old, key, pending: false, error: true, message: (error as Error).message || 'No se pudo consultar el catálogo. Vuelve a intentar.' }))
    } finally { if (owner.current === controller) owner.current = null }
  }
  return <div className="space-y-5">
    <p className="max-w-2xl text-sm text-muted-foreground">Coloca el cursor en el campo y usa el lector en modo teclado, o escribe el código. La consulta es real; recibir texto no verifica que haya un lector conectado.</p>
    {!allowed && <p role="status" className="text-sm text-muted-foreground">Selecciona una sucursal y verifica tu permiso de Inventario para consultar el catálogo.</p>}
    <form className="flex max-w-3xl flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if(suffix==='ENTER')void lookup() }}>
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium" htmlFor="scan-code">Código de barras<Input ref={input} id="scan-code" type="text" autoComplete="off" maxLength={128} value={code} disabled={!allowed || visible.pending} onChange={e => setCode(e.target.value)} onKeyDown={e => { if(e.key==='Enter')e.preventDefault();if (shouldSubmitScan(e,suffix)) { void lookup(e.key!=='Tab') } }} /></label>
      <label className="grid gap-2 text-sm" htmlFor="scan-suffix">Sufijo del lector<select id="scan-suffix" className="auna-control auna-control-select" value={suffix} onChange={e => setSuffix(e.target.value as typeof suffix)} disabled={visible.pending}><option value="ENTER">Enter</option><option value="TAB">Tab</option><option value="NONE">Confirmar con botón</option></select></label>
      <Button type="button" onClick={()=>void lookup()} disabled={!allowed || visible.pending || !code.length}>{visible.pending ? 'Buscando…' : 'Buscar producto'}</Button>
    </form>
    {visible.message && <p role={visible.error ? 'alert' : 'status'} className={visible.error ? 'text-sm text-destructive' : 'text-sm'}>{visible.message}</p>}
    <section className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">Consultas de esta sesión</h3><p className="text-xs text-muted-foreground">Solo este navegador, hasta recargar o cambiar de empresa, usuario o sucursal. No es un registro de ventas ni movimientos.</p>
      {visible.recent.length ? <ul className="divide-y divide-border">{visible.recent.map((row,i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><strong>{row.product?.name || 'Código por revisar'}</strong><p className="text-muted-foreground">{row.code} · {row.time}</p></div>{row.product && <Link className="text-primary underline" to={`/inventario/${row.product.id}`}>Consultar producto</Link>}</li>)}</ul> : <CollectionEmptyState compact title="Tu próxima lectura empieza aquí" description="Consulta un código y verás aquí el resultado del catálogo real." />}
    </section>
  </div>
}
