import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('quasar', () => ({ useQuasar: () => ({}) }))

import {
  META_TEMPLATE_CATEGORIES,
  authenticationCloudComponents,
  buildCustomWhatsAppCloudDefinition,
  normalizeTemplateCategory,
  standardMarketingComponentsFromTemplate,
  templateCategoryOption,
  validateCustomWhatsAppCloudTemplate,
} from '../src/pages/TemplatesPage.vue'

const page = readFileSync(new URL('../src/pages/TemplatesPage.vue', import.meta.url), 'utf8')

describe('favoritos e categorias oficiais de templates', () => {
  it('expõe marketing, utilidade e autenticação no formulário e no payload', () => {
    expect(META_TEMPLATE_CATEGORIES.map((option) => option.value)).toEqual([
      'MARKETING',
      'UTILITY',
      'AUTHENTICATION',
    ])
    expect(normalizeTemplateCategory('utility')).toBe('UTILITY')
    expect(normalizeTemplateCategory('desconhecida')).toBe('MARKETING')
    expect(templateCategoryOption({ payload: { builder: { category: 'authentication' } } }).label)
      .toBe('Autenticação')

    const definition = buildCustomWhatsAppCloudDefinition({
      templateName: 'codigo_verificacao',
      category: 'AUTHENTICATION',
      components: [],
    })
    expect(definition.payload.builder.category).toBe('authentication')
    expect(definition.payload.builder).toMatchObject({
      mode: 'copy_code',
      addSecurityRecommendation: false,
      codeExpirationMinutes: 10,
    })
    expect(definition.payload.builder.components).toMatchObject([
      { type: 'body', parameters: [{ key: 'code' }] },
      { type: 'button', subType: 'otp_copy_code', index: '0', parameters: [{ key: 'code' }] },
    ])
    expect(authenticationCloudComponents()).toHaveLength(2)
    expect(validateCustomWhatsAppCloudTemplate({
      templateName: 'lembrete_util',
      category: 'UTILITY',
      components: [],
    })).toContain('exigem exatamente um corpo')
    expect(page).toContain('label="Categoria oficial na Meta"')
    expect(page).toContain(':options="META_TEMPLATE_CATEGORIES"')

    const utility = standardMarketingComponentsFromTemplate({
      body: 'Olá {{1}}',
      payload: { builder: { components: [
        { type: 'header', text: 'Agendamento confirmado', parameters: [] },
        { type: 'body', text: 'Olá {{1}}', parameters: [{ type: 'text', key: 'name', label: 'Nome' }] },
      ] } },
    })
    expect(utility[0]).toMatchObject({ type: 'header', text: 'Agendamento confirmado', parameters: [] })
    expect(page).toContain('<CloudTextTemplateFields :component="cloudStandardHeader"')
  })

  it('permite favoritar, desfavoritar e filtrar somente favoritos', () => {
    expect(page).toContain('v-model="favoritesOnly"')
    expect(page).toContain('label="Somente favoritos"')
    expect(page).toContain('v-model="categoryFilter"')
    expect(page).toContain("categoryFilter.value === 'all'")
    expect(page).toContain("const matchesFavorite = !favoritesOnly.value || template.isFavorite === true")
    expect(page).toContain("http.patch(`/templates/${id}`, { isFavorite: !previous })")
    expect(page).toContain("props.row.isFavorite ? 'star' : 'star_border'")
    expect(page).toContain("props.row.isFavorite ? 'Desfavoritar template' : 'Favoritar template'")
  })
})
