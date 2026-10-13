export const filterRuns = (runs, { month, status, search }) => runs.filter((run) =>
  (!month || run.pay_date.slice(5, 7) === month.padStart(2, '0')) &&
  (!status || run.status === status) &&
  (!search || `${run.code} ${run.name} ${run.branch?.name ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
)

export const filterPayslips = (slips, search) => slips.filter((slip) =>
  !search || `${slip.employee?.first_name ?? ''} ${slip.employee?.last_name ?? ''} ${slip.employee?.code ?? ''} ${slip.employee?.position ?? ''}`
    .toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
)

export const pageItems = (items, page, size) => items.slice((page - 1) * size, page * size)
