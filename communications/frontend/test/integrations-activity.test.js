import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { integrationQueueLabel, integrationStatusColor } from '../src/services/integrations.js'

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)), 'utf8')
}

describe('observabilidade dos apps de integração', () => {
  it('traduz o ciclo da fila e destaca estados terminais', () => {
    expect(integrationQueueLabel('waiting')).toBe('Na fila')
    expect(integrationQueueLabel('active')).toContain('processando')
    expect(integrationQueueLabel('recovery_pending')).toContain('recuperação')
    expect(integrationStatusColor('delivered')).toBe('positive')
    expect(integrationStatusColor('failed')).toBe('negative')
  })

  it('oferece webhooks, filtros, detalhes de entrega e linha do tempo por app', () => {
    const page = source('pages/IntegrationsPage.vue')
    const service = source('services/integrations.js')

    expect(page).toContain('label="Webhooks"')
    expect(page).toContain('Webhooks e atividade')
    expect(page).toContain('Buscar template, tenant ou entidade')
    expect(page).toContain('Linha do tempo da fila e entregas')
    expect(page).toContain('delivery.recipient?.phoneMasked')
    expect(page).toContain("['queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped']")
    expect(page).toContain(':maximized="$q.screen.lt.md"')
    expect(page).toContain('max-width: 1180px !important')
    expect(service).toContain('`/integrations/apps/${appId}/activity`')
    expect(service).toContain('`/integrations/apps/${appId}/activity/${type}/${activityId}`')
  })
})
