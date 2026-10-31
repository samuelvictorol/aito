import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../src/services/auth-refresh.js', () => ({ API_BASE_URL: '/api', refreshAccessToken: vi.fn(), expireSession: vi.fn() }))
import { http } from '../src/services/http.js'
import { refreshAccessToken, expireSession } from '../src/services/auth-refresh.js'
import { useAuthStore } from '../src/stores/auth.js'

beforeEach(() => {
  const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) } }
  vi.stubGlobal('localStorage', storage())
  vi.stubGlobal('sessionStorage', storage())
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('admin email verification', () => {
  it.each([502, 503, 429, undefined])('preserves remembered login on temporary bootstrap failure (%s)', async status => {
    localStorage.setItem('aito.communication.rememberDevice', 'true')
    localStorage.setItem('aito.communication.user', JSON.stringify({ role: 'admin', email: 'qa@example.test' }))
    const failure = status ? { response: { status } } : new Error('offline')
    refreshAccessToken.mockRejectedValueOnce(failure)
    const auth = useAuthStore()
    await expect(auth.bootstrap()).rejects.toBe(failure)
    expect(auth.ready).toBe(false)
    expect(localStorage.getItem('aito.communication.rememberDevice')).toBe('true')
    expect(auth.user.email).toBe('qa@example.test')
    refreshAccessToken.mockResolvedValueOnce('restored-token')
    const get = vi.spyOn(http, 'get').mockResolvedValueOnce({ data: { admin: { role: 'admin', email: 'qa@example.test' } } })
    try { await auth.bootstrap(); expect(auth.isAuthenticated).toBe(true); expect(auth.user.role).toBe('admin') } finally { get.mockRestore() }
  })
  it('does not authenticate on password success until the email code is verified', async () => {
    const post = vi.spyOn(http, 'post')
      .mockResolvedValueOnce({ data: { data: { requiresMfa: true, challengeId: 'qa-challenge' } } })
      .mockResolvedValueOnce({ data: { data: { accessToken: 'qa-access', admin: { email: 'qa@example.test' } } } })
    try {
      const auth = useAuthStore()
      const credentials = { email: 'qa@example.test', password: 'qa-password', remember: false }
      expect((await auth.login(credentials)).requiresMfa).toBe(true)
      expect(auth.isAuthenticated).toBe(false)
      expect(localStorage.getItem('aito.communication.accessToken')).toBe(null)
      await auth.verifyEmailLogin({ challengeId: 'qa-challenge', code: '123456' }, credentials)
      expect(auth.isAuthenticated).toBe(true)
      expect(post.mock.calls[1][0]).toBe('/auth/mfa/verify')
      expect(post.mock.calls[1][1]).not.toHaveProperty('password')
    } finally { post.mockRestore() }
  })

  it('an incorrect code or password confirmation does not refresh or discard the admin session', async () => {
    for (const url of ['/auth/mfa/verify', '/auth/mfa/settings/challenge', '/auth/mfa/settings/confirm']) {
      const failure = { response: { status: 401 }, config: { url } }
      await expect(http.interceptors.response.handlers[0].rejected(failure)).rejects.toBe(failure)
    }
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(expireSession).not.toHaveBeenCalled()
  })
  it('restores a new tab using the persistent cookie and never stores the access token in localStorage', async () => {
    refreshAccessToken.mockResolvedValue('renewed-session-token')
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { data: { id: 'qa-admin', email: 'qa@example.test', role: 'admin' } } })
    try {
      const auth = useAuthStore()
      await auth.bootstrap()
      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
      expect(get).toHaveBeenCalledWith('/auth/me')
      expect(auth.isAuthenticated).toBe(true)
      expect(auth.user.role).toBe('admin')
      auth.acceptSession({ accessToken: 'short-lived', user: { role: 'admin' } }, { remember: true })
      expect(sessionStorage.getItem('aito.communication.accessToken')).toBe('short-lived')
      expect(localStorage.getItem('aito.communication.accessToken')).toBe(null)
      expect(localStorage.getItem('aito.communication.rememberDevice')).toBe('true')
    } finally { get.mockRestore() }
  })
  it('a temporary deploy failure while refreshing does not discard a trusted session', async () => {
    refreshAccessToken.mockRejectedValue({ response: { status: 502 } })
    const retry = http.interceptors.response.handlers[0].rejected({ response: { status: 401 }, config: { url: '/contacts', headers: {} } })
    await expect(retry).rejects.toEqual({ response: { status: 502 } })
    expect(expireSession).not.toHaveBeenCalled()
  })
})
