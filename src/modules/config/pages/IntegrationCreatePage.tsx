import {useSearchParams} from 'react-router-dom'
import {useIntegrationScope} from '../integrations/useIntegrationScope'
import {IntegrationSettingsLayout,IntegrationAccessState} from '../integrations/IntegrationSettingsLayout'
import {CredentialForm} from '../integrations/CredentialForm'
export default function IntegrationCreatePage(){const context=useIntegrationScope(),[params]=useSearchParams(),replaceId=params.get('reemplazar')||undefined;if(!context.scope||!context.canManage)return <IntegrationAccessState denied={!context.canManage}/>;return <IntegrationSettingsLayout companyName={context.companyName}>{context.readOnly?<p>Selecciona una sucursal para administrar claves.</p>:<CredentialForm key={context.key+replaceId} context={context} replaceId={replaceId}/>}</IntegrationSettingsLayout>}
