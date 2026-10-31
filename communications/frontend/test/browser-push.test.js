import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('../src/services/http.js', () => ({ http, unwrap: value => value.data }))
const play = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../src/services/sounds.js', () => ({ playAppSound: play }))

function storage() {
  const items = new Map()
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key), key: index => [...items.keys()][index], get length() { return items.size } }
}
function environment({ ios = false, standalone = false, permission = 'default' } = {}) {
  const events = []
  const subscription = { endpoint: 'https://fcm.googleapis.com/test-only', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/test-only', keys: { auth: 'test' } }), unsubscribe: vi.fn(async () => { events.push('unsubscribe') }) }
  let existing = null
  const registration = {
    active: { scriptURL: 'https://aito.communication.test/comunicacao/app/notify-sw.js', postMessage: (value, ports) => { events.push(value.enabled ? 'enable-worker' : 'disable-worker'); ports[0].postMessage({ saved: true }); ports[0].close() } },
    pushManager: { getSubscription: vi.fn(async () => existing), subscribe: vi.fn(async () => { events.push('subscribe'); existing = subscription; return subscription }) },
    getNotifications: async () => [],
  }
  const navigator = { userAgent: ios ? 'iPhone' : 'Desktop', platform: ios ? 'iPhone' : 'Win32', maxTouchPoints: ios ? 5 : 0,
    serviceWorker: { register: vi.fn(async () => registration), ready: Promise.resolve(registration), getRegistration: vi.fn(async () => registration) } }
  const notification = { permission, requestPermission: vi.fn(async () => { events.push('permission'); notification.permission = 'granted'; return 'granted' }) }
  vi.stubGlobal('localStorage', storage())
  vi.stubGlobal('navigator', navigator)
  vi.stubGlobal('window', { isSecureContext: true, Notification: notification, PushManager: {}, matchMedia: () => ({ matches: standalone }) })
  vi.stubGlobal('Notification', notification)
  http.get.mockImplementation(async () => { events.push('config'); return { data: { enabled: true, publicKey: Buffer.alloc(65, 1).toString('base64url') } } })
  http.post.mockResolvedValue({ data: { subscribed: true } }); http.delete.mockResolvedValue({})
  return { navigator, notification, registration, subscription, events }
}
beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })
afterEach(() => vi.unstubAllGlobals())

