import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import { TEMPLATE_KEY, IMAGE_DB, MAX_IMAGE_LENGTH, emptyNotification, templateValue, readTemplates, writeTemplate, support, enableNotifications, compactImage, keepLocalImage } from '../src/services/notification-lab.js'

const IMAGE = 'data:image/webp;base64,UklGRg=='
const ID = 'c9c25ebc-2472-45a4-ac23-7cb00c7c3001'
const NOW = 1800000000000
function storage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}
function globals(values) {
  const originals = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  return () => { for (const key of Object.keys(values)) { if (originals[key]) Object.defineProperty(globalThis, key, originals[key]); else delete globalThis[key] } }
}
function fakeIDB(initial = []) {
  const records = new Map(initial), opened = [], removed = [], closed = []
  const database = { createObjectStore: name => { assert.equal(name, 'images') }, close: () => closed.push(true), transaction(name, mode) {
    assert.equal(name, 'images'); assert.equal(mode, 'readwrite')
    const tx = {}; let pending = 0, completed = false
    const done = () => { pending--; queueMicrotask(() => { if (!pending && !completed && tx.oncomplete) { completed = true; tx.oncomplete() } }) }
    const store = {
      get(key) { pending++; const request = {}; queueMicrotask(() => { request.result = records.get(key); request.onsuccess?.(); done() }); return request },
      delete(key) { removed.push(key); records.delete(key) },
      put(value, key) { records.set(key, structuredClone(value)); queueMicrotask(() => { if (!pending && !completed && tx.oncomplete) { completed = true; tx.oncomplete() } }) },
      openCursor() {
        pending++; const request = {}, entries = [...records]; let index = 0
        const next = () => queueMicrotask(() => { const entry = entries[index]; request.result = entry ? { value: entry[1], delete: () => { removed.push(entry[0]); records.delete(entry[0]) }, continue: () => { index++; next() } } : null; request.onsuccess?.(); if (!entry) done() })
        next(); return request
      },
    }
    tx.objectStore = storeName => { assert.equal(storeName, 'images'); return store }
    return tx
  } }
  const indexedDB = { open(name, version) { opened.push({ name, version }); const request = {}; queueMicrotask(() => { request.result = database; request.onsuccess?.() }); return request } }
  return { indexedDB, records, opened, removed, closed }
}
function worker({ records = [], windows = [] } = {}) {
  const handlers = new Map(), notifications = [], navigation = [], warnings = [], db = fakeIDB(records)
  let currentTime = NOW
  const context = vm.createContext({ URL, indexedDB: db.indexedDB, Date: class extends Date { static now() { return currentTime } }, console: { warn: value => warnings.push(value), error: value => warnings.push(value) }, fetch: () => { throw Error('Worker must not fetch an API or upload local images') }, caches: new Proxy({}, { get: () => { throw Error('Worker must not cache private pages or API responses') } }), self: {
    location: { origin: 'https://aitosoftwares.com' },
    addEventListener: (type, callback) => handlers.set(type, callback), skipWaiting: () => Promise.resolve(),
    registration: { showNotification: async (title, options) => notifications.push({ title, options }) },
    clients: { claim: async () => {}, matchAll: async () => windows, openWindow: async url => navigation.push(url) },
  } })
  vm.runInContext(readFileSync(new URL('../public/notification-lab-sw.js', import.meta.url), 'utf8'), context)
  async function dispatch(type, payload) {
    const waits = [], event = { waitUntil: value => waits.push(value) }
    if (type === 'push') event.data = { json: () => { if (payload instanceof Error) throw payload; return payload } }
    if (type === 'notificationclick') event.notification = { data: payload, close: () => navigation.push('closed') }
    handlers.get(type)?.(event); await Promise.all(waits)
  }
  return { handlers, notifications, navigation, warnings, db, dispatch, time: value => { currentTime = value } }
}
const payload = (patch = {}) => ({ type: 'aito.notification-lab', id: ID, title: 'Pedido confirmado', body: 'Uma notificação criada por você.', count: 3, imageRef: '', imageUrl: '', createdAt: NOW, url: '/generate-notifications', ...patch })

