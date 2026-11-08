import { http, unwrap } from './http.js'

export function contactStartPhone(contact = {}, channel = 'whatsapp_web') {
  contact ||= {}
  const identity = contact.channels?.find(item => item.channel === channel)
  for (const candidate of [identity?.deliveryAddress, contact.phone]) {
    const raw = String(candidate || '').trim()
    if (!raw || /@lid$/i.test(raw) || !/^[+\d\s().-]+$/.test(raw)) continue
    const digits = raw.replace(/\D/g, '')
    if (/^[1-9]\d{7,14}$/.test(digits)) return digits
  }
  return ''
}

export function manualWebConversationAllowed(chat, actor) {
  return actor?.role === 'admin' && !chat?.isGroup && !chat?.hiddenAt
    && Boolean(chat?.hostContactId && chat?.manualInitiation?.startedAt)
    && String(chat.manualInitiation.contactId) === String(chat.hostContactId)
}

export async function startSavedConversation(contact, channel) {
  const contactId = contact?.id || contact?._id
  if (!contactId || contact.active === false || !contactStartPhone(contact, channel)) throw new Error('Selecione um contato ativo com telefone válido, incluindo DDI e DDD.')
  return unwrap(await http.post('/conversation-starts', { contactId, channel }))
}

export function startedConversationRoute(result, prototype = false) {
  const query = { chatId: String(result.conversation.id || result.conversation._id) }
  return { path: `${prototype ? '/prototype' : ''}/${result.channel === 'whatsapp_cloud' ? 'whatsapp-cloud' : 'whatsapp-web'}`, query: result.channel === 'whatsapp_cloud' ? { ...query, tab: 'conversations' } : query }
}
