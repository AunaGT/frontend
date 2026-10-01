export function roleDraft(role) {
  return {
    name: role?.protected ? `${role.name} copia`.slice(0, 50) : role?.name || '',
    description: role?.description || '',
    selected: role?.permissions?.map(permission => permission.code) || [],
  }
}
