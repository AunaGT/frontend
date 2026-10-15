export type AgendaScope = { companyId: string; branchId: string }
export type CommercialPreparationInfo={commercialPreparation?:'READY'|'PENDING'|'NOT_APPLICABLE';commercialPreparationReason?:string}
export type VenueKind = 'BRANCH' | 'HOME' | 'EVENT_VENUE' | 'ONLINE'
export type VenueInput = { kind: VenueKind; name?: string; address?: string; references?: string; url?: string }
export type LocationInput = { venue?: VenueInput; outboundMinutes?: number; returnMinutes?: number }
export type ScheduleMode = 'INDIVIDUAL' | 'GROUP'
export type SchedulingStyle='APPOINTMENT'|'CLASS'|'WORK'
export type DurationPolicy='FIXED'|'EDITABLE'
export type CompletionPolicy='MANUAL'|'AUTO'
export type CompletionInfo={completionPolicy?:CompletionPolicy;overdue?:boolean;actualCompletedAt?:string|null;commercialCompletionConfirmedAt?:string|null}
export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type BookingStatus = 'HELD' | 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'IN_SERVICE' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'EXPIRED'
export type ProfileInput = {
  schedulingStyle?:SchedulingStyle;durationPolicy?:DurationPolicy;completionPolicy?:CompletionPolicy;
  allowedVenueKinds?: VenueKind[];
  enabled: boolean; mode: ScheduleMode; durationMinutes: number; beforeMinutes: number; afterMinutes: number;
  intervalMinutes: number; leadMinutes: number; horizonDays: number; cancellationHours: number;
  confirmation: 'AUTOMATIC' | 'MANUAL'; capacity: number; requiresProvider: boolean; requiresResource: boolean;
  branchIds: string[]; providerIds: string[]; resourceIds: string[]; instructions: string; publicInstructions?:string; expectedVersion?: number;
}
export type CommercialSnapshot = {
  name: string; unit: string; quantity: string; unitPrice: string; total: string; currencyCode: string; quantityDecimals: number;
}
export type CreateBookingInput = LocationInput & {
  productId: string; contactId: string; startsAt: string; endsAt?:string; timezone: string; providerIds: string[]; resourceIds: string[];
  quantity: string; notes: string; idempotencyKey: string;
}
export type CreateSessionInput = Omit<CreateBookingInput, 'contactId' | 'quantity'> & { capacity: number }
export type EnrollInput = Pick<CreateBookingInput, 'contactId' | 'quantity' | 'notes' | 'idempotencyKey'>
export type MoveInput = LocationInput & Pick<CreateBookingInput, 'startsAt' | 'endsAt' | 'timezone' | 'providerIds' | 'resourceIds' | 'idempotencyKey'> & { expectedVersion: number; reason: string }
export type TransitionInput = {
  action: 'CONFIRM' | 'ARRIVE' | 'START' | 'COMPLETE' | 'NO_SHOW' | 'CANCEL' | 'CONFIRM_COMPLETION'; expectedVersion: number; idempotencyKey: string; reason: string;
}
export type SessionTransitionInput = Omit<TransitionInput, 'action'> & { action: 'START' | 'COMPLETE' | 'CANCEL' }
export type Slot = {
  startsAt: string; endsAt: string; timezone: string; providerIds: string[]; resourceIds: string[]; sessionId: string | null; remaining: number;
}
export type BookingDto = LocationInput & CompletionInfo & CommercialPreparationInfo & {
  engagementId?:string;includedInEngagement?:boolean;
  schedulingPolicy?:Partial<ProfileInput>;
  id: string; sessionId: string; contactId: string; contactName: string; contactImageUrl: string | null;
  productId: string; serviceName: string; branchId: string; startsAt: string; endsAt: string; timezone: string;
  providerIds: string[]; resourceIds: string[]; status: BookingStatus; version: number; expiresAt: string | null;
  commercial: CommercialSnapshot | null; notes: string | null; conflicts: string[];
}
export type SessionDto = LocationInput & CompletionInfo & {
  engagementId?:string;
  schedulingPolicy?:Partial<ProfileInput>;
  id: string; productId: string; serviceName: string; branchId: string; mode: ScheduleMode; bookingId: string | null;
  startsAt: string; endsAt: string; timezone: string; providerIds: string[]; resourceIds: string[];
  status: SessionStatus; capacity: number; occupied: number; version: number; conflicts: string[];
}
export type CalendarInput = {
  timezone: string; expectedVersion: number; validFrom?: string | null; validUntil?: string | null; inheritBranch?: boolean;
  weekly: { weekday: number; from: string; to: string }[];
  exceptions: { date: string; from: string | null; to: string | null; reason: string }[];
}
export type Page<T> = { items: T[]; page: number; pageSize: number; totalItems: number }
export type AgendaFilter = {
  recordType?: 'ACTIVITY' | 'SCHEDULED_SERVICE'; purpose?: 'MEETING' | 'SERVICE_VISIT' | 'EVENT'; venueKind?: VenueKind;
  from: string; to: string; q?: string; providerId?: string; resourceId?: string; productId?: string;
  status?: BookingStatus | SessionStatus; page?: number; pageSize?: number;
}
export type AvailabilityInput = LocationInput & Pick<AgendaFilter, 'from' | 'to'> & { productId: string; durationMinutes?:number;providerIds?: string[]; resourceIds?: string[] }
export type SummaryDto = { reservations: number; pending: number; arrived: number; inService: number; noShow: number }
export type Provider = { id: string; name: string; employeeId: string | null; userId: string | null; branchIds: string[]; active: boolean; version: number; futureSessions?: number }
export type Resource = { id: string; name: string; type: 'ROOM' | 'EQUIPMENT'; portable?: boolean; personCapacity: number | null; branchId: string; active: boolean; version: number; futureSessions?: number }
export type Directory = { timezone?:string;branches: { id: string; name: string }[]; providers: Provider[]; resources: Resource[]; employeeCandidates: { id: string; name: string; photoUrl: string | null; branchId: string }[] }
export type AgendaService = { id: string; name: string; price: string | null; unit: string; quantityDecimals: number; available: boolean; schedulable: boolean; mode: ScheduleMode; durationMinutes: number | null; capacity: number; confirmation?: 'MANUAL' | 'AUTOMATIC';schedulingStyle?:SchedulingStyle;durationPolicy?:DurationPolicy;completionPolicy?:CompletionPolicy;requiresProvider?:boolean;requiresResource?:boolean;providerIds?:string[];resourceIds?:string[];allowedVenueKinds?:VenueKind[];beforeMinutes?:number;afterMinutes?:number }
export type History = { items: { id: string; action: string; at: string; actor: string; reason: string | null }[]; hasMore: boolean }
export type BookingDetail = BookingDto & { history: History }
export type SessionDetail = SessionDto & { bookings: Page<BookingDto>; waitlist: Page<{ id: string; contactId: string; contactName: string; createdAt: string }>; history: History }
export type AgendaEntryDto = Omit<SessionDto,'productId'> & { recordType:'ACTIVITY'|'SCHEDULED_SERVICE'; productId:string|null;
  title:string;purpose:'MEETING'|'SERVICE_VISIT'|'EVENT'|null;organizerName:string;contactName:string;organizerId:string|null;
  occupiedFrom:string;occupiedUntil:string;estimatedAttendance:number|null }
