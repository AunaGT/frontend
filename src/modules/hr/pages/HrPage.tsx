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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EmployeesManagement from './EmployeesManagement'
import AttendanceSheet from './AttendanceSheet'
import AdvancesManagement from './AdvancesManagement'

export const HrPage = () => (
  <div className="space-y-4 p-4">
    <h1 className="text-2xl font-semibold">Recursos Humanos</h1>
    <Tabs defaultValue="empleados">
      <TabsList>
        <TabsTrigger value="empleados">Empleados</TabsTrigger>
        <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
        <TabsTrigger value="anticipos">Anticipos</TabsTrigger>
      </TabsList>
      <TabsContent value="empleados"><EmployeesManagement /></TabsContent>
      <TabsContent value="asistencia"><AttendanceSheet /></TabsContent>
      <TabsContent value="anticipos"><AdvancesManagement /></TabsContent>
    </Tabs>
  </div>
)

export default HrPage
