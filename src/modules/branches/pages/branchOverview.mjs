export const filterBranches = (rows, filters) => {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return rows.filter((row) => {
    const text = `${row.name} ${row.code} ${row.address || ''} ${row.manager?.name || ''}`.toLocaleLowerCase('es')
    return (!search || text.includes(search)) && (filters.status === 'all' || row.state === filters.status)
  }).sort((a, b) => filters.order === 'code' ? a.code.localeCompare(b.code, 'es') : a.name.localeCompare(b.name, 'es'))
}

export const filterWarehouses = (rows, filters) => {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return rows.filter((row) => {
    const text = `${row.name} ${row.code} ${row.branch?.name || ''} ${row.locations.map((location) => `${location.name || ''} ${location.code}`).join(' ')}`.toLocaleLowerCase('es')
    return (!search || text.includes(search))
      && (filters.branchId === 'all' || row.branch_id === filters.branchId)
      && (filters.status === 'all' || (filters.status === 'active' ? isWarehouseOperational(row) : !isWarehouseOperational(row)))
  })
}

export const isWarehouseOperational = (row) => row.active && row.branch?.active !== false