export type EntriesSummaryDto = { activities:number;scheduled:number;inProgress:number;completed:number;cancelled:number }
export type ActivityInput = { purpose:'MEETING'|'SERVICE_VISIT'|'EVENT';title:string;startsAt:string;endsAt:string;timezone:string;
  completionPolicy?:CompletionPolicy;
  serviceScheduling?:'CONFIGURED';
  organizerId:string;userIds:string[];providerIds:string[];resourceIds:string[];guests:{name:string;contactId:string|null}[];
  productId:string|null;venue:VenueInput;estimatedAttendance:number|null;outboundMinutes:number;setupMinutes:number;teardownMinutes:number;returnMinutes:number;notes:string;idempotencyKey:string }
export type ActivityDto = Omit<ActivityInput,'idempotencyKey'|'notes'> & CompletionInfo & CommercialPreparationInfo & { id:string;recordType:'ACTIVITY';branchId:string;status:SessionStatus;version:number;
  engagementId?:string;
  schedulingPolicy?:Partial<ProfileInput>;
  participants:{id:string;name:string}[];providers:{id:string;name:string}[];resources:{id:string;name:string}[];
  notes:string|null;organizer:{id:string;name:string;photoUrl:string|null}|null;occupiedFrom:string;occupiedUntil:string;
  history:{id:string;action:string;actorId:string|null;at:string;reason:string;before:unknown;after:unknown}[] }
