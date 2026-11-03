/* Aito Notification Lab: user-initiated previews, no private page/API caching. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
function localImage(id) {
  if (!/^[a-f\d-]{36}$/i.test(id || '')) return Promise.resolve('')
  return new Promise(resolve => {
    const request = indexedDB.open('aito-notification-lab', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('images')
    request.onerror = () => resolve('')
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('images', 'readwrite'), store = tx.objectStore('images'), read = store.get(id)
      let value = ''; read.onsuccess = () => { const row = read.result; if (row?.expiresAt > Date.now() && /^data:image\/(?:png|jpeg|webp);base64,/.test(row.data || '') && row.data.length <= 360000) value = row.data; store.delete(id) }
      tx.oncomplete = () => { db.close(); resolve(value) }; tx.onerror = () => { db.close(); resolve('') }
    }
  })
}
function publicImage(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 1024 ? url.href : '' } catch { return '' }
}
self.addEventListener('push', event => event.waitUntil((async () => {
  let data; try { data = event.data.json() } catch { return }
  if (data?.type !== 'aito.notification-lab' || !/^[a-f\d-]{36}$/i.test(data.id || '') || !Number.isInteger(data.count) || data.count < 1 || data.count > 10
    || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 100 || typeof data.body !== 'string' || data.body.length > 280
    || !Number.isFinite(data.createdAt) || Math.abs(Date.now() - data.createdAt) > 120000) return
  const image = await localImage(data.imageRef) || publicImage(data.imageUrl)
  for (let index = 0; index < data.count; index++) {
    await self.registration.showNotification(data.title, { body: data.body, icon: image || '/aito-logo-restored.png', ...(image ? { image } : {}),
      badge: '/comunicacao/app/icons/notify-badge.png', tag: 'aito-lab-' + data.id + '-' + index, data: { url: '/generate-notifications' } })
  }
})()))
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = self.location.origin + '/generate-notifications'
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find(client => { const target = new URL(client.url); return client.frameType !== 'nested' && target.origin === self.location.origin && ['/generate-notifications', '/gn'].includes(target.pathname) })
    if (current) { await current.navigate(url); await current.focus() } else await self.clients.openWindow(url)
  })())
})
