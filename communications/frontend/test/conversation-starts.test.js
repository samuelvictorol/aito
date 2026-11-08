import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/services/http.js', () => ({ http: { post: vi.fn(async (_path, body) => ({ data: { data: { ...body, conversation: { _id: 'chat-1' } } } })) }, unwrap: response => response.data.data }))
import { http } from '../src/services/http.js'
import { contactStartPhone, manualWebConversationAllowed, startSavedConversation, startedConversationRoute } from '../src/services/conversation-starts.js'

describe('iniciar conversa com contato salvo', () => {
  it('aceita um contato sem identidade ou histórico e impede destinatários inválidos', () => {
    expect(contactStartPhone(null)).toBe('')
    expect(contactStartPhone({ phone: '+55 (11) 99999-1234' })).toBe('5511999991234')
    expect(contactStartPhone({ phone: '1234567890@lid' })).toBe('')
    expect(contactStartPhone({ phone: 'inválido' })).toBe('')
    expect(contactStartPhone({ phone: '5511999991234', channels: [{ channel: 'whatsapp_cloud', deliveryAddress: '5521999994321' }] }, 'whatsapp_cloud')).toBe('5521999994321')
  })
  it('abre por ID de cadastro sem mandar mensagem nem telefone arbitrário', async () => {
    http.post.mockClear()
    const result = await startSavedConversation({ _id: 'contact-1', phone: '5511999991234' }, 'whatsapp_web')
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/conversation-starts', { contactId: 'contact-1', channel: 'whatsapp_web' })
    expect(result.conversation._id).toBe('chat-1')
    await expect(startSavedConversation({ _id: 'contact-1', active: false, phone: '5511999991234' }, 'whatsapp_web')).rejects.toThrow()
    expect(http.post).toHaveBeenCalledTimes(1)
  })
  it('direciona para a caixa e a conversa retornadas', () => {
    expect(startedConversationRoute({ channel: 'whatsapp_web', conversation: { _id: 'web-1' } })).toEqual({ path: '/whatsapp-web', query: { chatId: 'web-1' } })
    expect(startedConversationRoute({ channel: 'whatsapp_cloud', conversation: { id: 'cloud-1' } }, true)).toEqual({ path: '/prototype/whatsapp-cloud', query: { chatId: 'cloud-1', tab: 'conversations' } })
  })
  it('habilita o compositor manual apenas para o administrador e o contato vinculado', () => {
    const chat = { hostContactId: 'c1', manualInitiation: { contactId: 'c1', startedAt: '2026-11-07' } }
    expect(manualWebConversationAllowed(chat, { role: 'admin' })).toBe(true)
    expect(manualWebConversationAllowed(chat, { role: 'collaborator' })).toBe(false)
    expect(manualWebConversationAllowed(chat)).toBe(false)
    expect(manualWebConversationAllowed({ ...chat, isGroup: true }, { role: 'admin' })).toBe(false)
    expect(manualWebConversationAllowed({ ...chat, hiddenAt: '2026-11-07' }, { role: 'admin' })).toBe(false)
  })
})
