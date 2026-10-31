export function protectedMediaPath(value, apiPrefix, origin) {
  if (!value || typeof value !== 'string') return null
  try {
    const base = new URL(apiPrefix, origin)
    const url = new URL(value, base)
    const prefix = base.pathname.replace(/\/$/, '')
    if ([base.origin,'https://notify-flow.onrender.com'].includes(url.origin) && url.pathname.startsWith('/api/whatsapp-web/')) {
      url.pathname = prefix + url.pathname.slice('/api/whatsapp-web'.length)
      url.host = base.host; url.protocol = base.protocol
    }
    if (url.origin !== base.origin || !url.pathname.startsWith(`${prefix}/`)) return null
    const path = url.pathname.slice(prefix.length)
    if (!/^\/(?:assets\/[^/]+\/content|media\/[^/]+)$/.test(path)) return null
    return `${path}${url.search}`
  } catch { return null }
}
