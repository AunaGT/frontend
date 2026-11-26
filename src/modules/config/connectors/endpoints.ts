export function endpointError(value: string): string {
  if (!value) return ''
  try {
    if (value.length > 2048 || /[\s\\]/.test(value) || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error()
    const url = new URL(value), host = url.hostname
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|arpa)$/.test(host)) throw new Error()
    return ''
  } catch { return 'Usa HTTPS sin credenciales, parámetros ni fragmentos. No se admiten destinos locales ni direcciones IP.' }
}
