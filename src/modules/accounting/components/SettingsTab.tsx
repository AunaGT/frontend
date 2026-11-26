/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useRef, useState } from 'react'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ModuleTabsList, ModuleTabsTrigger } from '@/components/shared/ModuleTabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CalendarCheck2, Landmark, Lock, LockOpen, Settings2, ShieldAlert } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  getAccountingConfig, updateAccountingConfig, getPeriods, closePeriod, reopenPeriod, closeYear,
  type Account, type AccountingPeriod,
} from '@/services/accountingService'
import { getSettings, type SystemSettings } from '@/services/settingsService'
import { MONTH_LABELS } from './format'
import { OpeningBalancesCard } from './OpeningBalancesCard'

const KEY_LABELS: Record<string, string> = {
  cash: 'Caja (ventas en efectivo)',
  bank: 'Bancos (tarjeta / transferencia)',
  receivables: 'Clientes (ventas al crédito)',
  sales: 'Ventas',
  salesReturns: 'Devoluciones sobre ventas',
  cogs: 'Costo de ventas',
  inventory: 'Inventario',
  payables: 'Proveedores (cuentas por pagar)',
  ivaDebit: 'IVA débito fiscal',
  ivaCredit: 'IVA crédito fiscal',
  pequenoTax: 'IVA pequeño contribuyente por pagar',
  pequenoTaxExpense: 'IVA pequeño contribuyente (gasto)',
  currentEarnings: 'Utilidad del ejercicio',
  retainedEarnings: 'Utilidades acumuladas',
  cashOverShort: 'Sobrantes / faltantes de caja',
  customerAdvances: 'Anticipos de clientes (opcional)',
  payrollOtherDeductions: 'Descuentos de nómina por conciliar (pasivo)',
}

