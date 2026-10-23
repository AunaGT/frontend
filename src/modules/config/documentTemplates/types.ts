export type PaperFormat='LETTER'|'A4'|'RECEIPT_80'
export type DocumentPurpose='INTERNAL_RECEIPT'|'FEL_INVOICE'
export type TemplateScope={companyId:string;branchId?:string;userId:string;sessionId:string}
export type Theme={fontFamily?:string;fontSize?:number;accentColor?:string;textColor?:string;spacing?:number}
export type Appearance=Theme&{headerText?:string;footerText?:string;preferredFormat?:'LETTER'|'A4'}
export type BlockKind='HEADER'|'EMITTER'|'RECEIVER'|'DETAILS'|'TOTALS'|'NOTES'|'FISCAL'|'FOOTER'
export type ColumnStyle={label?:string;width?:number;align?:'left'|'center'|'right';when?:'ALWAYS'|'HAS_DISCOUNT'}
export type ColumnStyles=Record<string,ColumnStyle>
export type Design={schemaVersion:1;purpose:'INTERNAL_RECEIPT'|'FEL_INVOICE';paper:{format:PaperFormat;margin:number};base:{id:string;version:number};themeOverrides:Theme;blocks:{id:string;kind:BlockKind;settings:Record<string,string|boolean|string[]|ColumnStyles>;when?:'ALWAYS'|'HAS_NOTE'|'HAS_DISCOUNT'}[]}
export type TemplateRow={id:string;name:string;purpose:Design['purpose'];format:PaperFormat;version:number;versionId:string;versionNumber:number;state:'ACTIVE'|'ARCHIVED';status:'DRAFT'|'PUBLISHED'|'ARCHIVED';design:Design;source:string;updatedAt:string;isDefault?:boolean;activeVersionNumber?:number}
export type Diagnostic={path:string;line?:number;column?:number;message:string}
export type Artifact={id:string;snapshotId:string;format:PaperFormat;state:'QUEUED'|'RENDERING'|'READY'|'FAILED';errorCode?:string;filename?:string}
export type Schema={schemaVersion:1;rendererVersion:string;formats:PaperFormat[];bases:string[];purposes:string[];conditions:string[];columns:string[];theme:Record<string,string|string[]|number[]>;blocks:Record<BlockKind,{required:boolean;settings:Record<string,string|string[]>}>;limits:{xmlBytes:number};xml:{rootAttributes:string[];blockAttributes:string[];columnAttributes?:string[]};presets:Record<string,Record<PaperFormat,Design>>;fiscalPresets?:Record<string,Record<PaperFormat,Design>>;fiscalEnabled?:boolean;defaults?:{ticketFormat:PaperFormat;sheetFormat:PaperFormat;base:string}}
export const formatLabels:Record<PaperFormat,string>={LETTER:'Carta',A4:'A4',RECEIPT_80:'Ticket · 80 mm'}
export const baseLabels:Record<string,string>={CLASSIC:'Clásica',COMPACT:'Compacta',CORPORATE:'Corporativa'}
export const fiscalTemplateNotice=(enabled?:boolean)=>enabled?'Este negocio tiene FEL activado. La factura quedará pendiente de certificación hasta conectar el certificador; mientras tanto se entrega el comprobante interno.':'La facturación electrónica está desactivada. Solo se emite el comprobante interno; este diseño de factura queda disponible como pendiente.'
