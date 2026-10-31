import { inPrototype, prototypeAuth } from './prototype-runtime.js'
const ACCESS_TOKEN_KEY = 'aito.communication.accessToken'
const USER_KEY = 'aito.communication.user'

export function getAccessToken() {
  if (inPrototype()) return null
  const legacy = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (legacy) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.setItem('aito.communication.rememberDevice', 'true')
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) sessionStorage.setItem(ACCESS_TOKEN_KEY, legacy)
  }
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token, remember = false) {
  if (inPrototype()) return
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  // Only the opaque HttpOnly refresh cookie remembers authentication for 90 days.
  // Web storage keeps a short-lived per-tab access token and a non-secret preference.
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  if (remember) localStorage.setItem('aito.communication.rememberDevice', 'true')
  else localStorage.removeItem('aito.communication.rememberDevice')
}

export function getStoredUser() {
  if (inPrototype()) return prototypeAuth.user
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function setStoredUser(user, remember = false) {
  if (inPrototype()) return
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(USER_KEY)
  if (user) (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredSession() {
  if (inPrototype()) return
  sessionStorage.removeItem('aito.communication.collaborator')
  localStorage.removeItem('aito.communication.collaborator')
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem('aito.communication.rememberDevice')
}
