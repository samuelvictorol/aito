import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  host: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  collaborator: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  refresh: vi.fn(), scoped: vi.fn(), clearScoped: vi.fn(),
  io: vi.fn(),
  socket: { on: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
}))
vi.mock('../src/services/http.js', () => ({ API_BASE_URL: '/api', http: mocks.host, errorMessage: (error) => error.message }))
vi.mock('../src/services/tokens.js', () => ({ getAccessToken: () => 'host-session-token', getStoredUser: () => null }))
vi.mock('../src/services/auth-refresh.js', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired', AUTH_REFRESHED_EVENT: 'auth:refreshed', refreshAccessToken: mocks.refresh,
}))
vi.mock('../src/services/socket-session.js', () => ({collaboratorSocketToken:mocks.scoped,clearCollaboratorSocketTokens:mocks.clearScoped}))
vi.mock('axios', () => ({ default: { create: () => mocks.collaborator } }))
vi.mock('socket.io-client', () => ({ io: mocks.io }))

describe('sessões isoladas do WhatsApp Web', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.io.mockReturnValue(mocks.socket)
    mocks.scoped.mockResolvedValue('collaborator-socket-only')
    vi.stubGlobal('window', { location: { origin: 'https://aito.communication.example' }, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('reutiliza autenticação e atualização do host somente no painel administrativo', async () => {
    const service = await import('../src/modules/whatsapp-web/services.js')
    service.startSessionListeners()
    await service.api.get('/flows')
    expect(mocks.host.get).toHaveBeenCalledWith('/flows', expect.objectContaining({ baseURL: '/api/whatsapp-web' }))
    expect(mocks.collaborator.get).not.toHaveBeenCalled()
    const callback = vi.fn()
    mocks.io.mock.calls[0][1].auth(callback)
    expect(callback).toHaveBeenCalledWith({ token: 'host-session-token' })
    service.stopSessionListeners()
  })

  it('mantém APIs do atendente por cookie e troca credencial somente para o socket, sem renovar o administrador', async () => {
    const service = await import('../src/modules/whatsapp-web/services.js')
    service.startSessionListeners({ collaboratorOnly: true })
    mocks.collaborator.get.mockRejectedValueOnce({ response: { status: 401 } })
    await expect(service.api.get('/auth/me')).rejects.toEqual({ response: { status: 401 } })
    expect(mocks.host.get).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
    const callback = vi.fn()
    mocks.io.mock.calls[0][1].auth(callback)
    await Promise.resolve()
    expect(callback).toHaveBeenCalledWith({token:'collaborator-socket-only'})
    expect(mocks.scoped).toHaveBeenCalledWith('web','')
    service.stopSessionListeners()
  })

  it('aplica permissões de envio no transporte por cookie sem promover o colaborador', async () => {
    const service = await import('../src/modules/whatsapp-web/services.js')
    service.currentUser.value = { id: 'team', role: 'collaborator', permissions: { channels: ['whatsapp_web'], whatsapp_web: 'view' } }
    const guard = mocks.collaborator.interceptors.request.use.mock.calls[0][0]
    const request = { baseURL: '/api/whatsapp-web', url: '/chats/123/messages', method: 'post' }
    await expect(guard(request)).rejects.toThrow('somente visualização')
    service.currentUser.value.permissions.whatsapp_web = 'manage'
    expect(guard(request)).toBe(request)
    service.currentUser.value.permissions.actions = { 'whatsapp_web.send': false }
    await expect(guard(request)).rejects.toThrow('não autoriza')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('retoma o socket após refresh temporariamente indisponível sem descartar o usuário', async () => {
    vi.useFakeTimers()
    mocks.refresh.mockRejectedValueOnce({ response: { status: 503 } })
    const service = await import('../src/modules/whatsapp-web/services.js')
    service.startSessionListeners(); service.currentUser.value = { id: 'admin-fixture' }
    const disconnected = mocks.socket.on.mock.calls.find(([name]) => name === 'disconnect')[1]
    disconnected('io server disconnect')
    await vi.advanceTimersByTimeAsync(0)
    expect(service.currentUser.value.id).toBe('admin-fixture')
    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.socket.connect).toHaveBeenCalledTimes(1)
    service.stopSessionListeners()
    await vi.advanceTimersByTimeAsync(10000)
    expect(mocks.socket.connect).toHaveBeenCalledTimes(1)
  })

  it('renova autenticação estruturada expirada e não tenta recuperar uma sessão revogada', async () => {
    vi.useFakeTimers()
    mocks.refresh.mockResolvedValueOnce('new-token')
    const service = await import('../src/modules/whatsapp-web/services.js')
    service.startSessionListeners(); service.currentUser.value = { id: 'admin-fixture' }
    const failed = mocks.socket.on.mock.calls.find(([name]) => name === 'connect_error')[1]
    failed({ data: { code: 'AUTH_REQUIRED' }, message: 'Entre para acessar o painel.' })
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(mocks.socket.connect).toHaveBeenCalledTimes(1)
    mocks.socket.on.mock.calls.find(([name]) => name === 'session:revoked')[1]()
    failed({ data: { code: 'SERVICE_UNAVAILABLE' } })
    await vi.advanceTimersByTimeAsync(10000)
    expect(service.currentUser.value).toBeNull()
    expect(mocks.socket.connect).toHaveBeenCalledTimes(1)
    service.stopSessionListeners()
  })

  it('não reabre o socket se o usuário sair durante a renovação', async () => {
    let resolveRefresh
    mocks.refresh.mockReturnValueOnce(new Promise(resolve => { resolveRefresh = resolve }))
    const service = await import('../src/modules/whatsapp-web/services.js')
    service.startSessionListeners(); service.currentUser.value = { id: 'admin-fixture' }
    mocks.socket.on.mock.calls.find(([name]) => name === 'connect_error')[1]({ data: { code: 'AUTH_REQUIRED' } })
    service.stopSessionListeners()
    resolveRefresh('new-token')
    await Promise.resolve(); await Promise.resolve()
    expect(mocks.socket.connect).not.toHaveBeenCalled()
  })
})
