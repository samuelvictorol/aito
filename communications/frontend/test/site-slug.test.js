import { describe, expect, it } from 'vitest'
import { siteSlug } from '../src/services/site-slug.js'
import { routeAllowed } from '../src/services/access.js'

describe('site routes and four-channel mobile entry', () => {
  it('creates stable readable paths from accented library names without URL separators', () => {
    expect(siteSlug('  Aviso: Preparação do Curso de IA!  ')).toBe('aviso-preparacao-do-curso-de-ia')
    expect(siteSlug('///')).toBe('notificacao')
    expect(siteSlug('Á'.repeat(180))).toHaveLength(100)
  })
  it('supports the mobile-app alias while keeping collaborator channel permissions', () => {
    expect(routeAllowed('/mobile-app', { role: 'admin' })).toBe(true)
    expect(routeAllowed('/mobile-app', { role: 'collaborator', permissions: { channels: ['whatsapp_cloud'] } })).toBe(true)
    expect(routeAllowed('/mobile-app', { role: 'collaborator', permissions: { channels: ['telegram'] } })).toBe(true)
    expect(routeAllowed('/app-mobile', { role: 'collaborator', permissions: { channels: ['email'] } })).toBe(true)
    expect(routeAllowed('/mobile-app', { role: 'collaborator', permissions: { channels: [] } })).toBe(false)
  })
})
