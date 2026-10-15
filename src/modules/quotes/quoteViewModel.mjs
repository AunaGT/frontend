/** Las cotizaciones borrador, respondidas o vencidas no aceptan respuestas. */
export function canRespondToQuote(quote, now = new Date()) {
  return quote.status === 'SENT' && (!quote.valid_until || new Date(quote.valid_until).getTime() > now.getTime())
}
export function quoteAgendaDestination(quote) {
  return quote.engagementId ? `/agenda/contrataciones/${quote.engagementId}`
    : `/agenda/contrataciones/nueva?cotizacion=${encodeURIComponent(quote.id)}`
}
