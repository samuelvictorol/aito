import { assistantMenu, assistantCommercialUrl, guidedAssistantReply } from './siteAssistantFlow.js'
export const MESSAGE_LIMIT = 1200
export const initialSuggestions = assistantMenu
export const initialMessage = () => ({ from: 'ia', text: 'Olá! Sou o assistente da AITO. Ajudo você a encontrar a solução para sua operação: sistemas sob medida, automações, bots, IA no WhatsApp ou campanhas com o Notify Flow. O que você quer resolver?', link: null })

export function safeAssistantLink(link) {
  if (!link || typeof link.url !== 'string') return null
  try {
    const url = new URL(link.url, 'https://aitosoftwares.com')
    const allowed = url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      url.origin === 'https://aitosoftwares.com' && url.pathname === '/whatsappbotbuilder' ||
      url.origin === 'https://notify-flow.onrender.com' && url.pathname === '/' ||
      url.origin === 'https://wa.me' && url.pathname === '/5561982637865'
    )
    if (!allowed || /[\u0000-\u0020]/.test(link.url) || link.url.startsWith('//')) return null
    return { url: url.origin === 'https://aitosoftwares.com' ? '/whatsappbotbuilder' : url.href, label: typeof link.label === 'string' ? link.label.slice(0, 80) : 'Conhecer solução' }
  } catch { return null }
}

export function sanitizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).filter(message => message && ['ia', 'user'].includes(message.from) && typeof message.text === 'string' && message.text.trim()).slice(-60).map(message => ({ from: message.from, text: message.text.slice(0, MESSAGE_LIMIT), link: message.from === 'ia' ? safeAssistantLink(message.link) : null }))
}

export function sanitizeReply(data) {
  const replies = (Array.isArray(data?.ia_replies) ? data.ia_replies : []).filter(reply => typeof reply === 'string' && reply.trim()).slice(0, 3).map(reply => reply.trim().slice(0, MESSAGE_LIMIT))
  if (!replies.length) throw new Error('Resposta vazia do assistente')
  const suggestions = (Array.isArray(data?.suggestions) ? data.suggestions : []).filter(item => typeof item === 'string' && item.trim()).slice(0, 4).map(item => item.trim().slice(0, 100))
  return { replies, suggestions, link: safeAssistantLink(data.link) }
}

export function buildCommercialUrl(messages) {
  return assistantCommercialUrl(sanitizeMessages(messages))
}

export function offlineReply(text, history = []) {
  const guided = guidedAssistantReply(text, history)
  if (guided) return sanitizeReply(guided)
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const current = normalize(text)
  const humanFeature = /transfer|encaminh|passar|bot.*humano|humano.*bot|assumir|assume/.test(current) && /atendent|human|equipe|pessoa/.test(current)
  if (!humanFeature && /(?:falar|conversar) (?:com|para)|entrar em contato|contato (?:comercial|da equipe)|quero (?:contratar|pedir um orcamento)|^(?:especialista|atendente|humano|equipe)[?!.]?$/.test(current)) return {
    replies: ['A conexão com o assistente oscilou. Você pode falar diretamente com a equipe AITO pelo botão abaixo. O WhatsApp abre com um resumo para você revisar antes de enviar.'],
    link: { label: 'Conversar com a equipe AITO', url: buildCommercialUrl([...history, { from: 'user', text }]) },
    suggestions: [...initialSuggestions]
  }
  const hasTopic = value => /notify|dispar|campanh|massa|notific|whatsapp|\bwpp\b|bot|\bia\b|sistema|integr|automat|\bcrm\b|nuvem|cloud/.test(value)
  const context = hasTopic(current) ? current : sanitizeMessages(history).filter(message => message.from === 'user').reverse().map(message => normalize(message.text)).find(hasTopic) || current
  const campaign = !humanFeature && /notify|dispar|campanh|massa|notific/.test(context)
  const whatsapp = humanFeature || /whatsapp|\bwpp\b|bot|\bia\b/.test(context)
  const detail = campaign ? 'O Notify Flow organiza notificações em massa pelo WhatsApp com API oficial da Meta, e-mail via Gmail e Telegram. A contratação é exclusivamente pelo WhatsApp da AITO, com atendente real e implementação.' : whatsapp ? 'Para atendimento com fluxos visuais e IA no WhatsApp, conheça o BotBuilder. Você pode comprar o código com licença, token key e manuais ou contratar configuração, deploy e integração pela AITO.' : 'A AITO desenvolve sistemas sob medida e integrações para automatizar processos. Você pode continuar explicando seu cenário ou falar com nossa equipe.'
  return {
    replies: [`A conexão com o assistente oscilou. ${detail}`],
    link: campaign ? { label: 'Conhecer o Notify Flow', url: 'https://notify-flow.onrender.com/' } : whatsapp ? { label: 'Conhecer o WhatsApp BotBuilder', url: '/whatsappbotbuilder' } : { label: 'Conversar com a equipe AITO', url: buildCommercialUrl([...history, { from: 'user', text }]) },
    suggestions: ['Quero criar um bot no WhatsApp', 'Quero fazer disparos em massa', 'Quero falar com um especialista']
  }
}
