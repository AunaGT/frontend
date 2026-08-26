/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ListTree, Pencil, Plus, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  createAccount, updateAccount,
  type Account, type AccountType,
} from '@/services/accountingService'
import { TYPE_LABELS } from './format'
import { AccountingImportDialog } from './AccountingImportDialog'

const ACCOUNT_TYPES = Object.keys(TYPE_LABELS) as AccountType[]

/** Profundidad jerárquica de una cuenta (para indentación). */
const depthOf = (account: Account, byId: Map<number, Account>): number => {
  let depth = 0
  let current = account
  while (current.parent_id != null && byId.has(current.parent_id) && depth < 6) {
    current = byId.get(current.parent_id)!
    depth += 1
  }
  return depth
}

export const AccountsTab = ({ accounts, canManage, onChanged }: {
  accounts: Account[]
  canManage: boolean
  onChanged: () => void
}) => {
  const { toast } = useToast()
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)

  // Formulario nueva cuenta
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType | ''>('')
  const [parentId, setParentId] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [editName, setEditName] = useState('')

  const byId = new Map(accounts.map((a) => [a.id, a]))
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  const groups = accounts.filter((a) => a.is_group && a.active)

  const resetNew = () => { setCode(''); setName(''); setType(''); setParentId(''); setIsGroup(false) }

  const handleCreate = async () => {
    if (!code.trim() || !name.trim() || !type) return
    setSaving(true)
    try {
      await createAccount({
        code: code.trim(),
        name: name.trim(),
        type,
        parent_id: parentId ? Number(parentId) : null,
        is_group: isGroup,
      })
      toast({ title: 'Cuenta creada', description: `${code} — ${name}` })
      resetNew()
      setIsNewOpen(false)
      onChanged()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo crear la cuenta', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!editing || !editName.trim()) return
    setSaving(true)
    try {
      await updateAccount(editing.id, { name: editName.trim() })
      toast({ title: 'Cuenta actualizada' })
      setEditing(null)
      onChanged()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo actualizar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (account: Account) => {
    try {
      await updateAccount(account.id, { active: !account.active })
      toast({ title: account.active ? 'Cuenta desactivada' : 'Cuenta reactivada', description: `${account.code} — ${account.name}` })
      onChanged()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo cambiar el estado', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListTree className="h-5 w-5" />Catálogo de cuentas
            </CardTitle>
            <CardDescription>
              Las cuentas de sistema (usadas por el posteo automático) no se pueden desactivar.
            </CardDescription>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />Importar
              </Button>
              <Button size="sm" onClick={() => setIsNewOpen(true)} className="bg-liquor-amber hover:bg-liquor-amber/90 text-white">
                <Plus className="h-4 w-4 mr-2" />Nueva cuenta
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Código</th>
                <th className="text-left font-medium px-3 py-2">Cuenta</th>
                <th className="text-left font-medium px-3 py-2">Tipo</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                {canManage && <th className="text-right font-medium px-3 py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((account) => {
                const depth = depthOf(account, byId)
                return (
                  <tr key={account.id} className={`border-t ${!account.active ? 'opacity-50' : ''} ${account.is_group ? 'bg-muted/20 font-medium' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{account.code}</td>
                    <td className="px-3 py-2" style={{ paddingLeft: `${12 + depth * 20}px` }}>
                      {account.name}
                      {account.system && <Badge variant="outline" className="ml-2 text-[10px]">sistema</Badge>}
                    </td>
                    <td className="px-3 py-2"><Badge variant="secondary">{TYPE_LABELS[account.type]}</Badge></td>
                    <td className="px-3 py-2">
                      <Badge variant={account.active ? 'default' : 'destructive'}>
                        {account.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2"
                          onClick={() => { setEditing(account); setEditName(account.name) }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground"
                          disabled={account.system}
                          onClick={() => void handleToggleActive(account)}
                        >
                          {account.active ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Nueva cuenta */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva cuenta contable</DialogTitle>
            <DialogDescription className="sr-only">
              Código, tipo, nombre y cuenta padre de la nueva cuenta contable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Código</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6105" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Publicidad" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cuenta padre (opcional)</Label>
              <Select value={parentId || 'none'} onValueChange={(v) => setParentId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Sin padre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin padre</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.code} — {g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isGroup} onCheckedChange={(v) => setIsGroup(v === true)} />
              Es agrupadora (no recibe movimientos)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !code.trim() || !name.trim() || !type}>
              {saving ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar nombre */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar cuenta {editing?.code}</DialogTitle>
            <DialogDescription className="sr-only">Editar el nombre y el tipo de esta cuenta contable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={saving || !editName.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importar catálogo desde Excel */}
      <AccountingImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} type="accounts" />
    </Card>
  )
}