describe('browser push activation and administrator scope', () => {
  it('explains Home Screen installation on iPhone and never asks permission in an ordinary tab', async () => {
    const env = environment({ ios: true })
    const push = await import('../src/services/browser-push.js')
    expect(push.browserPushSupport().installRequired).toBe(true)
    await expect(push.enableBrowserPush({ askPermission: true })).rejects.toThrow('Tela de Início')
    expect(env.notification.requestPermission).not.toHaveBeenCalled()
  })
  it('asks on the user gesture before network work, subscribes and binds through the HttpOnly cookie route', async () => {
    const env = environment({ ios: true, standalone: true })
    const push = await import('../src/services/browser-push.js')
    await push.startAdminPush()
    await expect(push.enableBrowserPush({ askPermission: true })).resolves.toBe(true)
    expect(env.events.slice(0, 2)).toEqual(['permission', 'config'])
    expect(env.events.indexOf('enable-worker')).toBeLessThan(env.events.indexOf('subscribe'))
    expect(env.registration.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) })
    expect(http.post).toHaveBeenCalledWith('/auth/browser-push/subscription', { subscription: env.subscription.toJSON() })
    expect(localStorage.getItem('aito.communication.browserPush.enabled')).toBe('true')
  })
  it('does not prompt automatically and reports denied permissions without registering a worker', async () => {
    const env = environment({ permission: 'denied' })
    const push = await import('../src/services/browser-push.js')
    await push.startAdminPush()
    await expect(push.enableBrowserPush({ askPermission: true })).rejects.toThrow('bloqueadas')
    expect(env.notification.requestPermission).not.toHaveBeenCalled()
    expect(http.get).not.toHaveBeenCalled()
    expect(env.navigator.serviceWorker.register).not.toHaveBeenCalled()
  })
  it('revokes locally even when API deletion fails, keeping the opt-in for the next admin login', async () => {
    const env = environment({ permission: 'granted' })
    const push = await import('../src/services/browser-push.js')
    await push.startAdminPush(); await push.enableBrowserPush()
    http.delete.mockRejectedValueOnce(new Error('offline'))
    await push.disableBrowserPush()
    expect(env.subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(env.events).toContain('disable-worker')
    expect(localStorage.getItem('aito.communication.browserPush.enabled')).toBe('true')
    await push.disableBrowserPush({ forget: true })
    expect(localStorage.getItem('aito.communication.browserPush.enabled')).toBeNull()
  })
  it('cancels an activation racing with a logout or navigation to a public page', async () => {
    const env = environment({ permission: 'granted' })
    const push = await import('../src/services/browser-push.js')
    await push.startAdminPush()
    let release
    http.get.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const activation = push.enableBrowserPush()
    await push.disableBrowserPush()
    release({ data: { enabled: true, publicKey: Buffer.alloc(65).toString('base64url') } })
    expect(await activation).toBe(false)
    expect(env.registration.pushManager.subscribe).not.toHaveBeenCalled()
  })
  it('closes visible previews on public pages even if the push subscription already expired', async () => {
    const env = environment({ permission: 'granted' })
    const close = vi.fn()
    env.registration.getNotifications = async () => [{ close }]
    const push = await import('../src/services/browser-push.js')
    await push.disableBrowserPush()
    expect(close).toHaveBeenCalledOnce()
    expect(http.delete).not.toHaveBeenCalled()
  })
  it('coalesces simultaneous restore/button activation requests', async () => {
    const env = environment({ permission: 'granted' })
    const push = await import('../src/services/browser-push.js')
    await push.startAdminPush()
    await Promise.all([push.enableBrowserPush(), push.enableBrowserPush()])
    expect(env.registration.pushManager.subscribe).toHaveBeenCalledOnce()
    expect(http.post).toHaveBeenCalledOnce()
  })
})

describe('global channel audio', () => {
  it('plays supplied Cloud/Web sounds once, on any admin page, and stops on public/user pages', async () => {
    environment()
    window.matchMedia = () => ({ matches: false })
    const alerts = await import('../src/services/admin-message-alerts.js')
    const cloud = { id: 'cloud-id', kind: 'whatsapp_cloud_message_received', createdAt: new Date().toISOString() }
    expect(await alerts.playAdminMessageAlert(cloud)).toBe(false)
    alerts.setAdminMessageAlertsActive(true)
    expect(await alerts.playAdminMessageAlert(cloud)).toBe(true)
    expect(await alerts.playAdminMessageAlert(cloud)).toBe(false)
    expect(await alerts.playAdminMessageAlert({ ...cloud, id: 'web-id', kind: 'whatsapp_web_message_received' })).toBe(true)
    expect(play.mock.calls.map(args => args[0])).toEqual(['whatsapp_cloud', 'whatsapp_web'])
    alerts.setAdminMessageAlertsActive(false)
    expect(await alerts.playAdminMessageAlert({ ...cloud, id: 'logout-id' })).toBe(false)
  })
  it('avoids a second playback in another tab and skips old events or mobile desktop sounds', async () => {
    environment()
    window.matchMedia = () => ({ matches: false })
    const alerts = await import('../src/services/admin-message-alerts.js')
    alerts.setAdminMessageAlertsActive(true)
    const cloud = { id: 'another-tab', kind: 'whatsapp_cloud_message_received', createdAt: new Date().toISOString() }
    localStorage.setItem('aito.communication.messageSound.another-tab', String(Date.now()))
    expect(await alerts.playAdminMessageAlert(cloud)).toBe(false)
    expect(await alerts.playAdminMessageAlert({ ...cloud, id: 'old', createdAt: new Date(Date.now() - 61000).toISOString() })).toBe(false)
    window.matchMedia = query => ({ matches: query === '(pointer: coarse)' })
    expect(await alerts.playAdminMessageAlert({ ...cloud, id: 'mobile' })).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })
})

