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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
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

const AccountingManagement = () => {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canCreate = hasPermission('accounting.create')
  const canManage = hasPermission('accounting.manage')

  const [accounts, setAccounts] = useState<Account[]>([])
  const autoPostedRef = useRef(false)

  const loadAccounts = useCallback(async () => {
    try {
      const res = await getAccounts(true)
      setAccounts(res.items)
    } catch {
      // el tab Diario mostrará su propio error al cargar
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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Contabilidad</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Partida doble: libros, estados financieros, catálogo de cuentas y períodos.
        </p>
      </div>

      <Tabs defaultValue="diario" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="diario"><BookOpen className="w-4 h-4 mr-2" />Diario</TabsTrigger>
          <TabsTrigger value="mayor"><BookText className="w-4 h-4 mr-2" />Mayor</TabsTrigger>
          <TabsTrigger value="balanza"><Scale className="w-4 h-4 mr-2" />Balanza</TabsTrigger>
          <TabsTrigger value="estados"><FileBarChart2 className="w-4 h-4 mr-2" />Estados</TabsTrigger>
          <TabsTrigger value="impuestos"><Percent className="w-4 h-4 mr-2" />Impuestos</TabsTrigger>
          <TabsTrigger value="catalogo"><ListTree className="w-4 h-4 mr-2" />Catálogo</TabsTrigger>
          <TabsTrigger value="configuracion"><Settings2 className="w-4 h-4 mr-2" />Configuración</TabsTrigger>
        </TabsList>

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
          <AccountsTab accounts={accounts} canManage={canManage} onChanged={() => void loadAccounts()} />
        </TabsContent>
        <TabsContent value="configuracion">
          <SettingsTab accounts={accounts} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AccountingManagement
