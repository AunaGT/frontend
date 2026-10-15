export function roleDraft(role) {
  return {
    name: role?.name || '',
    description: role?.description || '',
    selected: role?.permissions?.map(permission => permission.code) || [],
  }
}
