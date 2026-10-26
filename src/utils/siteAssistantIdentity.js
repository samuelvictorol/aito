export const identityGreeting = () => 'Olá! Sou o assistente da AITO. Para começar, como você se chama?'
const firstName = name => String(name || '').trim().split(/\s+/)[0]
export const identityContactQuestion = name => `Prazer, ${firstName(name)}! Qual e-mail ou telefone com DDD podemos usar para continuar este atendimento? Pode enviar os dois, se preferir.`
export const identityWelcome = name => `Obrigado, ${firstName(name)}! Agora me conte: o que você quer resolver?`

export function parseVisitorName(value) {
  const name = String(value || '').trim().replace(/^(?:meu nome [ée]|me chamo|eu sou|sou)\s+/i, '').replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 100 || !/\p{L}/u.test(name) || /[@\d\x00-\x1f]/.test(name)) return null
  return name
}

export function parseVisitorContact(value) {
  const text = String(value || '').trim()
  if (text.length > 400) return null
  const emails = text.match(/[^\s<>(),;:@]+@[^\s<>(),;:@]+\.[a-z]{2,}/gi) || []
  if (emails.length > 1) return null
  const email = (emails[0] || '').toLowerCase()
  const remaining = email ? text.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '') : text
  if (email.length > 254 || remaining.includes('@')) return null
  const phones = (remaining.match(/\+?\d[\d\s().-]{8,}\d/g) || []).map(phone => phone.replace(/\D/g, ''))
  if (phones.length > 1 || phones.some(phone => !/^\d{10,15}$/.test(phone))) return null
  const phone = phones[0] || ''
  return email || phone ? { email, phone } : null
}
