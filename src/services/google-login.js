import { apiBaseURL } from 'boot/axios'

const returnKey = 'aito_auth_return_path'

function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return ''
  const target = new URL(value, window.location.origin)
  return target.origin === window.location.origin && target.pathname !== '/auth/google/callback'
    ? target.pathname + target.search + target.hash
    : ''
}

export function beginGoogleLogin(returnPath = '', audience = 'user') {
  const target = safeReturnPath(returnPath)
  if (target) sessionStorage.setItem(returnKey, target)
  else sessionStorage.removeItem(returnKey)
  window.location.assign(`${apiBaseURL.replace(/\/$/, '')}/auth/google?audience=${encodeURIComponent(audience)}`)
}

export function takeGoogleReturnPath() {
  const target = sessionStorage.getItem(returnKey)
  sessionStorage.removeItem(returnKey)
  return safeReturnPath(target)
}
