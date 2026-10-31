import { describe, expect, it, vi, afterEach } from 'vitest'
import { attendanceGroups, matchesScope } from '../src/modules/whatsapp-web/attendance-state.js'
const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('../src/services/http.js', () => ({ http, unwrap: value => value.data }))
import { applyChatAlert, chatIsMuted, clearChatAlerts, toggleChatAlerts, loadChatAlerts, waitForChatAlerts } from '../src/services/chat-alerts.js'
afterEach(() => { clearChatAlerts(); vi.clearAllMocks() })
describe('mobile inbox and muted conversations', () => {
  it('groups AI, triage, waiting and each attendant without mixing closed conversations', () => {
    const chats = [{ _id: 'ai', bot: { ai: { profileKey: 'assistant' } } }, { _id: 'triage', bot: {} }, { _id: 'waiting', bot: { paused: true } },
      { _id: 'owner', bot: { ownerId: 'samuel', ownerNick: 'Samuel', paused: true } }, { _id: 'done', bot: { ownerId: 'samuel', attendanceStatus: 'closed' } }]
    const groups = attendanceGroups(chats)
    expect(groups.map(value => value.key)).toEqual(['ai', 'triage', 'waiting', 'owner:samuel', 'closed'])
    expect(groups.find(value => value.key === 'owner:samuel').label).toBe('ATENDIDO POR SAMUEL')
    expect(groups.reduce((count, value) => count + value.items.length, 0)).toBe(5)
    expect(matchesScope(chats[0], 'ai')).toBe(true)
    expect(matchesScope(chats[0], 'triage')).toBe(false)
    expect(matchesScope(chats[1], 'triage')).toBe(true)
  })
  it('keeps mute state per channel, updates from realtime and uses the authenticated API', async () => {
    applyChatAlert({ channel: 'whatsapp_web', chatId: 'one', muted: true })
    expect(chatIsMuted('whatsapp_web', 'one')).toBe(true)
    expect(chatIsMuted('whatsapp_cloud', 'one')).toBe(false)
    http.put.mockResolvedValue({ data: { channel: 'whatsapp_web', chatId: 'one', muted: false } })
    await toggleChatAlerts('whatsapp_web', 'one')
    expect(http.put).toHaveBeenCalledWith('/chat-alerts/whatsapp_web/one', { muted: false })
    expect(chatIsMuted('whatsapp_web', 'one')).toBe(false)
  })
  it('waits for initial preferences so a muted conversation cannot briefly play audio during login', async () => {
    let resolve
    http.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const load = loadChatAlerts()
    let settled = false
    const ready = waitForChatAlerts().then(() => { settled = true })
    await Promise.resolve(); expect(settled).toBe(false)
    resolve({ data: [{ channel: 'whatsapp_cloud', chatId: 'two', muted: true }] })
    await load; await ready
    expect(settled).toBe(true); expect(chatIsMuted('whatsapp_cloud', 'two')).toBe(true)
  })
  it('discards an earlier account response after logout', async () => {
    let resolve
    http.get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const load = loadChatAlerts()
    clearChatAlerts()
    resolve({ data: [{ channel: 'whatsapp_web', chatId: 'old-account', muted: true }] })
    await load
    expect(chatIsMuted('whatsapp_web', 'old-account')).toBe(false)
  })
})
