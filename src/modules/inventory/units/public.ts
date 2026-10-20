// Advanced consumers must use these exact strings for decisions and writes.
// Product's numeric compatibility values are display-only until Tasks 6/7 finish migration.
export type * from './types'
export {advancedProduct,exactProductValues,emptyUnitsDraft,unitsDraft,initialUnitsConfiguration,productDecimalPayload} from './model'
export {fetchUnits,fetchPresentations,saveUnit,savePresentation,archivePresentation,configureProductUnits,previewUnitLine} from './api'
export {normalizeUnitDecimal,normalizeProductQuantity,convertUnitQuantity,deriveUnitPrice,deriveMeasureFactor,unitLineTotal,formatUnitDecimal,formatUnitMoney,unitProductMetrics,compareUnitDecimals} from '@/lib/unitQuantity'
export {countBaseQuantity,selectProductUnit,reconcileUnitPreview,unitCartKey,selectedQuantity,selectedBaseQuantity,selectedLineTotal,selectedUnitPayload,unitTicks,unitFromTicks,addUnitQuantities,remainingUnitQuantity,compareUnitQuantities,stepUnitQuantity} from './selection'
export type {UnitSelection} from './selection'
export {isUnitDocumentLine,frozenDocumentSelection,remainingDocumentQuantity,partialDocumentInput,previewUnitPartialTotal,documentNetAmounts,documentUnitPrice} from './documents'
export type {UnitDocumentLine,PartialUnitBasis} from './documents'
