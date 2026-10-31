export function publicManifestUrl(base = import.meta.env.BASE_URL || '/') {
  return (base === '/' ? '/api/' : base.replace(/app\/$/, 'api/')) + 'settings/app.webmanifest'
}
export function pwaBrand(branding = {}, base = import.meta.env.BASE_URL || '/') {
  const fallback = base + 'icons/aito-v2-180.png'
  let logoUrl = fallback
  try {
    const url = new URL(branding.logoUrl, location.origin)
    if (branding.logoUrl && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) logoUrl = url.href
  } catch {}
  return { appName: String(branding.appName || 'AitoNotify').slice(0, 80), logoUrl, themeColor: /^#[0-9a-f]{6}$/i.test(branding.primaryColor) ? branding.primaryColor : '#35BCA4', manifestUrl: publicManifestUrl(base) }
}
export function applyPwaBranding(branding) {
  const brand = pwaBrand(branding)
  if (typeof document === 'undefined' || !document.head || !document.createElement) return brand
  function link(rel, href) {
    let element = document.querySelector(`link[rel="${rel}"]`)
    if (!element) { element = document.createElement('link'); element.rel = rel; document.head.appendChild(element) }
    element.href = href
  }
  link('apple-touch-icon', brand.logoUrl)
  link('icon', brand.logoUrl)
  let title = document.querySelector('meta[name="apple-mobile-web-app-title"]')
  if (!title) { title = document.createElement('meta'); title.name = 'apple-mobile-web-app-title'; document.head.appendChild(title) }
  title.content = brand.appName
  if (window.parent !== window) window.parent.postMessage({ type: 'aito.communication.branding', branding: brand }, location.origin)
  return brand
}
