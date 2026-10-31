import { readFileSync } from 'node:fs'
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { connectionStatus } from '../src/modules/whatsapp-web/connection-status.js'
import { connectionMemoryState } from '../src/modules/whatsapp-web/connection-resources.js'

const now = Date.parse('2026-10-24T12:00:00Z')
const savedStorage = { checked: true, diskMounted: true, profilePresent: true, writable: true, storageId: 'test-storage-not-for-display' }

describe('apresentação da conexão do WhatsApp Web', () => {
  it('distingue pareamento concluído de conexão pronta e esconde QR anterior durante a finalização', () => {
    const view = connectionStatus({ state: 'AUTHENTICATED', authenticated: true, ready: false, initializing: true, browserPresent: true, qr: 'old-qr' }, now)
    expect(view.connected).toBe(false)
    expect(view.label).toBe('Finalizando conexão')
    expect(view.message).toBe('Pareamento concluído. Aguarde a conexão ficar pronta.')
    expect(view.showQr).toBe(false)
    expect(view.showStart).toBe(false)
    expect(view.actionsBlocked).toBe(true)
  })

  it('mostra retomada da sessão salva sem pedir outro pareamento durante o reinício', () => {
    for (const state of ['STARTING', 'RECONNECTING']) {
      const view = connectionStatus({ state, ready: false, initializing: true, sessionStorage: savedStorage }, now)
      expect(view.label).toBe('Retomando sessão salva')
      expect(view.message).toContain('Aguarde a retomada')
      expect(view.showStart).toBe(false)
      expect(view.showQr).toBe(false)
      expect(view.actionsBlocked).toBe(true)
      expect(JSON.stringify(view)).not.toContain(savedStorage.storageId)
    }
  })

  it('só apresenta conectado após ready verdadeiro, inclusive quando o estado textual chega antes', () => {
    expect(connectionStatus({ state: 'READY', ready: false }, now)).toMatchObject({ connected: false, label: 'Finalizando conexão', actionsBlocked: true })
    expect(connectionStatus({ state: 'CONNECTED', ready: false }, now).connected).toBe(false)
    expect(connectionStatus({ state: 'READY', ready: true }, now)).toMatchObject({ connected: true, label: 'Conectado', badge: 'Recebendo agora', showStart: false })
  })

  it('bloqueia ações durante fechamento mesmo se o status anterior ainda contiver ready e QR', () => {
    const view = connectionStatus({ state: 'QR_REQUIRED', ready: true, qr: 'stale', browserClosing: true }, now)
    expect(view).toMatchObject({ connected: false, label: 'Encerrando conexão', showStart: false, showQr: false, actionsBlocked: true })
  })

  it('permite novo pareamento após desvinculação real e mantém leitura do QR como etapa distinta', () => {
    expect(connectionStatus({ state: 'AUTH_REQUIRED', ready: false, initializing: true, sessionStorage: savedStorage }, now)).toMatchObject({ label: 'Novo pareamento necessário', connected: false, showStart: true, actionsBlocked: false })
    expect(connectionStatus({ state: 'QR_REQUIRED', ready: false, qr: 'current-qr', initializing: true }, now)).toMatchObject({ label: 'Leia o QR Code', showQr: true, showStart: false, connected: false })
  })

  it('libera recuperação manual após erro ou prazo vencido, sem oferecer Iniciar sessão sobre navegador existente', () => {
    expect(connectionStatus({ state: 'ERROR', ready: false, initializing: true, browserPresent: true, lastError: 'Falha de teste', sessionStorage: savedStorage }, now)).toMatchObject({ label: 'Falha na conexão', actionsBlocked: false, showStart: false })
    const authenticated = { state: 'AUTHENTICATED', ready: false, authenticated: true, initializing: true, browserPresent: true, readyDeadlineAt: '2026-10-24T12:00:10Z' }
    expect(connectionStatus(authenticated, now).actionsBlocked).toBe(true)
    expect(connectionStatus(authenticated, now + 11000)).toMatchObject({ timedOut: true, booting: false, actionsBlocked: false, showStart: false, label: 'A conexão está demorando' })
  })

  it('libera recuperação do carregamento inicial travado antes do pareamento', () => {
    const loading = { state: 'STARTING', ready: false, authenticated: false, initializing: true, browserPresent: true, initializationDeadlineAt: '2026-10-24T11:59:59Z' }
    expect(connectionStatus(loading, now)).toMatchObject({ timedOut: true, actionsBlocked: false, showStart: false, connected: false, showQr: false, badge: 'Reconexão disponível' })
  })

  it('mantém proteção de memória e só confirma disco quando a montagem foi verificada', () => {
    expect(connectionStatus({ state: 'RESOURCE_LIMIT', resources: { canStart: false, paused: true } }, now)).toMatchObject({ actionsBlocked: true, diskVerified: false })
    expect(connectionStatus({ state: 'RESOURCE_LIMIT', resources: { canStart: true, paused: true } }, now)).toMatchObject({ label: 'Memória disponível para reconectar', actionsBlocked: false })
    expect(connectionStatus({ sessionStorage: savedStorage }, now).diskVerified).toBe(true)
    expect(connectionStatus({ sessionStorage: { ...savedStorage, diskMounted: false } }, now).diskVerified).toBe(false)
  })
})

