import { reactive } from 'vue'
import { http, unwrap } from './http.js'
const muted = reactive(new Set())
let pending
let generation = 0
const key = (channel, id) => channel + ':' + id
export function chatIsMuted(channel, id) { return muted.has(key(channel, id)) }
export function notificationIsMuted(value) { return chatIsMuted(value?.channel, value?.context?.chatId || value?.context?.conversationId) }
export function applyChatAlert(value) { if (value?.muted) muted.add(key(value.channel, value.chatId)); else muted.delete(key(value?.channel, value?.chatId)) }
export async function loadChatAlerts() {
  if (pending) return pending
  const version = generation
  pending = (async () => {
    const values = unwrap(await http.get('/chat-alerts'))
    if (version !== generation) return
    muted.clear()
    for (const value of values || []) applyChatAlert(value)
  })().finally(() => { if (version === generation) pending = null })
  return pending
}
export async function waitForChatAlerts() { try { await pending; return true } catch { return false } }
export async function toggleChatAlerts(channel, chatId) {
  const value = unwrap(await http.put(`/chat-alerts/${channel}/${chatId}`, { muted: !chatIsMuted(channel, chatId) }))
  applyChatAlert(value)
  return value
}
export function clearChatAlerts() { generation += 1; pending = null; muted.clear() }
