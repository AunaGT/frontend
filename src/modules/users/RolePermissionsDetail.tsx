import { useParams } from 'react-router-dom'
import RoleEditor from './RoleEditor'

export default function RolePermissionsDetail() {
  const { id } = useParams<{ id: string }>()
  return <RoleEditor id={Number(id)} />
}
