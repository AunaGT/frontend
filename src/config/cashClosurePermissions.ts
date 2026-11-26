export const CASH_CLOSURE_READ_PERMISSIONS = ['cashclosure.view', 'cashclosure.view_team', 'cashclosure.approve', 'cashclosure.validate', 'cashclosure.correct'] as const
export const CASH_DAY_READ_PERMISSIONS = ['cash.day.close','cashclosure.approve','cashclosure.validate'] as const
export const CASH_CLOSURE_CREATE_PERMISSIONS = ['cashclosure.create','cashclosure.create_day','cashclosure.create_own'] as const
export const CASH_CLOSURE_WORKSPACE_PERMISSIONS = [...CASH_CLOSURE_READ_PERMISSIONS,...CASH_CLOSURE_CREATE_PERMISSIONS,...CASH_DAY_READ_PERMISSIONS] as const

export const CASH_DISPUTE_PERMISSIONS = ['cash.disputes.view','cash.disputes.manage','cash.disputes.movements','cash.disputes.resolve','cash.disputes.charge_customer'] as const
