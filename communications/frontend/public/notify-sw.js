/* Push only: no API, page or private-media caching. */
function state(enabled) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('notify-admin-alerts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('settings')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('settings', enabled === undefined ? 'readonly' : 'readwrite')
      const store = tx.objectStore('settings')
      const result = enabled === undefined ? store.get('enabled') : store.put(enabled === true, 'enabled')
      let value
      result.onsuccess = () => { value = result.result }
      tx.oncomplete = () => { db.close(); resolve(enabled === undefined ? value === true : enabled) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  })
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('message', event => {
  if (event.data?.type === 'ADMIN_ALERTS') event.waitUntil(state(event.data.enabled).then(() => event.ports[0]?.postMessage({ saved: true })))
})
self.addEventListener('push', event => event.waitUntil((async () => {
  if (!await state()) return
  let data
  try { data = event.data.json() } catch { return }
  if (!/^[a-f\d]{24}$/i.test(String(data?.id || '')) || !/^\[(?:Cloud|Wpp)\] /.test(data.title || '')) return
  if (Date.now() - new Date(data.createdAt).getTime() > 5 * 60 * 1000) return
  const name = String(data.displayTitle || data.title).replace(/^\[(?:Cloud|Wpp)\] /, '').replace(/^[🟢🔵]\s*/u, '').replace(/\s*[🟢🔵]$/u, '')
  const title = (data.title.startsWith('[Cloud] ') ? '🔵 ' : '🟢 ') + name
  await self.registration.showNotification(String(title).slice(0, 100), {
    body: String(data.body || '').slice(0, 220), tag: 'message-' + data.id,
    icon: '/comunicacao/app/icons/aito-v2-192.png', badge: '/comunicacao/app/icons/notify-badge.png',
    data: { url: safeTarget(data.url), channel: data.channel, chatId: data.chatId }, renotify: false
  })
})()))

function safeTarget(value) {
  const fallback = '/admin/comunicacao/app-mobile'
  try {
    const url = new URL(String(value || '/'), self.location.origin)
    const base = ['/admin/comunicacao', '/comunicacao/app'].find(prefix => url.pathname.startsWith(prefix + '/')) || ''
    const pathname = url.pathname.slice(base.length)
    return url.origin === self.location.origin && ['/whatsapp-web', '/whatsapp-cloud', '/app-mobile', '/app-mobile/web', '/app-mobile/cloud', '/app'].includes(pathname)
      ? '/admin/comunicacao' + pathname + url.search : fallback
  } catch { return fallback }
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    if (!await state()) return
    const url = new URL(safeTarget(event.notification.data?.url), self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const candidates = windows.filter(item => new URL(item.url).origin === self.location.origin && ['/admin/', '/comunicacao/app/'].some(prefix => new URL(item.url).pathname.startsWith(prefix)))
    // Prefer the outer app, never navigate an embedded iframe into another host layout.
    const client = candidates.find(item => item.frameType === 'top-level' && new URL(item.url).pathname.startsWith('/admin/'))
      || candidates.find(item => item.frameType !== 'nested' && new URL(item.url).pathname.startsWith('/admin/'))
      || candidates.find(item => item.frameType !== 'nested')
    if (client) { await client.navigate(url); await client.focus() }
    else await self.clients.openWindow(url)
  })())
})
