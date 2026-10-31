import { playAppSound } from './sounds.js'
import { notificationIsMuted, waitForChatAlerts } from './chat-alerts.js'

const seen = new Set()
let active = false
export function setAdminMessageAlertsActive(value) { active = value === true }
export function messageSound(notification) {
  if (notification?.kind === 'whatsapp_cloud_message_received') return 'whatsapp_cloud'
  if (notification?.kind === 'whatsapp_web_message_received') return 'whatsapp_web'
  return null
}

export async function playAdminMessageAlert(notification) {
  if (!await waitForChatAlerts()) return false
  const sound = messageSound(notification)
  if (!active || !sound || !notification?.id || seen.has(notification.id) || notificationIsMuted(notification)) return false
  if (Date.now() - new Date(notification.createdAt).getTime() > 60000) return false
  seen.add(notification.id)
  if (seen.size > 200) seen.delete(seen.values().next().value)
  // Desktop audio remains global, including when another admin page/tab is selected.
  if (window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(any-pointer: fine)').matches) return false
  const playOnce = async () => {
    if (!active || notificationIsMuted(notification)) return false
    const key = 'aito.communication.messageSound.' + notification.id
    try {
      if (localStorage.getItem(key)) return false
      localStorage.setItem(key, String(Date.now()))
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const stored = localStorage.key(index)
        if (stored?.startsWith('aito.communication.messageSound.') && Date.now() - Number(localStorage.getItem(stored)) > 60000) localStorage.removeItem(stored)
      }
    } catch { /* Private browsing may disable local storage; per-tab deduplication still applies. */ }
    return playAppSound(sound)
  }
  return navigator.locks?.request ? navigator.locks.request('notify-message-audio', playOnce) : playOnce()
}
