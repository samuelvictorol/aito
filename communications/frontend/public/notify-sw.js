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
  const url = new URL(String(value || '/'), self.location.origin)
  const base = '/comunicacao/app'
  const pathname = url.pathname.startsWith(base + '/') ? url.pathname.slice(base.length) : url.pathname
  return url.origin === self.location.origin && ['/whatsapp-web', '/whatsapp-cloud', '/app-mobile', '/app-mobile/web', '/app-mobile/cloud', '/app'].includes(pathname)
    ? base + pathname + url.search : base + '/app-mobile'
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    if (!await state()) return
    const url = new URL(safeTarget(event.notification.data?.url), self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = windows.find(item => new URL(item.url).origin === self.location.origin && new URL(item.url).pathname.startsWith('/comunicacao/app/'))
    if (client) { await client.navigate(url); await client.focus() }
    else await self.clients.openWindow(url)
  })())
})
