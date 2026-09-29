import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeImportStream } from './importStream.mjs'

test('reconstruye eventos divididos entre paquetes y devuelve solo resultado final', async () => {
  const observed = []
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  const payload = 'data: {"type":"progress","phase":"saving","processed":1,"total":2}\n\ndata: {"type":"complete","result":{"created":2}}\n\n'
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload.slice(0, 17)))
      controller.enqueue(encoder.encode(payload.slice(17)))
      controller.close()
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  try {
    const result = await consumeImportStream('/api/import', { body: { items: [] }, onEvent: event => observed.push(event) })
    assert.deepEqual(result, { created: 2 })
    assert.equal(observed[0].processed, 1)
    assert.equal(observed.at(-1).type, 'complete')
  } finally { globalThis.fetch = originalFetch }
})

test('rechaza un stream cortado sin evento final', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('data: {"type":"progress","processed":1,"total":2}\n\n', { status: 200 })
  try {
    await assert.rejects(() => consumeImportStream('/api/import', { body: {} }), /interrumpida/i)
  } finally { globalThis.fetch = originalFetch }
})

test('acepta separadores CRLF aunque se dividan entre paquetes', async () => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  const chunks = [encoder.encode('data: {"type":"complete","result":{"created":1}}\r\n\r'), encoder.encode('\n')]
  globalThis.fetch = async () => ({ ok: true, body: { getReader: () => ({ read: async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true } }) } })
  try {
    assert.deepEqual(await consumeImportStream('/api/import', { body: {} }), { created: 1 })
  } finally { globalThis.fetch = originalFetch }
})

test('propaga cancelación al servidor y no devuelve un resultado falso', async () => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  try {
    const request = consumeImportStream('/api/import', { body: {}, signal: controller.signal })
    controller.abort()
    await assert.rejects(request, error => error.name === 'AbortError')
  } finally { globalThis.fetch = originalFetch }
})
