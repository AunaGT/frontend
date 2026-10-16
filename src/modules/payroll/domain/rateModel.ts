import type {PayrollRates,RatesSnapshot} from '@/modules/payroll/api/rateVersions'
export const RATE_FIELDS=[
  {key:'igssLaboral',label:'IGSS del trabajador',group:'Aportes',kind:'percent'},
  {key:'igssPatronal',label:'IGSS patronal',group:'Aportes',kind:'percent'},
  {key:'irtra',label:'IRTRA',group:'Aportes',kind:'percent'},
  {key:'intecap',label:'INTECAP',group:'Aportes',kind:'percent'},
  {key:'bonificacionIncentivo',label:'Bonificación inicial de nuevos empleados',group:'Importes e ISR',kind:'money'},
  {key:'isrDeduccionUnica',label:'Deducción única anual ISR',group:'Importes e ISR',kind:'money'},
  {key:'isrTramo1Limite',label:'Límite del primer tramo ISR',group:'Importes e ISR',kind:'money'},
  {key:'isrTramo1Tasa',label:'Tasa del primer tramo ISR',group:'Importes e ISR',kind:'percent'},
  {key:'isrTramo2Fijo',label:'Importe fijo del segundo tramo ISR',group:'Importes e ISR',kind:'money'},
  {key:'isrTramo2Tasa',label:'Tasa del segundo tramo ISR',group:'Importes e ISR',kind:'percent'},
  {key:'horaExtraFactor',label:'Multiplicador de horas extra',group:'Horas extra y provisiones',kind:'factor'},
  {key:'provisionAguinaldo',label:'Provisión de aguinaldo',group:'Horas extra y provisiones',kind:'percent'},
  {key:'provisionBono14',label:'Provisión de bono 14',group:'Horas extra y provisiones',kind:'percent'},
  {key:'provisionVacaciones',label:'Provisión de vacaciones',group:'Horas extra y provisiones',kind:'percent'},
  {key:'provisionIndemnizacion',label:'Provisión de indemnización',group:'Horas extra y provisiones',kind:'percent'},
] as const
export type RatesDraft=Record<string,string>
const displayNumber=(n:number)=>String(Number(n.toPrecision(14)))
export const ratesToDraft=(rates:PayrollRates):RatesDraft=>Object.fromEntries(RATE_FIELDS.map(f=>[f.key,displayNumber(rates[f.key]*(f.kind==='percent'?100:1))]))
export function validateRatesDraft(draft:RatesDraft){
  const errors:Record<string,string>={}
  for(const f of RATE_FIELDS){const raw=draft[f.key],n=Number(raw),max=f.kind==='percent'?100:f.kind==='factor'?10:1e12
    if(typeof raw!=='string'||!raw.trim()||!Number.isFinite(n)||n<0||n>max||(f.kind==='factor'&&n===0))errors[f.key]=`Ingresa ${f.kind==='factor'?'un valor mayor a 0':'un valor desde 0'} hasta ${max}.`
  }return errors
}
export function ratesPayload(draft:RatesDraft):PayrollRates{
  if(Object.keys(validateRatesDraft(draft)).length)throw Error('Revisa los parámetros de nómina')
  return Object.fromEntries(RATE_FIELDS.map(f=>[f.key,Number(displayNumber(Number(draft[f.key])/(f.kind==='percent'?100:1)))]))
}
export const rateDifferences=(before:PayrollRates|undefined,after:PayrollRates)=>RATE_FIELDS.filter(f=>before?.[f.key]!==after[f.key]).map(f=>({...f,before:before?.[f.key],after:after[f.key]}))
export const canAdoptRunRates=(run:{status:string},allowed:boolean)=>run.status==='BORRADOR'&&allowed
export const runRateSource=(run:{rates_snapshot?:RatesSnapshot|null})=>!run.rates_snapshot?'Planilla histórica sin copia de parámetros; se conservan sus recibos originales.':run.rates_snapshot.source==='version'?'Versión publicada, congelada para esta planilla.':run.rates_snapshot.source==='baseline'?'Configuración heredada capturada, congelada para esta planilla.':'Configuración compatible capturada al crear el borrador.'
