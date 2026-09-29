export async function consumeImportStream(url, { body, token, signal, onEvent = () => {} }) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `No se pudo iniciar la importación (${response.status}).`)
  }
  if (!response.body) throw new Error('La respuesta de importación no contiene progreso.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result
  let terminal = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const line = block.split('\n').find(part => part.startsWith('data: '))
      if (!line) continue
      if (terminal) throw new Error('El servidor envió eventos después del resultado final.')
      const event = JSON.parse(line.slice(6))
      onEvent(event)
      if (event.type === 'error') {
        const error = new Error(event.message || 'No se pudo completar la importación.')
        error.invalidRows = event.invalidRows
        throw error
      }
      if (event.type === 'complete') {
        terminal = true
        result = event.result
      }
    }
  }
  if (!terminal) throw new Error('La importación fue interrumpida. Revisa los datos antes de reintentar.')
  return result
}