test('three local template slots survive reload, replacement and removal without touching administrator state', () => {
  const preserved = { aito_admin_token: 'test-admin-session', 'aito.communication.browserPush.enabled': 'true', 'aito_user': '{"name":"Test"}' }
  const local = storage(preserved)
  const templates = Array.from({ length: 3 }, (_, index) => ({ ...emptyNotification(), title: 'Template ' + (index + 1), imageData: IMAGE, count: index + 1 }))
  templates.forEach((value, index) => writeTemplate(index, value, local))
  const reloaded = storage(Object.fromEntries(local.values))
  assert.deepEqual(readTemplates(reloaded).map(value => value.title), ['Template 1', 'Template 2', 'Template 3'])
  const before = reloaded.getItem(TEMPLATE_KEY)
  for (const slot of [-1, 3, 1.5, '1']) assert.throws(() => writeTemplate(slot, templates[0], reloaded), /três espaços/)
  assert.equal(reloaded.getItem(TEMPLATE_KEY), before)
  writeTemplate(1, { ...templates[1], title: 'Substituído' }, reloaded)
  assert.deepEqual(readTemplates(reloaded).map(value => value.title), ['Template 1', 'Substituído', 'Template 3'])
  writeTemplate(0, null, reloaded)
  assert.equal(readTemplates(reloaded)[0], null)
  assert.equal(readTemplates(reloaded)[2].imageData, IMAGE)
  for (const [key, value] of Object.entries(preserved)) assert.equal(reloaded.getItem(key), value)
  assert.deepEqual([...reloaded.values.keys()].sort(), [...Object.keys(preserved), TEMPLATE_KEY].sort())
})

test('corrupt templates are isolated per slot and storage quota errors never clear unrelated browser data', () => {
  for (const text of ['bad-json', 'null', '"broken"', '{}']) assert.deepEqual(readTemplates(storage({ [TEMPLATE_KEY]: text })), [null, null, null])
  const local = storage({ [TEMPLATE_KEY]: JSON.stringify([emptyNotification(), { title: 'broken' }, emptyNotification()]), aito_admin_token: 'keep' })
  const restored = readTemplates(local); assert.ok(restored[0]); assert.equal(restored[1], null); assert.ok(restored[2])
  const original = local.getItem(TEMPLATE_KEY)
  local.setItem = () => { throw Error('Quota exceeded') }
  assert.throws(() => writeTemplate(2, emptyNotification(), local), /navegador não conseguiu salvar/)
  assert.equal(local.getItem(TEMPLATE_KEY), original); assert.equal(local.getItem('aito_admin_token'), 'keep')
})

test('template validation bounds files, text and batch options while preserving plain message lines', async () => {
  const valid = { ...emptyNotification(), imageData: IMAGE, title: '  Seu pedido  ', body: 'Linha 1\nLinha 2' }
  const normalized = templateValue(valid)
  assert.equal(normalized.title, 'Seu pedido'); assert.equal(normalized.body, 'Linha 1\nLinha 2')
  for (const patch of [{ title: '' }, { title: 'x'.repeat(101) }, { body: 'x'.repeat(281) }, { count: 11 }, { count: 0 }, { count: '3' }, { delaySeconds: 4 }, { imageData: 'data:image/svg+xml;base64,PHN2Zz4=' }, { imageData: 'data:image/webp;base64,' + 'A'.repeat(MAX_IMAGE_LENGTH) }, { imageUrl: 'http://example.com/image.png' }, { imageUrl: 'https://user:password@example.com/image.png' }]) assert.throws(() => templateValue({ ...valid, ...patch }))
  for (const file of [{ type: 'text/html', size: 12 }, { type: 'image/png', size: 5 * 1024 * 1024 + 1 }, null]) await assert.rejects(compactImage(file), /até 5 MB/)
})