export const SettingsTab = ({ accounts, canManage }: { accounts: Account[]; canManage: boolean }) => {
  const { toast } = useToast()
  const currentYear = new Date().getFullYear()

  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [keys, setKeys] = useState<string[]>([])
  const [savingConfig, setSavingConfig] = useState(false)

  const [periodYear, setPeriodYear] = useState(currentYear)
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [busyMonth, setBusyMonth] = useState<number | null>(null)

  const [closingYear, setClosingYear] = useState(currentYear - 1)
  const [closingBusy, setClosingBusy] = useState(false)

  const [fiscalSummary, setFiscalSummary] = useState<{ key: string; data: Pick<SystemSettings, 'vat_affiliation' | 'iva_rate' | 'pequeno_rate'> | null; error: boolean } | null>(null)
  const [section, setSection] = useState('impuestos')
  const [configRevision,setConfigRevision]=useState<number|null>(null)
  const [loadError,setLoadError]=useState('')
  const {company,branch,isConsolidated}=useTenant(),{hasPermission}=useAuthPermissions()
  const scope={companyId:company?.id||'',branchId:branch?.id||(isConsolidated?'all':'')},canReadFiscal=hasPermission('settings.view','settings.manage'),canEditFiscal=hasPermission('settings.manage')&&!isConsolidated
  const scopeKey=JSON.stringify([scope.companyId,scope.branchId,canManage,canReadFiscal,canEditFiscal])
  const live=useRef({key:scopeKey,active:true});if(live.current.key!==scopeKey)live.current={key:scopeKey,active:true}
  const owner=live.current,current=()=>owner.active&&live.current===owner

  const postables = accounts.filter((a) => a.active && !a.is_group)
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  function loadSettings(){
    setConfigRevision(null);setFiscalSummary(null);setLoadError('');setSavingConfig(false)
    if(!scope.companyId||!scope.branchId)return
    getAccountingConfig(scope)
      .then((res) => { if(current()){setDefaults(res.defaults); setKeys(res.keys);setConfigRevision(res.revision)} })
      .catch(() => {if(current())setLoadError('No se pudo cargar la configuración. No guardes valores predeterminados; vuelve a cargar.')} )
    if(canReadFiscal)getSettings({scope})
      .then(data => { if(current())setFiscalSummary({key:scopeKey,data,error:false}) })
      .catch(() => { if(current())setFiscalSummary({key:scopeKey,data:null,error:true}) })
  }
  useEffect(()=>{owner.active=true;loadSettings();return()=>{owner.active=false}},[scopeKey])

  const loadPeriods = (year: number) => {
    getPeriods(year)
      .then((res) => setPeriods(res.items))
      .catch(() => setPeriods([]))
  }
  useEffect(() => { loadPeriods(periodYear) }, [periodYear])

  const handleSaveConfig = async () => {
    if(!current()||configRevision===null||savingConfig||isConsolidated)return
    setSavingConfig(true)
    try {
      const saved=await updateAccountingConfig(defaults,configRevision,scope)
      if(!current())return
      setConfigRevision(saved.revision)
      toast({ title: 'Configuración guardada', description: 'Las cuentas por defecto fueron actualizadas' })
    } catch (e) {
      if(!current())return
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar', variant: 'destructive' })
    } finally {
      if(current())setSavingConfig(false)
    }
  }

  const handleTogglePeriod = async (month: number, isClosed: boolean) => {
    if (!isClosed && !window.confirm(`¿Cerrar ${MONTH_LABELS[month - 1]} ${periodYear}? No se podrán registrar asientos en ese mes.`)) return
    setBusyMonth(month)
    try {
      if (isClosed) await reopenPeriod(periodYear, month)
      else await closePeriod(periodYear, month)
      loadPeriods(periodYear)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cambiar el período', variant: 'destructive' })
    } finally {
      setBusyMonth(null)
    }
  }

  const handleCloseYear = async () => {
    if (!window.confirm(
      `¿Cerrar el ejercicio ${closingYear}?\n\nSe generará el asiento de cierre que salda ingresos, costos y gastos ` +
      `contra Utilidad del Ejercicio y la traslada a Utilidades Acumuladas. Requiere los 12 meses cerrados.`,
    )) return
    setClosingBusy(true)
    try {
      const entry = await closeYear(closingYear)
      toast({ title: `Ejercicio ${closingYear} cerrado`, description: `Asiento de cierre ${entry.entry_number} generado` })
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cerrar el ejercicio', variant: 'destructive' })
    } finally {
      setClosingBusy(false)
    }
  }

  if (!canManage) {
    return (
      <Card className="auna-surface">
        <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <ShieldAlert className="h-8 w-8" />
          No tienes permiso para administrar la configuración contable.
        </CardContent>
      </Card>
    )
  }

  const statusOf = (month: number) => periods.find((p) => p.month === month)?.status ?? 'OPEN'

  return (
    <Tabs value={section} onValueChange={setSection} className="accounting-settings-tabs space-y-4">
      {loadError&&<p role="alert" className="text-destructive">{loadError}</p>}
      <Button variant="outline" disabled={savingConfig} onClick={()=>{if(window.confirm('Se descartarán los cambios no guardados de estos ajustes contables. ¿Cargar valores actuales?'))loadSettings()}}>Recargar ajustes actuales</Button>
      <div className="max-w-full overflow-x-auto pb-1"><ModuleTabsList aria-label="Tareas de configuración contable">
        <ModuleTabsTrigger value="impuestos">Impuestos</ModuleTabsTrigger>
        <ModuleTabsTrigger value="cuentas">Cuentas por defecto</ModuleTabsTrigger>
        <ModuleTabsTrigger value="apertura">Saldos iniciales</ModuleTabsTrigger>
        <ModuleTabsTrigger value="periodos">Períodos y cierre</ModuleTabsTrigger>
      </ModuleTabsList></div>
      <TabsContent value="impuestos" forceMount hidden={section !== 'impuestos'}>
      {/* Régimen de IVA */}
      <Card className="auna-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5" />Impuestos (SAT)
          </CardTitle>
          <CardDescription>
            Régimen y tasas de la empresa, compartidas con la preparación FEL. Los asientos existentes no se recalculan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canReadFiscal ? <p className="text-sm text-muted-foreground">Necesitas permiso de consulta de Configuración para ver los datos fiscales.</p> : fiscalSummary?.key !== scopeKey ? <p role="status" className="text-sm text-muted-foreground">Cargando datos fiscales…</p> : fiscalSummary.error ? <p role="alert" className="text-sm text-destructive">No se pudieron cargar los datos fiscales. Usa «Recargar ajustes actuales» para reintentar.</p> : <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Régimen</dt><dd className="mt-1 font-medium">{{ general: 'Régimen general', pequeno_contribuyente: 'Pequeño contribuyente', no_obligado: 'No obligado', exento: 'Exento', otro: 'Otro' }[fiscalSummary.data?.vat_affiliation || ''] || 'Sin configurar'}</dd></div>
            <div><dt className="text-muted-foreground">Tasa IVA general</dt><dd className="mt-1 font-medium">{fiscalSummary.data?.iva_rate ?? 'Sin configurar'}{fiscalSummary.data?.iva_rate ? ' %' : ''}</dd></div>
            <div><dt className="text-muted-foreground">Tarifa pequeño contribuyente</dt><dd className="mt-1 font-medium">{fiscalSummary.data?.pequeno_rate ?? 'Sin configurar'}{fiscalSummary.data?.pequeno_rate ? ' %' : ''}</dd></div>
          </dl>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="max-w-2xl text-sm text-muted-foreground">El régimen y las tasas se administran únicamente en Configuración → Datos fiscales. Esta misma configuración se utiliza en Contabilidad y en la preparación FEL.</p>{canReadFiscal && <Button asChild variant="outline" className="min-h-11"><a href="/configuracion?seccion=fiscal">{canEditFiscal ? 'Editar configuración fiscal' : 'Ver configuración fiscal'}</a></Button>}</div>
        </CardContent>
      </Card>
      </TabsContent>

      {/* Cuentas por defecto */}
      <TabsContent value="cuentas" forceMount hidden={section !== 'cuentas'}><Card className="auna-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5" />Cuentas por defecto
          </CardTitle>
          <CardDescription>Qué cuenta usa cada asiento automático generado por el sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {keys.map((key) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{KEY_LABELS[key] ?? key}</Label>
                <Select
                  value={defaults[key] ?? ''}
                  onValueChange={(v) => setDefaults((prev) => ({ ...prev, [key]: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent>
                    {postables.filter((a) => !['customerAdvances', 'payrollOtherDeductions'].includes(key) || a.type === 'LIABILITY').map((a) => (
                      <SelectItem key={a.id} value={a.code}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {key === 'customerAdvances' && <p className="text-xs text-muted-foreground">Cuenta de pasivo para recibir anticipos de contrataciones. Solo es necesaria si usas estos cobros con Contabilidad activa.</p>}
              </div>
            ))}
          </div>
          <Button onClick={handleSaveConfig} disabled={savingConfig||configRevision===null||isConsolidated}>
            {savingConfig ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </CardContent>
      </Card>
      </TabsContent>

      {/* Saldos iniciales (asiento de apertura) */}
      <TabsContent value="apertura" forceMount hidden={section !== 'apertura'}><OpeningBalancesCard accounts={accounts} /></TabsContent>

      {/* Períodos */}
      <TabsContent value="periodos" forceMount hidden={section !== 'periodos'} className="space-y-4"><Card className="auna-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck2 className="h-5 w-5" />Períodos contables
          </CardTitle>
          <CardDescription>Un período cerrado bloquea la creación de asientos en esas fechas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 w-[140px]">
            <Label className="text-xs">Año</Label>
            <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="auna-section-list grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
            {MONTH_LABELS.map((label, i) => {
              const month = i + 1
              const closed = statusOf(month) === 'CLOSED'
              return (
                <div key={month} className="auna-section-row p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <Badge variant={closed ? 'secondary' : 'default'} className="mt-1">
                      {closed ? 'Cerrado' : 'Abierto'}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground"
                    disabled={busyMonth === month}
                    title={closed ? 'Reabrir' : 'Cerrar'}
                    aria-label={`${closed ? 'Reabrir' : 'Cerrar'} período ${label} ${periodYear}`}
                    onClick={() => void handleTogglePeriod(month, closed)}
                  >
                    {closed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cierre anual */}
      <Card className="auna-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />Cierre anual
          </CardTitle>
          <CardDescription>
            Genera el asiento de cierre del ejercicio (salda resultados contra Utilidades Acumuladas). Requiere los 12 meses del año cerrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-[140px]">
            <Label className="text-xs">Ejercicio</Label>
            <Select value={String(closingYear)} onValueChange={(v) => setClosingYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="destructive" onClick={handleCloseYear} disabled={closingBusy}>
            {closingBusy ? 'Cerrando…' : `Cerrar ejercicio ${closingYear}`}
          </Button>
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>
  )
}
