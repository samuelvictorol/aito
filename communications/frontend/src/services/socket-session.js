import axios from 'axios'
import { API_BASE_URL } from './auth-refresh.js'

// Netlify forwards HTTP cookies, but WebSocket connections go directly to the
// API domain. Exchange the existing cookie for a narrowly scoped, short-lived
// socket credential. It never enters storage or a query string.
const cache = new Map()
const pending = new Map()
export async function collaboratorSocketToken(kind = 'core', identity = '') {
  const key = kind + ':' + identity
  const saved = cache.get(key)
  if (saved && saved.expiresAt > Date.now() + 30000) return saved.token
  if (pending.has(key)) return pending.get(key)
  const suffix = kind === 'web' ? '/whatsapp-web/collaborator/socket-token' : '/collaborator/socket-token'
  const request = axios.get(API_BASE_URL + suffix, { withCredentials: true }).then(response => {
    const result = response.data?.data || response.data
    if (!result?.token) throw new Error('Não foi possível autenticar o atendimento em tempo real.')
    const expiresAt = Math.min(Date.parse(result.expiresAt) || 0, Date.now() + 300000)
    cache.set(key, { token: result.token, expiresAt })
    return result.token
  }).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
export function clearCollaboratorSocketTokens() { cache.clear() }
