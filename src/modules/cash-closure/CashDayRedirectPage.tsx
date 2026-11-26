import {Navigate,useLocation} from 'react-router-dom'
import {cashDayWorkspaceLink} from './cashWorkspace'
export default function CashDayRedirectPage(){
  const location=useLocation()
  return <Navigate replace to={cashDayWorkspaceLink(location.search)+location.hash}/>
}