test('permission is requested synchronously from the button gesture before worker registration or subscription awaits', async () => {
  const events = []; let resolvePermission
  const subscription = { endpoint: 'https://fcm.googleapis.com/test', options: {} }
  const notification = { permission: 'default', requestPermission: () => { events.push('permission'); return new Promise(resolve => { resolvePermission = resolve }) } }
  const registration = { active: {}, pushManager: { getSubscription: async () => null, subscribe: async options => { events.push('subscribe'); assert.equal(options.userVisibleOnly, true); return subscription } } }
  const restore = globals({ Notification: notification, window: { isSecureContext: true, Notification: notification, PushManager: {}, matchMedia: () => ({ matches: true }) }, navigator: { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, serviceWorker: { register: async (url, options) => { events.push('register'); assert.equal(url, '/notification-lab-sw.js'); assert.equal(options.scope, '/generate-notifications'); assert.equal(options.updateViaCache, 'none'); return registration } } } })
  try {
    const enabling = enableNotifications(Buffer.alloc(65, 2).toString('base64url'))
    assert.deepEqual(events, ['permission'])
    resolvePermission('granted')
    assert.equal(await enabling, subscription)
    assert.deepEqual(events, ['permission', 'register', 'subscribe'])
  } finally { restore() }
})

test('ordinary iOS tabs and blocked permissions do not register workers or prompt unexpectedly', async () => {
  for (const scenario of [{ ios: true, installed: false, permission: 'default', error: /Tela de Início/ }, { ios: false, installed: false, permission: 'denied', error: /bloqueadas/ }]) {
    const notification = { permission: scenario.permission, requestPermission: () => { throw Error('Unexpected permission prompt') } }
    const restore = globals({ Notification: notification, window: { isSecureContext: true, Notification: notification, PushManager: {}, matchMedia: () => ({ matches: scenario.installed }) }, navigator: { userAgent: scenario.ios ? 'iPhone' : 'Chrome', platform: scenario.ios ? 'iPhone' : 'Win32', maxTouchPoints: scenario.ios ? 5 : 0, serviceWorker: { register: () => { throw Error('Unexpected worker registration') } } } })
    try { assert.equal(support().installRequired, scenario.ios); await assert.rejects(enableNotifications('unused'), scenario.error) } finally { restore() }
  }
})

test('a changed VAPID identity replaces the existing device subscription', async () => {
  const events = [], next = { endpoint: 'https://fcm.googleapis.com/new-test' }
  const old = { options: { applicationServerKey: Uint8Array.from(Buffer.alloc(65, 1)).buffer }, unsubscribe: async () => { events.push('unsubscribe') } }
  const notification = { permission: 'granted' }
  const registration = { active: {}, pushManager: { getSubscription: async () => old, subscribe: async options => { events.push('subscribe'); assert.deepEqual([...options.applicationServerKey], [...Buffer.alloc(65, 2)]); return next } } }
  const restore = globals({ Notification: notification, window: { isSecureContext: true, Notification: notification, PushManager: {}, matchMedia: () => ({ matches: false }) }, navigator: { userAgent: 'Chrome', platform: 'Win32', maxTouchPoints: 0, serviceWorker: { register: async () => registration } } })
  try { assert.equal(await enableNotifications(Buffer.alloc(65, 2).toString('base64url')), next); assert.deepEqual(events, ['unsubscribe', 'subscribe']) } finally { restore() }
})

test('uploaded image data is kept only in local IndexedDB under a temporary opaque reference', async () => {
  const old = randomUUID(), future = randomUUID(), now = Date.now()
  const db = fakeIDB([[old, { data: IMAGE, expiresAt: now - 1 }], [future, { data: IMAGE, expiresAt: now + 500000 }]])
  const restore = globals({ indexedDB: db.indexedDB, crypto: { randomUUID: () => ID }, fetch: () => { throw Error('Image upload to server is forbidden') } })
  try {
    const reference = await keepLocalImage(IMAGE)
    assert.equal(reference, ID); assert.equal(reference.includes('data:'), false)
    assert.equal(db.records.has(old), false); assert.equal(db.records.has(future), true)
    assert.equal(db.records.get(ID).data, IMAGE); assert.ok(db.records.get(ID).expiresAt > now)
    assert.ok(db.records.get(ID).expiresAt <= Date.now() + 600000)
    assert.deepEqual(db.opened, [{ name: IMAGE_DB, version: 1 }]); assert.equal(db.closed.length, 1)
  } finally { restore() }
})

