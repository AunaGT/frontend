import * as contract from './labelContract'
import type {LabelDesign,PaperSettings,TextStyle} from './types'
export const PAPER_SIZES=contract.PAPER_SIZES
export const textStyle=(bold=false,fontSize=9):TextStyle=>contract.textStyle(bold,fontSize) as TextStyle
export const createLabelTemplate=(preset:'essential'|'product'|'price'='product'):LabelDesign=>contract.createLabelTemplate(preset) as LabelDesign
export const createShelfLabelTemplate=(preset:'essential'|'product'|'price'='price'):LabelDesign=>contract.createShelfLabelTemplate(preset) as LabelDesign
export const parseLabelDesign=(raw:unknown):LabelDesign=>contract.parseLabelDesign(raw) as LabelDesign
export const defaultPaper=():PaperSettings=>contract.defaultPaper() as PaperSettings
export const parsePaperSettings=(raw:unknown):PaperSettings=>contract.parsePaperSettings(raw) as PaperSettings
