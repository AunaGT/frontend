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
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, CalendarClock, PackageOpen, Trash2 } from 'lucide-react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

type LotStatusFilter = 'all' | 'expiring' | 'expired'

interface ExpiringLot {
  id: string
  lot_code: string | null
  expiry_date: string
  qty_remaining: number
  days_to_expiry: number
  received_at: string
  location?: { id: string; code: string; name: string | null } | null
  product: {
    id: string
    name: string
    brand?: string | null
    size?: string | null
    barcode?: string | null
    stock: number
    lotted: number
    unlotted: number
  }
}

interface LotsExpiringResponse {
  days: number
  status: string
  lots: ExpiringLot[]
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })

export const LotsExpiryPage = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<LotStatusFilter>('all')
  const [days, setDays] = useState('30')

  const effectiveDays = Math.min(365, Math.max(1, Number(days) || 30))
  const { data, isLoading } = useQuery<LotsExpiringResponse, Error>({
    queryKey: ['lots-expiring', effectiveDays, status],
    queryFn: () =>
      apiFetch<LotsExpiringResponse>(`/api/products/lots/expiring?days=${effectiveDays}&status=${status}`),
    staleTime: 60 * 1000,
  })

  const lots = data?.lots ?? []
  const expired = lots.filter((l) => l.days_to_expiry < 0)
  const expiredCount = expired.length
  const expiringCount = lots.length - expiredCount

  // Dar de baja saca del anaquel lo que quede del lote: destruye existencias,
  // así que va con el mismo permiso que un ajuste manual.
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const canWriteOff = hasPermission('stock_moves.adjust')
  const [confirming, setConfirming] = useState<ExpiringLot[] | null>(null)

  const writeOffMutation = useMutation({
    mutationFn: (lotIds: string[]) =>
      apiFetch<{ lots: number; units: number }>('/api/products/lots/write-off', {
        method: 'POST',
        body: JSON.stringify({ lot_ids: lotIds, reason: 'Lote vencido' }),
      }),
    onSuccess: (r) => {
      toast({
        title: 'Lotes dados de baja',
        description: `${r.units} unidad(es) salieron del inventario en ${r.lots} lote(s).`,
      })
      setConfirming(null)
      void queryClient.invalidateQueries({ queryKey: ['lots-expiring'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-by-location'] })
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo dar de baja', description: e.message, variant: 'destructive' }),
  })

  const unitsToWriteOff = (confirming ?? []).reduce((s, l) => s + l.qty_remaining, 0)

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventario')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-liquor-amber" />
            Lotes y caducidades
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Lotes con existencia próximos a vencer o ya vencidos
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
            <CardTitle className="text-base">
              {isLoading
                ? 'Cargando…'
                : `${lots.length} lote${lots.length === 1 ? '' : 's'} · ${expiredCount} vencido${expiredCount === 1 ? '' : 's'} · ${expiringCount} por vencer`}
            </CardTitle>
            <div className="flex items-end gap-3">
              {canWriteOff && expiredCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirming(expired)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Dar de baja los {expiredCount} vencidos
                </Button>
              )}
              <div>
                <Label htmlFor="lots-days" className="text-xs text-muted-foreground">
                  Ventana (días)
                </Label>
                <Input
                  id="lots-days"
                  type="number"
                  min={1}
                  max={365}
                  className="mt-1 w-24"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lots-status" className="text-xs text-muted-foreground">
                  Estado
                </Label>
                <Select value={status} onValueChange={(v) => setStatus(v as LotStatusFilter)}>
                  <SelectTrigger id="lots-status" className="mt-1 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="expiring">Por vencer</SelectItem>
                    <SelectItem value="expired">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isLoading && lots.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <PackageOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay lotes {status === 'expired' ? 'vencidos' : 'por vencer'} en esta ventana.</p>
              <p className="text-xs mt-1">
                Los lotes se crean al registrar ingresos de mercancía con fecha de caducidad.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead className="text-right">Días</TableHead>
                    <TableHead className="text-right">Cant. en lote</TableHead>
                    <TableHead className="text-right">Stock (sin lote)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => {
                    const isExpired = lot.days_to_expiry < 0
                    return (
                      <TableRow
                        key={lot.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/inventario/${lot.product.id}`)}
                      >
                        <TableCell>
                          <p className="font-medium text-foreground">{lot.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[lot.product.brand, lot.product.size].filter(Boolean).join(' • ')}
                          </p>
                        </TableCell>
                        <TableCell>{lot.lot_code || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{lot.location?.code || '—'}</TableCell>
                        <TableCell>{formatDate(lot.expiry_date)}</TableCell>
                        <TableCell className="text-right">
                          {isExpired ? `hace ${Math.abs(lot.days_to_expiry)}` : lot.days_to_expiry}
                        </TableCell>
                        <TableCell className="text-right font-medium">{lot.qty_remaining}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {lot.product.stock} ({lot.product.unlotted})
                        </TableCell>
                        <TableCell>
                          {isExpired ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15">
                              Por vencer
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canWriteOff && isExpired && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setConfirming([lot]) }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Dar de baja {confirming?.length === 1 ? 'este lote' : `${confirming?.length ?? 0} lotes`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Salen {unitsToWriteOff} unidad(es) del inventario, de la ubicación donde está cada
              lote. Queda anotado en el libro como ajuste por lote vencido y no se puede deshacer
              con un botón: habría que volver a ingresarlas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={writeOffMutation.isPending}
              onClick={() => writeOffMutation.mutate((confirming ?? []).map((l) => l.id))}
            >
              {writeOffMutation.isPending ? 'Dando de baja…' : 'Dar de baja'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default LotsExpiryPage