test('the worker displays every fresh batch item with a unique tag and refuses stale, malformed or excessive batches', async () => {
  const instance = worker()
  await instance.dispatch('push', payload({ count: 10 }))
  assert.equal(instance.notifications.length, 10)
  assert.equal(new Set(instance.notifications.map(item => item.options.tag)).size, 10)
  assert.ok(instance.notifications.every(item => item.title === 'Pedido confirmado' && item.options.data.url === '/generate-notifications'))
  for (const invalid of [new Error('Malformed JSON'), payload({ type: 'other' }), payload({ id: 'wrong' }), payload({ count: 11 }), payload({ count: 0 }), payload({ count: '3' }), payload({ createdAt: NOW - 120001 }), payload({ createdAt: NOW + 120001 }), payload({ title: 'x'.repeat(101) }), payload({ body: 'x'.repeat(281) })]) await instance.dispatch('push', invalid)
  assert.equal(instance.notifications.length, 10)
  assert.equal(instance.warnings.length, 0)
})

test('the worker consumes only fresh local image references and never uploads or caches them', async () => {
  const fresh = worker({ records: [[ID, { data: IMAGE, expiresAt: NOW + 60000 }]] })
  await fresh.dispatch('push', payload({ imageRef: ID, count: 2 }))
  assert.equal(fresh.notifications[0].options.image, IMAGE); assert.equal(fresh.notifications[1].options.icon, IMAGE)
  assert.equal(fresh.db.records.has(ID), false); assert.deepEqual(fresh.db.removed, [ID]); assert.equal(fresh.db.closed.length, 1)
  assert.equal(fresh.handlers.has('fetch'), false)
  for (const row of [{ data: IMAGE, expiresAt: NOW - 1 }, { data: 'data:image/svg+xml,<svg/>', expiresAt: NOW + 1000 }, { data: 'data:image/webp;base64,' + 'A'.repeat(MAX_IMAGE_LENGTH), expiresAt: NOW + 1000 }]) {
    const invalid = worker({ records: [[ID, row]] })
    await invalid.dispatch('push', payload({ imageRef: ID, imageUrl: 'https://example.com/fallback.png', count: 1 }))
    assert.equal(invalid.notifications[0].options.image, 'https://example.com/fallback.png'); assert.equal(invalid.db.records.has(ID), false)
  }
  const hostile = worker(); await hostile.dispatch('push', payload({ imageUrl: 'javascript:alert(1)', count: 1 }))
  assert.equal(hostile.notifications[0].options.image, undefined)
  assert.equal(hostile.notifications[0].options.icon, '/aito-logo-restored.png')
})

test('notification clicks ignore external payload URLs and focus only a same-origin lab window', async () => {
  const visited = [], instance = worker({ windows: [{ url: 'https://evil.invalid/gn', navigate: () => { throw Error('Must not navigate a foreign window') } }, { url: 'https://aitosoftwares.com/gn', navigate: async url => visited.push(url), focus: async () => visited.push('focus') }] })
  await instance.dispatch('notificationclick', { url: 'https://evil.invalid/phishing' })
  assert.deepEqual(instance.navigation, ['closed']); assert.deepEqual(visited, ['https://aitosoftwares.com/generate-notifications', 'focus'])
  const empty = worker(); await empty.dispatch('notificationclick', { url: 'javascript:alert(1)' })
  assert.deepEqual(empty.navigation, ['closed', 'https://aitosoftwares.com/generate-notifications'])
})
