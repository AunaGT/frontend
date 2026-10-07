/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** RRHH: expediente, asistencia y anticipos en tres pestañas. */
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ModuleTabsList, ModuleTabsTrigger } from '@/components/shared/ModuleTabs'
import EmployeesManagement from './EmployeesManagement'
import AttendanceSheet from './AttendanceSheet'
import AdvancesManagement from './AdvancesManagement'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './hr.css'
import { usePageTrail } from '@/components/layout/PageNavigation'

export const HrPage = () => {
  const { hasPermission } = useAuthPermissions()
  const canEmployees = hasPermission('hr.employees.view')
  const canAttendance = hasPermission('hr.attendance.view')
  const canAdvances = hasPermission('hr.advances.view')
  const [tab, setTab] = useState(canEmployees ? 'empleados' : canAttendance ? 'asistencia' : 'anticipos')
  usePageTrail([{ label: tab === 'empleados' ? 'Empleados' : tab === 'asistencia' ? 'Asistencia' : 'Anticipos' }])
  const navigate = useNavigate()
  return (
  <div className="hr-record-page">
  <div className="hr-record-container space-y-5">
    <h1 className="sr-only">{tab === 'empleados' ? 'Empleados' : tab === 'asistencia' ? 'Asistencia' : 'Anticipos'}</h1>
    <Tabs value={tab} onValueChange={setTab}>
      <div className="overflow-x-auto"><ModuleTabsList>
        {canEmployees && <ModuleTabsTrigger value="empleados">Empleados</ModuleTabsTrigger>}
        {canAttendance && <ModuleTabsTrigger value="asistencia">Asistencia</ModuleTabsTrigger>}
        {canAdvances && <ModuleTabsTrigger value="anticipos">Anticipos</ModuleTabsTrigger>}
      </ModuleTabsList></div>
      {canEmployees && <TabsContent value="empleados"><EmployeesManagement actions={<>{tab === 'empleados' && hasPermission('hr.employees.create') && <Button className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => navigate('/rrhh/empleados/nuevo')}><Plus className="mr-2 h-4 w-4" />Nuevo empleado</Button>}</>} /></TabsContent>}
      {canAttendance && <TabsContent value="asistencia"><AttendanceSheet /></TabsContent>}
      {canAdvances && <TabsContent value="anticipos"><AdvancesManagement /></TabsContent>}
    </Tabs>
  </div>
  </div>
)
}

export default HrPage
