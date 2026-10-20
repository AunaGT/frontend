import {printRequest} from '../printing/api'
import type {HardwareScope} from '../types'
import type {DrawerSource} from './flow'
export const findDrawerIntents=(scope:HardwareScope,source:DrawerSource,signal?:AbortSignal)=>printRequest<{items:{id:string;state:string;workstationId:string}[];reason?:string}>(scope,`/operations/drawer-intents?${new URLSearchParams(source)}`,{signal})
export const claimDrawerIntent=(scope:HardwareScope,intentId:string,workstationId:string,signal?:AbortSignal)=>printRequest<{attemptId:string;claimToken:string}>(scope,'/operations/drawer-intents/claim',{method:'POST',signal,body:JSON.stringify({intentId,workstationId,requestKey:crypto.randomUUID(),mode:'SIMULATED'})})
export const completeDrawerSimulation=(scope:HardwareScope,id:string,attempt:{attemptId:string;claimToken:string},signal?:AbortSignal)=>printRequest(scope,`/operations/drawer-intents/${encodeURIComponent(id)}/result`,{method:'POST',signal,body:JSON.stringify({...attempt,outcome:'SIMULATED'})})
