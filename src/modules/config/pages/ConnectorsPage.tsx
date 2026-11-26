import { useState } from 'react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useConnectorScope } from '../connectors/useConnectorScope'
import type { Environment } from '../connectors/types'
import { ConnectorCatalog } from './ConnectorCatalog'
export { InfileConnection } from './InfileConnection'

export default function ConnectorsPage() {
  const context = useConnectorScope(), [environment, setEnvironment] = useState<Environment>('TEST')
  usePageTrail([{ label: 'Conectores' }])
  if (!context.scope || !context.canRead) return <div className="p-6" role="status">Selecciona una empresa y una sesión con permiso para ver conectores.</div>
  return <ConnectorCatalog key={JSON.stringify([context.scope, context.canManage, context.canTest])} {...context} scope={context.scope} environment={environment} onEnvironment={setEnvironment}/>
}
