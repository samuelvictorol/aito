import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), listeners: new Map() }))
vi.mock('../src/services/http.js', () => ({ http: { get: mocks.get }, unwrap: value => value.data }))
vi.mock('../src/services/socket.js', () => ({ getSocket: () => ({ on: (event, callback) => mocks.listeners.set(event, callback), off: event => mocks.listeners.delete(event) }) }))
import { createInboxUnread } from '../src/services/inbox-unread.js'
let counter
function setup() {
  vi.useFakeTimers()
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() })
  counter = createInboxUnread()
}
afterEach(() => { counter?.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); mocks.listeners.clear(); mocks.get.mockReset() })
describe('live inbox badges', () => {
  it('loads every unread message and refreshes after incoming messages, reads, deletions and reconnects', async () => {
    setup()
    mocks.get.mockResolvedValue({ data: { whatsapp_web: 12, whatsapp_cloud: 5 } })
    counter.start(); await vi.advanceTimersByTimeAsync(0)
    expect(counter.counts).toEqual({ whatsapp_web: 12, whatsapp_cloud: 5 })
    for (const event of ['inbox:changed', 'conversations:updated', 'conversation:removed', 'conversation:history-removed', 'connect']) {
      mocks.get.mockResolvedValue({ data: { whatsapp_web: 0, whatsapp_cloud: 0 } })
      mocks.listeners.get(event)(); await vi.advanceTimersByTimeAsync(150)
      expect(counter.counts).toEqual({ whatsapp_web: 0, whatsapp_cloud: 0 })
    }
    expect(mocks.get).toHaveBeenCalledWith('/chat-alerts/unread-counts')
  })
  it('rechecks changes received during a pending request instead of losing or double-counting them', async () => {
    setup(); let resolve
    mocks.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
      .mockResolvedValue({ data: { whatsapp_web: 4, whatsapp_cloud: 2 } })
    counter.start(); mocks.listeners.get('inbox:changed')(); await vi.advanceTimersByTimeAsync(150)
    resolve({ data: { whatsapp_web: 1, whatsapp_cloud: 0 } }); await vi.advanceTimersByTimeAsync(0)
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(counter.counts).toEqual({ whatsapp_web: 4, whatsapp_cloud: 2 })
  })
  it('keeps the last confirmed counts offline and discards a late response after leaving the app', async () => {
    setup()
    mocks.get.mockResolvedValueOnce({ data: { whatsapp_web: 3, whatsapp_cloud: 1 } })
      .mockRejectedValueOnce(new Error('offline'))
    counter.start(); await vi.advanceTimersByTimeAsync(0)
    mocks.listeners.get('connect')(); await vi.advanceTimersByTimeAsync(150)
    expect(counter.counts.whatsapp_web).toBe(3)
    let resolve
    mocks.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = counter.refresh(); counter.stop()
    resolve({ data: { whatsapp_web: 90, whatsapp_cloud: 90 } }); await pending
    expect(counter.counts).toEqual({ whatsapp_web: 3, whatsapp_cloud: 1 }); expect(mocks.listeners.size).toBe(0)
  })
})
