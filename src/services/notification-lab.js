export const TEMPLATE_KEY = 'aito.notificationLab.templates.v1'
export const IMAGE_DB = 'aito-notification-lab'
export const LAB_PATH = '/generate-notifications'
export const MAX_IMAGE_LENGTH = 360000
export const emptyNotification = () => ({ title: 'Seu pedido foi confirmado ✨', body: 'Tudo certo por aqui! Esta é uma notificação de teste criada por você.', count: 1, delaySeconds: 5, imageData: '', imageUrl: '' })
export function imageUrl(value) {
  if (!value) return ''
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 1024 || url.port && url.port !== '443' || !url.hostname.includes('.')
    || /^(?:localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.includes(':')) throw Error('Use um link HTTPS público de imagem, sem usuário ou senha.')
  return url.href
}
export function templateValue(value) {
  if (!value || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100 || typeof value.body !== 'string' || value.body.length > 280
    || !Number.isInteger(value.count) || value.count < 1 || value.count > 10 || ![3, 5, 7].includes(value.delaySeconds)) throw Error('Revise o título, a mensagem e as opções do teste.')
  const imageData = value.imageData || ''
  if (typeof imageData !== 'string' || imageData && (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData) || imageData.length > MAX_IMAGE_LENGTH)) throw Error('Selecione uma imagem menor.')
  return { title: value.title.trim(), body: value.body.trim(), count: value.count, delaySeconds: value.delaySeconds, imageData, imageUrl: imageUrl(value.imageUrl || '') }
}
export function readTemplates(storage) {
  try { storage ||= globalThis.localStorage; const values = JSON.parse(storage.getItem(TEMPLATE_KEY) || '[]'); return Array.from({ length: 3 }, (_, index) => { try { return values[index] ? templateValue(values[index]) : null } catch { return null } }) }
  catch { return [null, null, null] }
}
export function writeTemplate(slot, value, storage) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw Error('Escolha um dos três espaços de templates.')
  const items = readTemplates(storage); items[slot] = value ? templateValue(value) : null
  try { storage ||= globalThis.localStorage; storage.setItem(TEMPLATE_KEY, JSON.stringify(items)) } catch { throw Error('O navegador não conseguiu salvar. Libere espaço ou tente uma imagem menor.') }
  return items
}
export function support() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  return { ios, installed, installRequired: ios && !installed, available: window.isSecureContext && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window }
}
const keyBytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), letter => letter.charCodeAt(0))
async function activeWorker(registration) {
  if (registration.active) return registration
  const worker = registration.installing || registration.waiting
  if (!worker) throw Error('Não foi possível preparar as notificações. Atualize a página.')
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('A preparação demorou. Atualize a página e tente novamente.')), 15000)
    const changed = () => { if (worker.state === 'activated') { clearTimeout(timer); resolve() } else if (worker.state === 'redundant') { clearTimeout(timer); reject(Error('Atualize a página para preparar as notificações.')) } }
    worker.addEventListener('statechange', changed); changed()
  })
  return registration
}
export async function enableNotifications(publicKey) {
  const state = support()
  if (state.installRequired) throw Error('No iPhone, adicione esta página à Tela de Início e abra pelo novo ícone antes de ativar.')
  if (!state.available) throw Error('Este navegador não oferece notificações push. Você ainda pode editar e salvar os templates.')
  // Must happen directly on the click, before any network or worker awaits.
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') throw Error('As notificações estão bloqueadas. Libere a permissão nos ajustes do navegador ou do app.')
  const registration = await activeWorker(await navigator.serviceWorker.register('/notification-lab-sw.js', { scope: LAB_PATH, updateViaCache: 'none' }))
  const applicationServerKey = keyBytes(publicKey)
  let current = await registration.pushManager.getSubscription()
  if (current?.options?.applicationServerKey) {
    const old = new Uint8Array(current.options.applicationServerKey)
    if (old.length !== applicationServerKey.length || old.some((byte, index) => byte !== applicationServerKey[index])) { await current.unsubscribe(); current = null }
  }
  return current || registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
}
export async function compactImage(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) throw Error('Escolha PNG, JPG, WebP, GIF ou AVIF de até 5 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(Error('Não foi possível ler esta imagem.')); image.src = url })
    if (!img.naturalWidth || img.naturalWidth > 8192 || img.naturalHeight > 8192) throw Error('Use uma imagem com até 8192 pixels de cada lado.')
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 640 / img.naturalWidth, 480 / img.naturalHeight)
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.72)
    if (result.length > MAX_IMAGE_LENGTH) throw Error('Esta imagem ainda está grande. Escolha uma versão menor.')
    return result
  } finally { URL.revokeObjectURL(url) }
}
export async function keepLocalImage(value) {
  if (!value) return ''
  const id = crypto.randomUUID()
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('images')
    request.onerror = () => reject(Error('Não foi possível preparar a imagem no navegador.'))
    request.onblocked = () => reject(Error('Feche outras abas deste gerador e tente novamente.'))
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('images', 'readwrite'), store = tx.objectStore('images')
      const cursor = store.openCursor(); cursor.onsuccess = () => { const item = cursor.result; if (item) { if (item.value.expiresAt <= Date.now()) item.delete(); item.continue() } }
      store.put({ data: value, expiresAt: Date.now() + 10 * 60 * 1000 }, id)
      tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => { db.close(); reject(Error('Não foi possível preparar a imagem no navegador.')) }
    }
  })
  return id
}