function workerFixture() {
  const handlers = {}; const shown = []; const navigated = []; let enabled = false
  const context = {
    URL, Date, console,
    indexedDB: { open() {
      const request = {}
      queueMicrotask(() => {
        request.result = { close() {}, transaction() {
          const tx = { objectStore: () => ({ get() { const result = {}; queueMicrotask(() => { result.result = enabled; result.onsuccess(); tx.oncomplete() }); return result },
            put(value) { enabled = value; const result = {}; queueMicrotask(() => { result.onsuccess(); tx.oncomplete() }); return result } }) }
          return tx
        } }
        request.onsuccess()
      })
      return request
    } },
    self: { location: { origin: 'https://aito.communication.test' }, addEventListener: (name, callback) => { handlers[name] = callback },
      registration: { showNotification: async (title, options) => shown.push({ title, ...options }) },
      clients: { matchAll: async () => [{ url: 'https://aito.communication.test/comunicacao/app/app-mobile', navigate: async url => navigated.push(url), focus: async () => {} }] } },
  }
  vm.runInNewContext(readFileSync(new URL('../public/notify-sw.js', import.meta.url), 'utf8'), context)
  async function trigger(name, event) { let task; handlers[name]({ ...event, waitUntil: value => { task = value } }); await task }
  return { trigger, shown, navigated }
}
describe('background service worker', () => {
  it.each(['[Wpp] Maria', 'Maria 🟢', '🟢 Maria'])('normalizes old and new titles with one leading emoji: %s', async title => {
    const worker = workerFixture()
    await worker.trigger('message', { data: { type: 'ADMIN_ALERTS', enabled: true }, ports: [] })
    await worker.trigger('push', { data: { json: () => ({ id: '507f1f77bcf86cd799439012', title: '[Wpp] Maria', displayTitle: title, body: 'Oi', createdAt: new Date().toISOString() }) } })
    expect(worker.shown[0].title).toBe('🟢 Maria')
  })
  it('shows only fresh previews for an enabled admin and navigates only within the admin channels', async () => {
    const worker = workerFixture()
    const data = { id: '507f1f77bcf86cd799439012', title: '[Cloud] Jorge', body: 'beleza!', createdAt: new Date().toISOString(), url: 'https://evil.test/' }
    await worker.trigger('push', { data: { json: () => data } })
    expect(worker.shown).toHaveLength(0)
    await worker.trigger('message', { data: { type: 'ADMIN_ALERTS', enabled: true }, ports: [{ postMessage() {} }] })
    await worker.trigger('push', { data: { json: () => data } })
    expect(worker.shown[0]).toMatchObject({ title: '🔵 Jorge', body: 'beleza!', tag: 'message-' + data.id, data: { url: '/comunicacao/app/app-mobile' } })
    await worker.trigger('notificationclick', { notification: { close() {}, data: { url: '/whatsapp-web?chatId=507f1f77bcf86cd799439013' } } })
    expect(worker.navigated).toEqual(['https://aito.communication.test/comunicacao/app/whatsapp-web?chatId=507f1f77bcf86cd799439013'])
    await worker.trigger('push', { data: { json: () => ({ ...data, createdAt: new Date(Date.now() - 310000).toISOString() }) } })
    expect(worker.shown).toHaveLength(1)
    await worker.trigger('message', { data: { type: 'ADMIN_ALERTS', enabled: false }, ports: [] })
    await worker.trigger('push', { data: { json: () => data } })
    expect(worker.shown).toHaveLength(1)
  })
})
