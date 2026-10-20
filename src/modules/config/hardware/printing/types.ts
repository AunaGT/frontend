import type {HardwareScope} from '../types'
export type {HardwareScope}
export type PrintSource={kind:'SALE_TICKET'|'LABEL_PREPARATION';id:string}
export type PrintRoute={workstationId:string;version:number;cashRegisterId:string|null;destination:{id:string;name:string;role:string;version:number;profile:Record<string,unknown>}|null}
export type PrintOptions={document?:'MAIN'|'GUIDE';workstationId?:string;destinationId?:string}
export type PrintJob={id:string;parentId?:string;source:PrintSource;state:'CREATED'|'PREPARED'|'DOWNLOAD_REQUESTED'|'FAILED';destinationName?:string;document:'MAIN'|'GUIDE';createdAt:string;reason?:string;capabilities?:{reprint:boolean}}
export type RenderedPrint={blob:Blob;filename:string}
export type PrintState={pending:boolean;job:PrintJob|null;blob:Blob|null;filename:string;error:string;fallbackAvailable:boolean}
