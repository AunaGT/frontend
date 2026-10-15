import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { addJsPdfCompanyHeader, addDocumentFooter, documentTableStyles } from '@/utils/pdfBranding'
import { EMPLOYEE_STATUS_LABELS, PAYMENT_METHOD_LABELS, type Employee } from '@/services/hrService'

/** Solo datos recibidos del expediente autorizado; no consulta ni adjunta archivos privados. */
export function generateEmployeePDF(employees: Employee[], companyName: string, logoDataUrl?: string) {
  if (!employees.length) return
  const doc = new jsPDF()
  employees.forEach((employee, index) => {
    if (index) doc.addPage()
    const y = addJsPdfCompanyHeader(doc, { companyName, logoDataUrl })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Ficha de empleado', 15, y)
    const rows = [['Nombre', `${employee.first_name} ${employee.last_name}`], ['Código', employee.code], ['Estado', EMPLOYEE_STATUS_LABELS[employee.status]], ['DPI', employee.dpi], ['NIT', employee.nit], ['Nacimiento', employee.birth_date?.slice(0, 10)], ['Teléfono', employee.phone], ['Correo', employee.email], ['Dirección', employee.address], ['Puesto', employee.position], ['Departamento', employee.department], ['Sucursal', employee.branch?.name], ['Ingreso', employee.hire_date.slice(0, 10)], ['Salario base', `Q ${Number(employee.base_salary).toFixed(2)}`], ['Bonificación', `Q ${Number(employee.bonificacion_incentivo).toFixed(2)}`], ['IGSS', employee.igss_number], ['Frecuencia de pago', employee.pay_frequency === 'MENSUAL' ? 'Mensual' : 'Quincenal'], ['Forma de pago', PAYMENT_METHOD_LABELS[employee.payment_method]], ['Banco', employee.bank_name], ['Cuenta bancaria', employee.bank_account], ['Usuario vinculado', employee.user?.name]]
    autoTable(doc, { ...documentTableStyles, startY: y + 8, head: [['Dato', 'Información']], body: rows.map(([label, value]) => [label!, value || '—']), margin: { left: 15, right: 15, top: 20, bottom: 20 }, columnStyles: { 0: { cellWidth: 55 } } })
    autoTable(doc, { ...documentTableStyles, head: [['Información complementaria', 'Valor']], body: [['Género', employee.gender || '—'], ['Estado civil', employee.marital_status || '—'], ['Nacionalidad', employee.nationality || '—'], ['Jornada', employee.workday || '—'], ['Horario', employee.work_schedule || '—'], ['Supervisor', employee.supervisor ? `${employee.supervisor.first_name} ${employee.supervisor.last_name}` : '—']], margin: { left: 15, right: 15, top: 20, bottom: 20 } })
  })
  addDocumentFooter(doc, 'Ficha de empleado')
  doc.save(employees.length === 1 ? `empleado-${employees[0].code.replace(/[^a-zA-Z0-9-]/g, '')}.pdf` : 'fichas-empleados.pdf')
}
