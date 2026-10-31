import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('../src/pages/HomePage.vue', import.meta.url)),
  'utf8',
).replace(/\r\n/g, '\n')

describe('hierarquia dos painéis de configuração no Início', () => {
  it('mantém credenciais em destaque e move o console para Sistema', () => {
    expect(source).toContain('class="settings-priority-stack"')
    expect(source).toContain('.credentials-panel {\n  order: -1;')
    expect(source).toContain('data-testid="credentials-panel"')
    expect(source).toContain('data-testid="useful-links-panel"')

    const credentialsPanel = source.slice(
      source.indexOf('data-testid="credentials-panel"'),
      source.indexOf('Outras Configurações'),
    )
    expect(credentialsPanel).not.toContain('settings-collapse-header')

    expect(source).not.toContain('Console de eventos')
    expect(source).toContain('Outras Configurações')
  })

  it('agrupa os quatro painéis em Outras Configurações inicialmente fechado', () => {
    for (const testId of [
      'useful-links-panel',
      'telegram-onboarding-panel',
      'telegram-messages-panel',
      'whatsapp-auth-panel',
    ]) {
      expect(source).toContain(`data-testid="${testId}"`)
    }

    expect(source.match(/header-class="settings-collapse-header text-weight-bold"/g)).toHaveLength(5)
    expect(source).not.toContain('default-opened')
  })

  it('usa identidade oficial e tonalidade própria nas três linhas de canal', () => {
    expect(source).toContain('icon="bi-telegram"')
    expect(source).toContain('icon="mdi-whatsapp"')
    expect(source).toContain('icon="mdi-gmail"')
    expect(source).toContain("channelConfigHeaderClass('telegram')")
    expect(source).toContain("channelConfigHeaderClass('whatsappCloud')")
    expect(source).toContain("channelConfigHeaderClass('email')")
    expect(source).toContain("email: 'gmail'")
    expect(source).toContain('.channel-config-header--telegram')
    expect(source).toContain('.channel-config-header--whatsapp')
    expect(source).toContain('.channel-config-header--gmail')
  })

  it('padroniza os ícones grandes esverdeados dos cabeçalhos', () => {
    expect(source).toContain('class="settings-panel-title__icon"')
    expect(source).toContain(':deep(.settings-collapse-header .q-item__section--avatar > .q-icon)')
    expect(source).toContain('background: rgba(53, 188, 164, 0.14);')
    expect(source).toContain('color: #137d6c;')
  })

  it('mantém o destinatário opcional de avisos separado dentro do Gmail', () => {
    expect(source).toContain('Email Receber Notificação')
    expect(source).toContain('settings.email.webhookNotificationEmail')
    expect(source).toContain('Email para receber avisos (opcional)')
    expect(source).toContain('Assunto: [TELEGRAM] Nome: mensagem')
    expect(source).not.toContain('Assunto: [TELEGRAM] Nome: mensagem ou [WHATSAPP]')
    expect(source).toContain('Desativar avisos')
    expect(source).toContain("http.delete('/settings/GMAIL_WEBHOOK_NOTIFICATION_EMAIL')")
  })
})
