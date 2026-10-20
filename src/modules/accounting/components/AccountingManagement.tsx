/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * AccountingManagement - Módulo de contabilidad (partida doble).
 * Tabs: Diario, Mayor, Balanza, Estados Financieros, Catálogo, Configuración.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ModuleTabsList, ModuleTabsTrigger } from '@/components/shared/ModuleTabs'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { BookOpen, BookText, Scale, FileBarChart2, Percent, ListTree, Settings2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { getAccounts, postPending, type Account } from '@/services/accountingService'
import { JournalTab } from './JournalTab'
import { LedgerTab } from './LedgerTab'
import { TrialBalanceTab } from './TrialBalanceTab'
import { StatementsTab } from './StatementsTab'
import { TaxesTab } from './TaxesTab'
import { AccountsTab } from './AccountsTab'
import { SettingsTab } from './SettingsTab'
import './accounting.css'

const TAB_LABELS: Record<string, string> = { diario: 'Diario', mayor: 'Mayor', balanza: 'Balanza', estados: 'Estados financieros', impuestos: 'Impuestos', catalogo: 'Catálogo de cuentas', configuracion: 'Configuración' }

const AccountingManagement = () => {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canCreate = hasPermission('accounting.create')
  const canManage = hasPermission('accounting.manage')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeTab, setActiveTab] = useState('diario')
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState(false)
  usePageTrail([{ label: TAB_LABELS[activeTab] }])
  const autoPostedRef = useRef(false)

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(false)
    try {
      const res = await getAccounts(true)
      setAccounts(res.items)
    } catch {
      setAccountsError(true)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  useEffect(() => { void loadAccounts() }, [loadAccounts])

  // Auto-contabilizar operaciones pendientes al entrar al módulo (una vez por montaje)
  useEffect(() => {
    if (!canCreate || autoPostedRef.current) return
    autoPostedRef.current = true
    postPending()
      .then((res) => {
        if (res.posted > 0) {
          toast({ title: 'Contabilidad al día', description: `${res.posted} operaciones contabilizadas automáticamente` })
        }
      })
      .catch(() => { /* silencioso: el botón manual del Diario reporta errores */ })
  }, [canCreate, toast])

  return (
    <div className={`accounting-page mx-auto max-w-[1560px] p-4 sm:p-6 lg:p-8 space-y-5 ${activeTab !== 'configuracion' ? 'auna-page-fluid' : ''}`}>
      <h1 className="sr-only">Contabilidad</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="max-w-full overflow-x-auto pb-1">
          <ModuleTabsList aria-label="Secciones de contabilidad">
            <ModuleTabsTrigger value="diario"><BookOpen className="w-4 h-4" />Diario</ModuleTabsTrigger>
            <ModuleTabsTrigger value="mayor"><BookText className="w-4 h-4" />Mayor</ModuleTabsTrigger>
            <ModuleTabsTrigger value="balanza"><Scale className="w-4 h-4" />Balanza</ModuleTabsTrigger>
            <ModuleTabsTrigger value="estados"><FileBarChart2 className="w-4 h-4" />Estados</ModuleTabsTrigger>
            <ModuleTabsTrigger value="impuestos"><Percent className="w-4 h-4" />Impuestos</ModuleTabsTrigger>
            <ModuleTabsTrigger value="catalogo"><ListTree className="w-4 h-4" />Catálogo</ModuleTabsTrigger>
            <ModuleTabsTrigger value="configuracion"><Settings2 className="w-4 h-4" />Configuración</ModuleTabsTrigger>
          </ModuleTabsList>
        </div>

        <TabsContent value="diario">
          <JournalTab accounts={accounts} canCreate={canCreate} />
        </TabsContent>
        <TabsContent value="mayor">
          <LedgerTab accounts={accounts} />
        </TabsContent>
        <TabsContent value="balanza">
          <TrialBalanceTab />
        </TabsContent>
        <TabsContent value="estados">
          <StatementsTab />
        </TabsContent>
        <TabsContent value="impuestos">
          <TaxesTab />
        </TabsContent>
        <TabsContent value="catalogo">
          <AccountsTab accounts={accounts} loading={accountsLoading} loadError={accountsError} canManage={canManage} onChanged={() => void loadAccounts()} />
        </TabsContent>
        <TabsContent value="configuracion">
          <SettingsTab accounts={accounts} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AccountingManagement
