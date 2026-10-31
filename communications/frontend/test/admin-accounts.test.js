import { describe, it, expect, vi } from 'vitest'
import { routeAllowed } from '../src/services/access.js'

const get = vi.fn(), post = vi.fn()
vi.mock('../src/services/http.js', () => ({ http: { get: (...args) => get(...args), post: (...args) => post(...args) }, unwrap: response => response.data.data }))
const { adminAccountsApi } = await import('../src/services/admin-accounts.js')

describe('administrative governance', () => {
  it('is available to an admin and inaccessible to collaborators with every channel and area permission', () => {
    expect(routeAllowed('/administrators', { role: 'admin' })).toBe(true)
    expect(routeAllowed('/administrators', { role: 'collaborator', permissions: { channels: ['whatsapp_web','whatsapp_cloud','telegram','email'], contacts: 'manage', templates: 'manage', notifications: 'manage', schedules: 'manage', invites: 'manage' } })).toBe(false)
  })
  it('uses the authenticated API and unwraps public results without storing credentials', async () => {
    get.mockResolvedValueOnce({ data: { data: { items: [], total: 0 } } })
    expect(await adminAccountsApi.list({ page: 1, limit: 20 })).toEqual({ items: [], total: 0 })
    expect(get).toHaveBeenCalledWith('/admin-accounts', { params: { page: 1, limit: 20 } })
    const input = { email: 'new@example.test', password: 'QA-new-secret', currentPassword: 'QA-current-secret', conversationNick: 'Novo Admin' }
    post.mockResolvedValueOnce({ data: { data: { id: 'new-admin' } } })
    expect(await adminAccountsApi.create(input)).toEqual({ id: 'new-admin' })
    expect(post).toHaveBeenCalledWith('/admin-accounts', input)
  })
})
