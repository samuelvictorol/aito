import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import axios from 'axios'
import { canArea, canChannel, firstAllowed, routeAllowed } from '../src/services/access.js'
vi.mock('../src/services/auth-refresh.js', () => ({ API_BASE_URL: '/api', refreshAccessToken: vi.fn(), expireSession: vi.fn() }))
import { refreshAccessToken, expireSession } from '../src/services/auth-refresh.js'
import { useAuthStore } from '../src/stores/auth.js'
import { http } from '../src/services/http.js'
const profile = { id: 'qa-member', role: 'collaborator', name: 'Maria', permissions: { channels: ['whatsapp_cloud'], contacts: 'view', templates: 'manage' } }
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) } }
beforeEach(() => { vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory()); setActivePinia(createPinia()); vi.clearAllMocks() })
describe('collaborator access', () => {
  it('shows only assigned channels and areas and never governance or team management', () => {
    expect(canArea(profile, 'contacts')).toBe(true); expect(canArea(profile, 'contacts', true)).toBe(false)
    expect(canChannel(profile, 'whatsapp_web')).toBe(false); expect(firstAllowed(profile)).toBe('/app-mobile')
    for (const path of ['/', '/whitelabel', '/integrations', '/whatsapp-web/colaboradores', '/app-mobile/web', '/schedules']) expect(routeAllowed(path, profile)).toBe(false)
    for (const path of ['/contacts', '/templates', '/app-mobile/cloud']) expect(routeAllowed(path, profile)).toBe(true)
    expect(firstAllowed({ ...profile, permissions: { channels: [] } })).toBe('/colaborador')
    expect(routeAllowed('/whitelabel', { role: 'admin' })).toBe(true)
  })
  it('authenticates only after the MFA code and clears previous administrative state', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce({ data: { requiresMfa: true, challengeId: 'qa-challenge' } }).mockResolvedValueOnce({ data: { user: profile } })
    try {
      const auth = useAuthStore(), credentials = { username: 'maria', password: 'qa-password', remember: true }
      expect((await auth.loginCollaborator(credentials)).requiresMfa).toBe(true); expect(auth.isAuthenticated).toBe(false)
      localStorage.setItem('aito.communication.accessToken', 'old-admin-token')
      await auth.verifyCollaboratorLogin({ challengeId: 'qa-challenge', code: '123456' }, credentials)
      expect(auth.isCollaborator).toBe(true); expect(auth.token).toBe(null); expect(localStorage.getItem('aito.communication.accessToken')).toBe(null)
      expect(localStorage.getItem('aito.communication.collaborator')).toBe('true'); expect(post.mock.calls[1][1]).not.toHaveProperty('password')
    } finally { post.mockRestore() }
  })
  it('does not fall back to administrative refresh when a collaborator session expires', async () => {
    const auth = useAuthStore(); auth.acceptCollaborator(profile)
    const failure = { response: { status: 401 }, config: { url: '/templates' } }
    await expect(http.interceptors.response.handlers[0].rejected(failure)).rejects.toBe(failure)
    expect(refreshAccessToken).not.toHaveBeenCalled(); expect(expireSession).toHaveBeenCalled()
    await expect(http.interceptors.request.handlers[0].fulfilled({ url: '/contacts/id', method: 'put' })).rejects.toThrow('somente visualização')
  })
})
