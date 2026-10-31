import { http, unwrap } from './http.js'
import { inPrototype, prototypeBlocked } from './prototype-runtime.js'

const PREFERENCE = 'aito.communication.browserPush.enabled'
let adminActive = false
let generation = 0
let registrationPromise
let activation

function publishState(enabled) {
  window.dispatchEvent?.(new CustomEvent('notify:browser-push-state', { detail: { enabled } }))
}

export function browserPushSupport() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  if (ios && !standalone) return { supported: false, installRequired: true,
    message: 'No iPhone, use Compartilhar → Adicionar à Tela de Início. Abra o app pelo ícone, entre como administrador e ative os alertas aqui.' }
  const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return { supported, installRequired: false, message: supported ? '' : 'Este navegador não oferece Web Push. Use um navegador atualizado com HTTPS.' }
}

function register() {
  if (!registrationPromise) registrationPromise = navigator.serviceWorker.register('/comunicacao/app/notify-sw.js', { scope: '/comunicacao/app/' })
    .then(() => navigator.serviceWorker.ready)
    .catch(error => { registrationPromise = null; throw error })
  return registrationPromise
}

async function workerState(registration, enabled) {
  const worker = registration.active
  if (!worker) return
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Não foi possível preparar as notificações. Tente novamente.')) }, 5000)
    channel.port1.onmessage = () => { clearTimeout(timeout); channel.port1.close(); resolve() }
    worker.postMessage({ type: 'ADMIN_ALERTS', enabled }, [channel.port2])
  })
}

function keyBytes(value) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, character => character.charCodeAt(0))
}

export function enableBrowserPush(options = {}) {
  if (inPrototype()) return Promise.reject(prototypeBlocked())
  if (!activation) {
    const request = connectBrowserPush(options).finally(() => { if (activation === request) activation = null })
    activation = request
  }
  return activation
}

async function connectBrowserPush({ askPermission = false } = {}) {
  const current = generation
  const support = browserPushSupport()
  if (!support.supported) throw new Error(support.message)
  // Permission must be requested synchronously from the button's user gesture, especially on iOS.
  const permission = askPermission && Notification.permission === 'default'
    ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Notificações bloqueadas. Libere a permissão nas configurações do navegador ou do aplicativo.'
    : 'A permissão não foi concedida. Toque em Ativar para tentar novamente.')
  if (!adminActive || generation !== current) return false
  const config = unwrap(await http.get('/auth/browser-push/config'))
  if (!config.enabled) throw new Error('O serviço de notificações está temporariamente indisponível. Tente novamente.')
  const registration = await register()
  if (!adminActive || generation !== current) return false
  let subscription = await registration.pushManager.getSubscription()
  const key = keyBytes(config.publicKey)
  if (subscription?.options?.applicationServerKey && new Uint8Array(subscription.options.applicationServerKey).join() !== key.join()) {
    await subscription.unsubscribe()
    subscription = null
  }
  // Persist the local admin guard before subscribing, so an initial push is never invisible on Safari.
  await workerState(registration, true)
  try {
    subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    if (!adminActive || generation !== current) { await subscription.unsubscribe(); await workerState(registration, false); return false }
    await http.post('/auth/browser-push/subscription', { subscription: subscription.toJSON() })
    if (!adminActive || generation !== current) { await removeSubscription(registration); return false }
    localStorage.setItem(PREFERENCE, 'true')
    publishState(true)
    return true
  } catch (error) {
    await removeSubscription(registration).catch(() => {})
    throw error
  }
}

async function removeSubscription(registration) {
  await workerState(registration, false)
  const subscription = await registration.pushManager.getSubscription()
  const closeVisible = registration.getNotifications().then(items => items.forEach(item => item.close()))
  if (!subscription) { await closeVisible; return }
  // Delete on the server and revoke with the browser even if either service is unavailable.
  await Promise.allSettled([
    http.delete('/auth/browser-push/subscription', { data: { endpoint: subscription.endpoint } }),
    subscription.unsubscribe(),
    closeVisible,
  ])
}

export async function disableBrowserPush({ forget = false } = {}) {
  if (inPrototype()) return false
  generation += 1
  adminActive = false
  activation = null
  if (forget) localStorage.removeItem(PREFERENCE)
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/comunicacao/app/')
    if (registration?.active?.scriptURL?.endsWith('/comunicacao/app/notify-sw.js')) await removeSubscription(registration)
  }
  publishState(false)
}

export async function startAdminPush({ restore = true } = {}) {
  if (inPrototype()) return false
  adminActive = true
  if (restore && localStorage.getItem(PREFERENCE) === 'true' && browserPushSupport().supported && Notification.permission === 'granted') {
    return enableBrowserPush()
  }
  return false
}

export async function browserPushIsEnabled() {
  if (inPrototype()) return false
  if (!browserPushSupport().supported || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration('/comunicacao/app/')
  return Boolean(await registration?.pushManager.getSubscription())
}
