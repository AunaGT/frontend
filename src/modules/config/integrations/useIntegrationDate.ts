import {useSystemSettings} from '@/hooks/useSystemSettings'
export function useIntegrationDate(){
 const {locale,timezone}=useSystemSettings()
 const formatter=new Intl.DateTimeFormat(locale,{timeZone:timezone,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})
 return(value:string|null)=>value===null?'Sin vencimiento':formatter.format(new Date(value))
}
