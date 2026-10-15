import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import type {PriceTier} from './types'
const PRICE_TIER_NAMES:Record<PriceTier,string>={LIST:'Normal',WHOLESALE:'Mayoreo',PROMOTION:'Promoción vigente'}
export function PriceTierPicker({value,onChange,disabled=false,label='Precios a imprimir'}:{value:PriceTier[];onChange:(tiers:PriceTier[])=>void;disabled?:boolean;label?:string}){
  return <fieldset className="space-y-2"><legend className="text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{(Object.keys(PRICE_TIER_NAMES) as PriceTier[]).map(tier=><Label key={tier} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-normal"><Checkbox checked={value.includes(tier)} disabled={disabled||value.length===1&&value.includes(tier)} onCheckedChange={checked=>onChange(checked?[...value,tier]:value.filter(p=>p!==tier))}/>{PRICE_TIER_NAMES[tier]}</Label>)}</div></fieldset>
}
