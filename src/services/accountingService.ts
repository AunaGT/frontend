/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch } from '@/services/api'

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'COST' | 'EXPENSE'
export type JournalSourceType = 'MANUAL' | 'SALE' | 'RETURN' | 'PURCHASE' | 'PURCHASE_PAYMENT' | 'CLOSING' | 'STOCK_ADJUSTMENT' | 'PAYROLL' | 'PAYROLL_PAYMENT' | 'PAYROLL_ADVANCE'

export type Account = {
  id: number
  code: string
  name: string
  type: AccountType
  parent_id: number | null
  is_group: boolean
  active: boolean
  system: boolean
}

export type JournalLine = {
  id: number
  account_id: number
  debit: string | number
  credit: string | number
  description: string | null
  account?: { code: string; name: string }
}

export type JournalEntry = {
  id: string
  entry_number: string
  date: string
  description: string
  source_type: JournalSourceType
  source_id: string | null
  branch_id: string | null
  branch?: { id: string; name: string; code: string } | null
  reversal_of_id: string | null
  created_at: string
  lines: JournalLine[]
  createdBy?: { name: string } | null
  reversals?: { id: string; entry_number: string }[]
  reversalOf?: { id: string; entry_number: string } | null
}

export type AccountingPeriod = {
  id: number
  year: number
  month: number
  status: 'OPEN' | 'CLOSED'
  closed_at: string | null
  closedBy?: { name: string } | null
}

export type PostPendingResult = {
  posted: number
  skipped: { source: string; reason: string }[]
  /** La corrida llenó una tanda: quedaron operaciones para la siguiente */
  hasMore?: boolean
}

export type AccountingConfig = { defaults: Record<string, string>; keys: string[] }

export type LedgerResponse = {
  account: { id: number; code: string; name: string; type: AccountType }
  initialBalance: number
  movements: { date: string; entry_id: string; entry_number: string; description: string; debit: number; credit: number; balance: number }[]
  totals: { debit: number; credit: number }
  finalBalance: number
}

export type TrialBalanceRow = {
  account_id: number
  code: string
  name: string
  type: AccountType
  initialBalance: number
  debit: number
  credit: number
  finalBalance: number
}
export type TrialBalanceResponse = {
  rows: TrialBalanceRow[]
  totals: { debit: number; credit: number; initialDebit: number; initialCredit: number; finalDebit: number; finalCredit: number }
}

export type StatementRow = { code: string; name: string; type: AccountType; amount: number }
export type IncomeStatementResponse = {
  income: StatementRow[]
  costs: StatementRow[]
  expenses: StatementRow[]
  totalIncome: number
  totalCosts: number
  grossProfit: number
  totalExpenses: number
  netIncome: number
}
export type BalanceSheetResponse = {
  asOf: string
  assets: StatementRow[]
  liabilities: StatementRow[]
  equity: StatementRow[]
  currentResult: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  balanced: boolean
}

export type JournalListResponse = { items: JournalEntry[]; page: number; pageSize: number; totalPages: number; totalItems: number }

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v))
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const getAccounts = (includeInactive = false) =>
  apiFetch<{ items: Account[] }>(`/accounting/accounts${qs({ includeInactive: includeInactive ? 'true' : undefined })}`)

export const createAccount = (data: { code: string; name: string; type: AccountType; parent_id?: number | null; is_group?: boolean }) =>
  apiFetch<Account>('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) })

export const updateAccount = (id: number, data: { name?: string; parent_id?: number | null; active?: boolean }) =>
  apiFetch<Account>(`/accounting/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const getPeriods = (year?: number) =>
  apiFetch<{ items: AccountingPeriod[] }>(`/accounting/periods${qs({ year })}`)

export const closePeriod = (year: number, month: number) =>
  apiFetch<AccountingPeriod>(`/accounting/periods/${year}/${month}/close`, { method: 'POST' })

export const reopenPeriod = (year: number, month: number) =>
  apiFetch<AccountingPeriod>(`/accounting/periods/${year}/${month}/reopen`, { method: 'POST' })

export const getAccountingConfig = () => apiFetch<AccountingConfig>('/accounting/config')

export const updateAccountingConfig = (defaults: Record<string, string>) =>
  apiFetch<AccountingConfig>('/accounting/config', { method: 'PUT', body: JSON.stringify({ defaults }) })

export const getJournal = (params: { from?: string; to?: string; source?: string; branch_id?: string; page?: number; pageSize?: number }) =>
  apiFetch<JournalListResponse>(`/accounting/journal${qs(params)}`)

export const createJournalEntry = (data: {
  date: string
  description: string
  lines: { account_id: number; debit: number; credit: number; description?: string }[]
}) => apiFetch<JournalEntry>('/accounting/journal', { method: 'POST', body: JSON.stringify(data) })

export const reverseJournalEntry = (id: string) =>
  apiFetch<JournalEntry>(`/accounting/journal/${id}/reverse`, { method: 'POST' })

export const postPending = () =>
  apiFetch<PostPendingResult>('/accounting/post-pending', { method: 'POST' })

export const closeYear = (year: number) =>
  apiFetch<JournalEntry>(`/accounting/close-year/${year}`, { method: 'POST' })

export const getLedger = (accountId: number, params: { from?: string; to?: string }) =>
  apiFetch<LedgerResponse>(`/accounting/ledger/${accountId}${qs(params)}`)

export const getTrialBalance = (params: { from?: string; to?: string }) =>
  apiFetch<TrialBalanceResponse>(`/accounting/trial-balance${qs(params)}`)

export const getIncomeStatement = (params: { from?: string; to?: string; branch_id?: string }) =>
  apiFetch<IncomeStatementResponse>(`/accounting/income-statement${qs(params)}`)

export const getBalanceSheet = (asOf?: string) =>
  apiFetch<BalanceSheetResponse>(`/accounting/balance-sheet${qs({ asOf })}`)

/** Resultado por sucursal: la sucursal como centro de costo dentro de la empresa. */
export type BranchResultRow = {
  branch_id: string | null
  name: string
  income: number
  costs: number
  expenses: number
  netIncome: number
}

export type BranchResultsResponse = {
  branches: BranchResultRow[]
  totals: { income: number; costs: number; expenses: number; netIncome: number }
}

export const getResultsByBranch = (params: { from?: string; to?: string }) =>
  apiFetch<BranchResultsResponse>(`/accounting/by-branch${qs(params)}`)

export type TaxesMonthRow = {
  month: number
  netSales: number
  ivaDebit: number
  ivaCredit: number
  pequenoTax: number
  toPay: number
}

export type TaxesReportResponse = {
  year: number
  regime: 'GENERAL' | 'PEQUENO'
  ivaRate: number
  pequenoRate: number
  months: TaxesMonthRow[]
  totals: Omit<TaxesMonthRow, 'month'>
}

export const getTaxesReport = (year: number) =>
  apiFetch<TaxesReportResponse>(`/accounting/taxes-report${qs({ year })}`)
