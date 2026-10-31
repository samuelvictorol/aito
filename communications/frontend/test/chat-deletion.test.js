import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const web = readFileSync(new URL('../src/modules/whatsapp-web/pages/ChatsPage.vue', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/pages/ChatsPage.vue', import.meta.url), 'utf8')
function handler(source, name, globals) {
  const functionSource = source.match(new RegExp(`function ${name}\\(payload(?: = \\{\\})?\\) \\{[\\s\\S]*?\\n\\}`))?.[0]
  if (!functionSource) throw new Error('Missing handler ' + name)
  vm.createContext(globals)
  vm.runInContext(functionSource, globals)
  return payload => globals[name](payload)
}

describe('message and conversation removal events', () => {
  it('removes a single message and reply target without erasing other messages', () => {
    const globals = { deletedMessageIds: new Set(), selectedId: { value: 'chat' }, messages: { value: [{ _id: 'removed' }, { _id: 'kept' }] },
      replyTo: { value: { _id: 'removed' } }, actionMessage: { value: { _id: 'removed' } }, messageActionsOpen: { value: true } }
    handler(web, 'onMessageRemoved', globals)({ id: 'removed', chat: 'chat' })
    expect(globals.messages.value.map(item => item._id)).toEqual(['kept'])
    expect(globals.replyTo.value).toBeNull()
    expect(globals.messageActionsOpen.value).toBe(false)
    expect(globals.deletedMessageIds.has('removed')).toBe(true)
  })
  it('history removal discards older requests while preserving messages that arrived after the deletion', () => {
    const globals = { selectedId: { value: 'chat' }, chatRequest: 3, messages: { value: [{ _id: 'old', activityVersion: 1 }, { _id: 'new', activityVersion: 5 }] },
      replyTo: { value: {} }, messageActionsOpen: { value: true }, messagePage: { value: 4 }, messagePages: { value: 8 }, openingChat: { value: true }, onChat: vi.fn() }
    handler(web, 'onHistoryRemoved', globals)({ id: 'chat', chat: { _id: 'chat', lastHiddenVersion: 4 } })
    expect(globals.messages.value.map(item => item._id)).toEqual(['new'])
    expect(globals.chatRequest).toBe(4)
    expect(globals.messagePage.value).toBe(1)
    expect(globals.openingChat.value).toBe(false)
  })
  it('late realtime events cannot restore messages from cleared versions or individually removed IDs', () => {
    const globals = { chats: { value: [{ _id: 'chat', lastHiddenVersion: 4, activityVersion: 6 }] }, selectedId: { value: 'chat' },
      selected: { value: null }, deletedMessageIds: new Set(['removed']), messages: { value: [] }, onChat: vi.fn(), scrollBottom: vi.fn() }
    const incoming = handler(web, 'onMessage', globals)
    const chat = { _id: 'chat', provider: 'whatsapp' }
    incoming({ chat, message: { _id: 'old', activityVersion: 2 } })
    incoming({ chat, message: { _id: 'removed', activityVersion: 7 } })
    expect(globals.messages.value).toHaveLength(0)
    incoming({ chat, message: { _id: 'new', activityVersion: 7 } })
    expect(globals.messages.value.map(item => item._id)).toEqual(['new'])
  })
  it('Cloud removal is idempotent, updates pagination once and leaves another conversation untouched', () => {
    const globals = { deletedStoredMessageIds: new Set(), selected: { value: { id: 'chat' } }, cloudConversationId: value => value?.id,
      messages: { value: [{ id: 'deleted' }, { id: 'kept' }] }, messageTotal: { value: 8 } }
    const remove = handler(cloud, 'onStoredMessageRemoved', globals)
    remove({ conversationId: 'chat', messageId: 'deleted' })
    remove({ conversationId: 'chat', messageId: 'deleted' })
    remove({ conversationId: 'other', messageId: 'elsewhere' })
    expect(globals.messages.value.map(item => item.id)).toEqual(['kept'])
    expect(globals.messageTotal.value).toBe(7)
  })
})
