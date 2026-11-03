import { isEmbeddedPublicPath } from './embedded-session.js'

// The installed AitoSoftwares app needs its parent navigation. Old bookmarks
// point at the embedded bundle directly, so recover the host without losing a
// conversation or its query. Public pages retain their own login and layout.
export function communicationHostTarget(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  const url = new URL(value, 'https://aitosoftwares.com')
  if (!/^\/comunicacao\/app(?:\/|$)/.test(url.pathname) || isEmbeddedPublicPath(url.pathname)) return null
  const section = url.pathname.replace(/^\/comunicacao\/app\/?/, '')
  return '/admin/comunicacao' + (section ? '/' + section : '') + url.search + url.hash
}

export function installedAppContext(view = globalThis.window) {
  if (!view) return false
  const standalone = context => Boolean(context?.matchMedia?.('(display-mode: standalone)')?.matches || context?.navigator?.standalone === true)
  if (standalone(view)) return true
  try {
    return view.parent !== view && view.parent?.location?.origin === view.location?.origin && standalone(view.parent)
  } catch { return false }
}
