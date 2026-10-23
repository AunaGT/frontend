import type {ReactNode} from 'react'
import {useNavigate} from 'react-router-dom'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useModules} from '@/context/useModules'
import {SettingsNavigation} from '../components/SettingsNavigation'
import {SETTINGS_SECTIONS} from '../settingsModel'
import type {TemplateExitGuard} from './useTemplateLeaveGuard'
import '../pages/config.css'

export function TemplateSettingsLayout({children,companyName,canLeave=()=>true}:{children:ReactNode;companyName:string;canLeave?:TemplateExitGuard}){
  const navigate=useNavigate(),{hasPermission}=useAuthPermissions(),{enabledModuleCodes}=useModules()
  const general=hasPermission('settings.view','settings.manage')
  const sections=SETTINGS_SECTIONS.filter(s=>s.id==='plantillas'||general&&(s.id!=='hardware'||hasPermission('hardware.view'))&&(s.id!=='nomina'||hasPermission('payroll.view')&&!!enabledModuleCodes?.has('payroll')))
  return <div className="config-page auna-page-fluid mx-auto w-full min-w-0 p-4 sm:p-8"><div className="config-center">
    <SettingsNavigation active="plantillas" companyName={companyName} sections={sections} onSelect={id=>{const go=()=>navigate(id==='plantillas'?'/configuracion/plantillas':`/configuracion?seccion=${id}`);if(canLeave(go))go()}}/>
    <div className="config-center-content config-template-content" role="region" aria-label="Plantillas de documentos">{children}</div>
  </div></div>
}
