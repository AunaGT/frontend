/** Las cotizaciones borrador, respondidas o vencidas no aceptan respuestas. */
export function canRespondToQuote(quote, now = new Date()) {
  return quote.status === 'SENT' && (!quote.valid_until || new Date(quote.valid_until).getTime() > now.getTime())
}
