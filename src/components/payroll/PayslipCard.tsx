/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Recibo individual: devengos, deducciones y neto. Imprimible tal cual. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Payslip } from '@/services/payrollService'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v))

export const PayslipCard = ({ payslip }: { payslip: Payslip }) => {
  const devengos = payslip.lines.filter((l) => l.type === 'DEVENGO')
  const deducciones = payslip.lines.filter((l) => l.type === 'DEDUCCION')
  const patronal = payslip.lines.filter((l) => l.type === 'COSTO_PATRONAL')

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {payslip.employee?.first_name} {payslip.employee?.last_name}
          <span className="ml-2 font-mono text-xs text-muted-foreground">{payslip.employee?.code}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {payslip.employee?.position ?? 'Sin puesto'} · {Number(payslip.days_worked)} días · IGSS {payslip.employee?.igss_number ?? '—'}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="mb-1 font-medium">Devengos</p>
          {devengos.map((l) => (
            <div key={l.id} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{l.description}{l.quantity ? ` (${Number(l.quantity)})` : ''}</span>
              <span>{money(l.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1 font-medium">
            <span>Total</span><span>{money(payslip.total_earnings)}</span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-medium">Deducciones</p>
          {deducciones.length === 0 && <p className="text-muted-foreground">Ninguna</p>}
          {deducciones.map((l) => (
            <div key={l.id} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{l.description}</span>
              <span>{money(l.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1 font-medium">
            <span>Total</span><span>{money(payslip.total_deductions)}</span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-medium">Neto a pagar</p>
          <p className="text-2xl font-semibold">{money(payslip.net_pay)}</p>
          {patronal.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Costo patronal adicional: {money(payslip.employer_cost)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default PayslipCard
