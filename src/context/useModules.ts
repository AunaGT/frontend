import { useContext } from 'react'
import { ModuleContext } from './ModuleContext'

export const useModules = () => {
  const context = useContext(ModuleContext)
  if (!context) throw new Error('useModules debe usarse dentro de ModuleProvider')
  return context
}