const source = readFileSync(new URL('../src/modules/whatsapp-web/pages/HomePage.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
const create = new Function('inPrototype', 'computed', 'ref', 'watch', 'onMounted', 'onBeforeUnmount', 'QRCode', 'api', 'messageOf', 'socket', 'connectionMemoryState', 'connectionStatus', 'confirm', 'setTimeout', 'setInterval', 'clearInterval', `${script}\nreturn { invoke, regenerate, onStatus, onQr, qrImage, connection, loading }`)

function controller(prototype = false) {
  const watchers = [], confirm = vi.fn(() => true), QRCode = { toDataURL: vi.fn() }
  const api = {
    post: vi.fn(async () => ({ data: {} })),
    get: vi.fn(async endpoint => ({ data: endpoint === '/dashboard' ? { whatsapp: { state: 'DISCONNECTED', ready: false } } : endpoint === '/settings' ? { runtime: {} } : { ready: true } })),
  }
  const page = create(() => prototype, computed, ref, (_source, callback) => watchers.push(callback), () => {}, () => {}, QRCode, api, error => error.message, {}, connectionMemoryState, connectionStatus, confirm, () => {}, () => {}, () => {})
  return { ...page, api, confirm, QRCode, watchers }
}

describe('ações da tela de conexão', () => {
  it('bloqueia conexão e regeneração no protótipo antes de confirmar ou acionar a sessão', async () => {
    const page = controller(true)
    page.onStatus({ state: 'DISCONNECTED', ready: false })
    await page.invoke('connect', '/whatsapp/connect')
    await page.regenerate()
    expect(page.confirm).not.toHaveBeenCalled()
    expect(page.api.post).not.toHaveBeenCalled()
  })
  it('ignora chamadas duplicadas e ações durante bootstrap ou fechamento', async () => {
    const page = controller()
    page.onStatus({ state: 'AUTHENTICATED', ready: false, authenticated: true })
    await page.invoke('connect', '/whatsapp/connect')
    expect(page.api.post).not.toHaveBeenCalled()
    page.onStatus({ state: 'ERROR', ready: false, browserClosing: true })
    await page.regenerate()
    expect(page.confirm).not.toHaveBeenCalled()
    page.onStatus({ state: 'ERROR', ready: false })
    let finish
    page.api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = page.invoke('recover', '/whatsapp/recover')
    await page.invoke('recover', '/whatsapp/recover')
    expect(page.api.post).toHaveBeenCalledTimes(1)
    finish({ data: {} })
    await pending
  })

  it('exige confirmação explícita da desvinculação para Novo QR e informa a alternativa preservada', async () => {
    const page = controller()
    page.onStatus({ state: 'ERROR', ready: false })
    page.confirm.mockReturnValueOnce(false)
    await page.regenerate()
    expect(page.api.post).not.toHaveBeenCalled()
    expect(page.confirm.mock.calls[0][0]).toContain('desvincula o aparelho atual')
    expect(page.confirm.mock.calls[0][0]).toContain('Tentar reconectar')
    await page.regenerate()
    expect(page.api.post).toHaveBeenCalledWith('/whatsapp/regenerate', undefined)
  })

  it('não restaura uma imagem de QR gerada com atraso depois que o aparelho já pareou', async () => {
    const page = controller()
    let finish
    page.QRCode.toDataURL.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    page.onQr({ qr: 'old-qr' })
    const generation = page.watchers[0]('old-qr')
    page.onStatus({ state: 'AUTHENTICATED', authenticated: true, ready: false, qr: null })
    await page.watchers[0](null)
    finish('data:image/png;base64,old')
    await generation
    expect(page.qrImage.value).toBe('')
    expect(page.connection.value.showQr).toBe(false)
  })
})
