import {Navigate,useParams} from 'react-router-dom'

// Preserve old bookmarks without retaining the retired manual-certificate form.
export default function ExternalInvoicePage(){
  const {id}=useParams()
  return <Navigate replace to={id?`/ventas/${encodeURIComponent(id)}/factura`:'/ventas'}/>
}
