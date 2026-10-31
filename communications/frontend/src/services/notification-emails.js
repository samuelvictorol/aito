export const MAX_NOTIFICATION_EMAILS = 20

export function notificationEmailsPayload(recipients = []) {
  return recipients.map((recipient) => ({
    email: String(recipient.email || '').trim().toLowerCase(),
    enabled: recipient.enabled === true,
  }))
}

export function validateNotificationEmails(recipients = []) {
  if (recipients.length > MAX_NOTIFICATION_EMAILS) {
    return `Cadastre no máximo ${MAX_NOTIFICATION_EMAILS} e-mails para receber notificações.`
  }
  const normalized = notificationEmailsPayload(recipients)
  const seen = new Set()
  for (const [index, recipient] of normalized.entries()) {
    if (recipient.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
      return `Informe um e-mail válido no destinatário ${index + 1}.`
    }
    if (seen.has(recipient.email)) return 'Cada e-mail deve aparecer apenas uma vez na lista.'
    seen.add(recipient.email)
  }
  return ''
}
