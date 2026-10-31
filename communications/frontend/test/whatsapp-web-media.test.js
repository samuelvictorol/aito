import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { protectedMediaPath } from '../src/modules/whatsapp-web/media-url.js'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../src/modules/whatsapp-web/services.js', () => ({
  API_PREFIX: '/api/whatsapp-web',
  api: { get: mocks.get },
}))
import { clearAuthenticatedMedia, vAuthHref, vAuthSrc } from '../src/modules/whatsapp-web/authenticated-media.js'

function element() {
  const attributes = new Map()
  return {
    attributes,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
    dispatchEvent: vi.fn(),
  }
}

describe('mídias privadas do WhatsApp Web', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://aito.communication.example' } })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:protected-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    mocks.get.mockReset().mockResolvedValue({ data: new Blob(['imagem']) })
  })
  afterEach(() => { clearAuthenticatedMedia(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('autentica somente mídia privada do mesmo serviço, preservando catálogo público e Cloud separados', () => {
    const base = '/api/whatsapp-web'
    const origin = 'https://aito.communication.example'
    expect(protectedMediaPath('/api/whatsapp-web/assets/asset-1/content', base, origin)).toBe('/assets/asset-1/content')
    expect(protectedMediaPath(`${origin}/api/whatsapp-web/media/message-1`, base, origin)).toBe('/media/message-1')
    expect(protectedMediaPath('https://outside.example/api/whatsapp-web/media/message-1', base, origin)).toBeNull()
    expect(protectedMediaPath('/api/whatsapp-web/public/catalog/example/media/asset-1', base, origin)).toBeNull()
    expect(protectedMediaPath('/api/whatsapp-cloud/media/message-1', base, origin)).toBeNull()
    expect(protectedMediaPath('/api/whatsapp-web/settings', base, origin)).toBeNull()
  })

  it('usa a origem da API configurada sem encaminhar autenticação para outra origem', () => {
    const api = 'https://private-api.example/api/whatsapp-web'
    expect(protectedMediaPath('https://private-api.example/api/whatsapp-web/media/1', api, 'https://aito.communication.example')).toBe('/media/1')
    expect(protectedMediaPath('https://aito.communication.example/api/whatsapp-web/media/1', api, 'https://aito.communication.example')).toBeNull()
  })

  it('carrega imagens e downloads autenticados como Blob, compartilha a leitura e revoga a URL ao sair', async () => {
    const image = element()
    const link = element()
    const binding = { value: '/api/whatsapp-web/assets/image-1/content' }
    vAuthSrc.mounted(image, binding)
    vAuthHref.mounted(link, binding)
    await vi.waitFor(() => expect(image.attributes.get('src')).toBe('blob:protected-test'))
    expect(link.attributes.get('href')).toBe('blob:protected-test')
    expect(mocks.get).toHaveBeenCalledOnce()
    expect(mocks.get).toHaveBeenCalledWith('/assets/image-1/content', expect.objectContaining({ responseType: 'blob', signal: expect.any(AbortSignal) }))
    vAuthSrc.unmounted(image)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vAuthHref.unmounted(link)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:protected-test')
  })

  it('mantém arquivos públicos e imagens externas sem requisição autenticada', () => {
    const image = element()
    vAuthSrc.mounted(image, { value: 'https://cdn.example/image.png' })
    expect(image.attributes.get('src')).toBe('https://cdn.example/image.png')
    expect(mocks.get).not.toHaveBeenCalled()
    vAuthSrc.unmounted(image)
  })
})
