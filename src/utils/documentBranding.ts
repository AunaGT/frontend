/**
 * Título de pestaña y favicon según configuración del negocio.
 */

const DEFAULT_TITLE = 'Auna'
const DEFAULT_FAVICON = '/auna/favicon.ico'

function faviconMimeType(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('.svg')) return 'image/svg+xml'
  if (lower.includes('.png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

function setLinkRel(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  link.type = faviconMimeType(href)
  link.href = href
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.content = content
}

export function applyDocumentBranding(options: {
  companyName?: string | null
  companyLogoUrl?: string | null
  /** Si se indica, el título será «Página · Empresa». */
  pageTitle?: string | null
}) {
  const name = (options.companyName && String(options.companyName).trim()) || DEFAULT_TITLE
  const favicon = (options.companyLogoUrl && String(options.companyLogoUrl).trim()) || DEFAULT_FAVICON
  const page = options.pageTitle?.trim()

  document.title = page ? `${page} · ${name}` : name

  setLinkRel('icon', favicon)
  setMeta('description', name)
  setMeta('og:title', page ? `${page} · ${name}` : name, 'property')
  setMeta('og:description', name, 'property')
  setMeta('og:image', favicon, 'property')
}
