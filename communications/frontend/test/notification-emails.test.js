import { describe, expect, it } from 'vitest'
import {
  MAX_NOTIFICATION_EMAILS,
  notificationEmailsPayload,
  validateNotificationEmails,
} from '../src/services/notification-emails.js'

describe('destinatários dos avisos do WhatsApp', () => {
  it('preserva a seleção individual e normaliza os endereços sem enviar campos da interface', () => {
    expect(notificationEmailsPayload([
      { id: 1, email: '  Admin@Example.com ', enabled: true },
      { id: 2, email: 'equipe@example.com', enabled: false },
    ])).toEqual([
      { email: 'admin@example.com', enabled: true },
      { email: 'equipe@example.com', enabled: false },
    ])
  })

  it('mantém desativados os destinatários sem opt-in explícito', () => {
    expect(notificationEmailsPayload([{ email: 'admin@example.com' }])[0].enabled).toBe(false)
    expect(notificationEmailsPayload([{ email: 'admin@example.com', enabled: 'false' }])[0].enabled).toBe(false)
  })

  it('aceita limpar a lista e salvar vários destinatários desmarcados', () => {
    expect(validateNotificationEmails([])).toBe('')
    expect(notificationEmailsPayload([])).toEqual([])
    expect(validateNotificationEmails([
      { email: 'admin@example.com', enabled: false },
      { email: 'equipe@example.com', enabled: false },
    ])).toBe('')
  })

  it('rejeita endereços vazios, inválidos e duplicados mesmo quando desmarcados', () => {
    for (const email of ['', 'inválido', 'a@@example.com', 'a b@example.com', 'a@example']) {
      expect(validateNotificationEmails([{ email, enabled: false }])).toContain('e-mail válido')
    }
    expect(validateNotificationEmails([
      { email: ' Admin@Example.com ', enabled: true },
      { email: 'admin@example.com', enabled: false },
    ])).toContain('apenas uma vez')
  })

  it('limita a lista ao máximo aceito pelo servidor', () => {
    const recipients = Array.from({ length: MAX_NOTIFICATION_EMAILS + 1 }, (_, index) => ({
      email: `admin${index}@example.com`, enabled: false,
    }))
    expect(validateNotificationEmails(recipients)).toContain('no máximo 20')
    expect(validateNotificationEmails(recipients.slice(0, MAX_NOTIFICATION_EMAILS))).toBe('')
  })
})
