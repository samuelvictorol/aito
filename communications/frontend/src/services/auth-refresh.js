import axios from 'axios'
import { inPrototype, prototypeBlocked } from './prototype-runtime.js'
import { clearStoredSession, setAccessToken } from './tokens.js'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const AUTH_REFRESHED_EVENT = 'auth:refreshed'
export const AUTH_EXPIRED_EVENT = 'auth:expired'

let refreshRequest = null

function browserEvent(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

export function publishAuthRefreshed(token) {
  browserEvent(AUTH_REFRESHED_EVENT, { token })
}

export function expireSession() {
  if (inPrototype()) return
  clearStoredSession()
  browserEvent(AUTH_EXPIRED_EVENT)
}

export function refreshAccessToken() {
  if (inPrototype()) return Promise.reject(prototypeBlocked())
  const renew = () => axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
  // Serialize rotations across tabs so each request uses the latest HttpOnly cookie.
  refreshRequest ??= (typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('notify-admin-refresh', renew)
    : renew())
    .then((response) => {
      const result = response.data?.data || response.data
      const token = result?.accessToken || result?.token
      if (!token) throw new Error('Refresh sem novo token')
      setAccessToken(token, result.remembered === true)
      publishAuthRefreshed(token)
      return token
    })
    .finally(() => {
      refreshRequest = null
    })

  return refreshRequest
}
