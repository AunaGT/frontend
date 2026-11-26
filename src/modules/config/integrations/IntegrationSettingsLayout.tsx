import type {ReactNode} from 'react'
import {Link} from 'react-router-dom'
import {TemplateSettingsLayout} from '../documentTemplates/TemplateSettingsLayout'
import './integrations.css'
export function IntegrationSettingsLayout({children,companyName}:{children:ReactNode;companyName:string}){return <TemplateSettingsLayout active="integraciones" companyName={companyName}><div className="integration-page"><nav aria-label="Ruta de integraciones"><Link to="/configuracion/integraciones">Integraciones · API y claves</Link></nav>{children}</div></TemplateSettingsLayout>}
export function IntegrationAccessState({denied=false}:{denied?:boolean}){return <section className="p-6"><h1>API y claves</h1><p role="status">{denied?'No tienes permiso para ver integraciones.':'Comprobando empresa y sesión…'}</p></section>}
