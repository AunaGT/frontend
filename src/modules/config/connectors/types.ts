import type { TemplateScope } from '../documentTemplates/types'
export type ConnectorScope = TemplateScope
export type Environment = 'TEST' | 'PRODUCTION'
export const credentialLabels = { signUser: 'Usuario de firma', signKey: 'Llave de firma', apiUser: 'Usuario de certificación', apiKey: 'Llave de certificación' } as const
export type CredentialField = keyof typeof credentialLabels
export type Credentials = Record<CredentialField, string>
export const endpointLabels = { ISSUE: 'Emisión de facturas', CREDIT_NOTE: 'Notas de crédito', CANCEL: 'Anulación', LOOKUP: 'Consulta y recuperación' } as const
export type EndpointAction = keyof typeof endpointLabels
export type Endpoints = Record<EndpointAction, string | null>
export type ConnectionErrors = Partial<Record<CredentialField | `endpoints.${EndpointAction}` | 'endpoints', string>>
export type Connection = {
  id: string | null; environment: Environment; state: string; revision: number; updatedAt: string | null
  credentialStatus: Record<CredentialField, boolean>
  endpoints: Endpoints
  capabilities: { encryptionReady: boolean; externalSendingAllowed: false; productionReady: false }
}
export type LocalReview = { kind: 'LOCAL_ONLY'; externalContact: false; credentialsVerified: false; productionReady: false }
export type HistoryEvent = { id: string; action: string; createdAt: string; actorId: string }
export type Command = { expectedVersion: number; idempotencyKey: string; credentials?: Partial<Credentials>; endpoints?: Partial<Endpoints> }
export type TaxRule = { id: string; name: string; mode: 'INCLUDED' | 'EXEMPT' | 'NO_BREAKDOWN'; rate: string; exemptionCode: string }
export type Establishment = { branchId: string; code: string; name: string; address: string; municipality: string; department: string; postalCode: string }
export type ProfileDraft = {
  documentType: '' | 'FACT' | 'FPEQ'; taxRules: TaxRule[]
  unitMap: { kind: 'UNIT' | 'PRESENTATION' | 'LEGACY_PRODUCT'; targetId: string; satCode: string }[]
  productTaxMap: { productId: string; taxRuleId: string }[]
  categoryTaxMap: { categoryId: number; taxRuleId: string }[]
  establishments: Establishment[]
}
export type CompanyTaxConfiguration = { source: 'COMPANY_SETTINGS'; regime: 'GENERAL' | 'PEQUENO' | null; ivaPercent: string | null; pequenoPercent: string | null; ivaRate: string | null; pequenoRate: string | null; revisionFingerprint: string; issues: Record<string, string> }
export type Issuer = { emitter: { legalName: string; commercialName: string; taxId: string; address: string; municipality: string; department: string; postalCode: string; vatAffiliation: string }; currency: string; settingsFingerprint: string; taxConfiguration: CompanyTaxConfiguration }
export type FiscalProfile = { connectionId: string | null; versionId: string | null; revision: number; environment: Environment; profile: (ProfileDraft & Issuer) | null; currentIssuer: Issuer; labels: Record<string, string>; readiness: { valid: boolean; productionReady: false; externalContact: false; fieldErrors: Record<string, string> } }
export type CatalogKind = 'branch' | 'category' | 'product' | 'unit' | 'presentation'
export type CatalogPage = { rows: { id: string | number; label: string }[]; total: number; page: number; pageSize: number }
export type ProviderCatalog = {
  selectedProvider: string | null
  revision: number
  providers: { id: 'INFILE'; name: string; mode: 'OFFLINE'; externalSendingAllowed: false }[]
  externalSendingAllowed: false
}
