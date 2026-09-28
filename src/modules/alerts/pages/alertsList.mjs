export const filterAlerts = (alerts, filters) => {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return alerts.filter((alert) => {
    const text = `${alert.id} ${alert.title} ${alert.message} ${alert.product} ${alert.typeName}`.toLocaleLowerCase('es')
    return (!search || text.includes(search))
      && (filters.priority === 'all' || alert.priority === filters.priority)
      && (filters.status === 'all' || alert.status === filters.status)
      && (filters.type === 'all' || alert.typeName === filters.type)
      && (!filters.from || alert.localDate >= filters.from)
      && (!filters.to || alert.localDate <= filters.to)
  }).sort((a, b) => (filters.order === 'oldest' ? 1 : -1) * a.timestampIso.localeCompare(b.timestampIso))
}
