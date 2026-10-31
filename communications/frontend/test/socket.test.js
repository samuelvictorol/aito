import { beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const handlers = {}
  const windowHandlers = {}
  const socket = {
    connected: false,
    auth: null,
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    connect: vi.fn(function connect() { this.connected = true; return this }),
    disconnect: vi.fn(function disconnect() { this.connected = false; return this }),
  }
  return {
    handlers,
    windowHandlers,
    socket,
    io: vi.fn(() => socket),
    refreshAccessToken: vi.fn(() => Promise.resolve('token-renovado')),
    getStoredUser: vi.fn(() => ({ role: 'admin' })),
    getSession: vi.fn(),
    expireSession: vi.fn(),
  }
})

vi.mock('socket.io-client', () => ({ io: mocks.io }))
vi.mock('axios', () => ({ default: { get: mocks.getSession } }))
vi.mock('../src/services/tokens.js', () => ({ getAccessToken: () => 'token-atual', getStoredUser: mocks.getStoredUser }))
vi.mock('../src/services/auth-refresh.js', () => ({
  AUTH_REFRESHED_EVENT: 'auth:refreshed',
  API_BASE_URL: '/api',
  expireSession: mocks.expireSession,
  refreshAccessToken: mocks.refreshAccessToken,
}))

let socketService

describe('reautenticação do Socket.IO', () => {
  beforeAll(async () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost' },
      addEventListener: vi.fn((event, handler) => { mocks.windowHandlers[event] = handler }),
    })
    socketService = await import('../src/services/socket.js')
  })

  it('renova após desconexão do servidor e reconecta ao receber auth:refreshed', async () => {
    const socket = socketService.connectSocket()
    expect(socket.connected).toBe(true)
    expect(socket.auth).toEqual({ token: 'token-atual' })

    mocks.handlers.disconnect('io server disconnect')
    mocks.handlers.disconnect('io server disconnect')
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1)
    await Promise.resolve()

    mocks.windowHandlers['auth:refreshed']({ detail: { token: 'token-renovado' } })
    expect(socket.auth).toEqual({ token: 'token-renovado' })
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
    expect(socket.connect).toHaveBeenCalledTimes(2)
  })

  it('reconhece falhas de autenticação também no connect_error', () => {
    expect(socketService.isSocketAuthenticationError(new Error('Não autorizado: token expirado'))).toBe(true)
    expect(socketService.isSocketAuthenticationError(new Error('Unauthorized'))).toBe(true)
    expect(socketService.isSocketAuthenticationError(new Error('transport error'))).toBe(false)
    expect(mocks.handlers.connect_error).toBeTypeOf('function')
  })
  it('reconecta colaboradores pelo cookie preservado sem tentar recuperar privilégios administrativos', async () => {
    await Promise.resolve()
    mocks.refreshAccessToken.mockClear()
    mocks.getStoredUser.mockReturnValue({ role: 'collaborator' })
    mocks.getSession.mockResolvedValue({ data: { data: { role: 'collaborator' } } })
    mocks.handlers.disconnect('io server disconnect')
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.getSession).toHaveBeenCalledWith('/api/collaborator/session', { withCredentials: true })
    expect(mocks.socket.connected).toBe(true)
    expect(mocks.expireSession).not.toHaveBeenCalled()
  })
  it('mantém a sessão durante um 502 no redeploy e encerra apenas a identidade revogada', async () => {
    mocks.getSession.mockRejectedValueOnce({ response: { status: 502 } })
    mocks.handlers.disconnect('io server disconnect')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.expireSession).not.toHaveBeenCalled()
    socketService.disconnectSocket()
    mocks.getSession.mockRejectedValueOnce({ response: { status: 401 } })
    mocks.handlers.disconnect('io server disconnect')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.expireSession).toHaveBeenCalledTimes(1)
  })
})
