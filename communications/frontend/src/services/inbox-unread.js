import { reactive } from 'vue'
import { http, unwrap } from './http.js'
import { getSocket } from './socket.js'

const events = ['connect', 'system:ready', 'inbox:changed', 'conversations:updated', 'conversation:removed', 'conversation:history-removed']
export function createInboxUnread() {
  const counts = reactive({ whatsapp_web: 0, whatsapp_cloud: 0 })
  let active = false, pending = false, dirty = false, generation = 0, timer, socket
  async function refresh() {
    if (!active) return
    dirty = true
    if (pending) return
    pending = true
    const version = generation
    try {
      do {
        dirty = false
        const values = unwrap(await http.get('/chat-alerts/unread-counts')) || {}
        if (!active || version !== generation) return
        for (const key of Object.keys(counts)) counts[key] = Number.isFinite(Number(values[key])) ? Math.max(0, Math.floor(Number(values[key]))) : 0
      } while (dirty)
    } catch { /* Keep the last confirmed counts during a brief disconnection. */ }
    finally { pending = false; if (active && dirty) schedule() }
  }
  function schedule() { clearTimeout(timer); if (active) timer = setTimeout(refresh, 120) }
  function onVisible() { if (document.visibilityState === 'visible') schedule() }
  function start() {
    if (active) return
    active = true; generation += 1; socket = getSocket()
    for (const event of events) socket.on(event, schedule)
    document.addEventListener('visibilitychange', onVisible)
    void refresh()
  }
  function stop() {
    active = false; generation += 1; clearTimeout(timer)
    for (const event of events) socket?.off(event, schedule)
    document.removeEventListener('visibilitychange', onVisible)
  }
  return { counts, start, stop, refresh }
}
