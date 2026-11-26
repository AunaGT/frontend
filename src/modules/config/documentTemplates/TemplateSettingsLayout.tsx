import type {ReactNode} from 'react'
import {useNavigate} from 'react-router-dom'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useModules} from '@/context/useModules'
import {SettingsNavigation} from '../components/SettingsNavigation'
import {SETTINGS_SECTIONS,type SettingsSection} from '../settingsModel'
import {FISCAL_READ_PERMISSIONS} from '../connectors/useConnectorScope'
import {PORTAL_READ_PERMISSIONS} from '../customerPages/usePortalScope'
import type {TemplateExitGuard} from './useTemplateLeaveGuard'
import '../pages/config.css'

export function TemplateSettingsLayout({children,companyName,canLeave=()=>true,active='plantillas'}:{children:ReactNode;companyName:string;canLeave?:TemplateExitGuard;active?:SettingsSection}){
  const navigate=useNavigate(),{hasPermission}=useAuthPermissions(),{enabledModuleCodes}=useModules()
  const general=hasPermission('settings.view','settings.manage')
  const sections=SETTINGS_SECTIONS.filter(s=>s.id==='integraciones'?hasPermission('integrations.view','integrations.manage'):s.id==='paginas-clientes'?hasPermission(...PORTAL_READ_PERMISSIONS):s.id==='plantillas'?hasPermission('document_templates.view','document_templates.manage','document_templates.publish'):s.id==='conectores'?hasPermission(...FISCAL_READ_PERMISSIONS):general&&(s.id!=='hardware'||hasPermission('hardware.view'))&&(s.id!=='nomina'||hasPermission('payroll.view')&&!!enabledModuleCodes?.has('payroll')))
  return <div className="config-page auna-page-fluid mx-auto w-full min-w-0 p-4 sm:p-8"><div className="config-center">
    <SettingsNavigation active={active} companyName={companyName} sections={sections} onSelect={id=>{const go=()=>navigate(id==='integraciones'?'/configuracion/integraciones':id==='paginas-clientes'?'/configuracion/paginas-clientes':id==='plantillas'?'/configuracion/plantillas':id==='conectores'?'/configuracion/conectores':`/configuracion?seccion=${id}`);if(canLeave(go))go()}}/>
    <div className="config-center-content config-template-content" role="region" aria-label={active==='integraciones'?'API y claves':active==='paginas-clientes'?'Páginas para clientes':active==='conectores'?'Conectores':'Plantillas de documentos'}>{children}</div>
  </div></div>
}
