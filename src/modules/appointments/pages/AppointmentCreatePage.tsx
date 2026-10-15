import AgendaCreatePage from './AgendaCreatePage'
export default function AppointmentCreatePage({group=false}:{group?:boolean}) {
  void group
  return <AgendaCreatePage kind="SERVICE"/>
}
export function CreateWorkspace(){return <AgendaCreatePage kind="SERVICE"/>}
