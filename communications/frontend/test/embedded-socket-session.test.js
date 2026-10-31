import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('axios', () => ({ default: { get } }))
vi.mock('../src/services/auth-refresh.js', () => ({ API_BASE_URL: '/comunicacao/api' }))
import { collaboratorSocketToken, clearCollaboratorSocketTokens } from '../src/services/socket-session.js'

beforeEach(() => { clearCollaboratorSocketTokens(); get.mockReset(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T12:00:00Z')) })
afterEach(() => vi.useRealTimers())
const issued = token => ({ data: { data: { token, expiresAt: new Date(Date.now() + 300000).toISOString() } } })
describe('socket-only collaborator credential exchange', () => {
  it('uses the same-origin cookie exchange, coalesces requests and keeps credentials out of addresses', async () => {
    get.mockResolvedValue(issued('socket-only-token'))
    expect(await Promise.all([collaboratorSocketToken('core','ana'),collaboratorSocketToken('core','ana')])).toEqual(['socket-only-token','socket-only-token'])
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/comunicacao/api/collaborator/socket-token', {withCredentials:true})
    expect(await collaboratorSocketToken('core','ana')).toBe('socket-only-token')
    expect(get).toHaveBeenCalledTimes(1)
  })
  it('separates identities and namespaces, renews before expiry and clears on logout', async () => {
    get.mockImplementation(async url => issued(url.includes('whatsapp-web')?'web-socket-token':'core-socket-token'))
    await collaboratorSocketToken('core','ana');await collaboratorSocketToken('web','ana');await collaboratorSocketToken('core','bruno')
    expect(get).toHaveBeenCalledTimes(3)
    expect(get).toHaveBeenCalledWith('/comunicacao/api/whatsapp-web/collaborator/socket-token',{withCredentials:true})
    vi.advanceTimersByTime(271000);await collaboratorSocketToken('core','ana');expect(get).toHaveBeenCalledTimes(4)
    clearCollaboratorSocketTokens();await collaboratorSocketToken('core','ana');expect(get).toHaveBeenCalledTimes(5)
  })
  it('does not accept a cookie/session response as a socket token and can retry a failed exchange', async () => {
    get.mockResolvedValueOnce({data:{data:{user:{role:'collaborator'}}}}).mockResolvedValueOnce(issued('new-token'))
    await expect(collaboratorSocketToken()).rejects.toThrow('autenticar')
    expect(await collaboratorSocketToken()).toBe('new-token')
  })
})
