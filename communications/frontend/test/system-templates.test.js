import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('quasar', () => ({ useQuasar: () => ({}) }))
import {
  SYSTEM_WHATSAPP_TEMPLATE_NAMES,
  buildCustomWhatsAppCloudDefinition,
  isSystemTemplateRecord,
  templateFormatLabel,
} from '../src/pages/TemplatesPage.vue'

const page = readFileSync(new URL('../src/pages/TemplatesPage.vue', import.meta.url), 'utf8')

describe('templates oficiais editáveis', () => {
  it('mantém a identificação dos nomes oficiais sem bloquear registros de seed', () => {
    expect(SYSTEM_WHATSAPP_TEMPLATE_NAMES).toEqual([
      'jaspers_market_plain_text_v1',
      'jaspers_market_order_confirmation_v1',
      '3p_direct_integration_test_template',
    ])
    expect(isSystemTemplateRecord({ channel: 'whatsapp_cloud', externalTemplateName: 'verify_code_1' })).toBe(false)
    expect(isSystemTemplateRecord({ channel: 'telegram', externalTemplateName: 'verify_code_1' })).toBe(false)
    expect(isSystemTemplateRecord({ channel: 'whatsapp_cloud', externalTemplateName: 'campanha_v2' })).toBe(false)
    expect(isSystemTemplateRecord({ systemManaged: true, deletable: false })).toBe(false)
  })

  it('diferencia templates oficiais do numero de teste e do numero de producao', () => {
    expect(templateFormatLabel({
      templateType: 'approved_template',
      externalTemplateName: 'verify_code_1',
    })).toBe('OFICIAL META')
    expect(templateFormatLabel({
      templateType: 'approved_template',
      externalTemplateName: '3p_direct_integration_test_template',
    })).toBe('OFICIAL META PROD NUMBER')
    expect(page).toContain('title="Templates oficiais e número remetente"')
    expect(page).toContain('tooltip="Entenda quais templates pertencem a cada número"')
    expect(page).toContain('o modelo com o mesmo nome e idioma está disponível e aprovado')
    expect(page).not.toContain('class="bg-blue-1 text-blue-10 q-mb-md"')
  })

  it('permite editar e remover qualquer template com confirmação', () => {
    expect(page).not.toContain('Template padrão protegido')
    expect(page).not.toContain('Este é um template padrão do sistema e não pode ser removido.')
    expect(page).toContain('aria-label="Remover template"')
    expect(page).toContain("title: 'Remover template?'")
    expect(page).toContain("ok: { color: 'negative', label: 'Remover' }")
  })

  it('permite reutilizar a variavel codigo no corpo e no botao OTP', () => {
    const definition = buildCustomWhatsAppCloudDefinition({
      templateName: 'verify_code_1',
      languageCode: 'pt_BR',
      components: [
        { type: 'body', parameters: [{ type: 'text', key: 'codigo', label: 'Código' }] },
        { type: 'button', subType: 'otp_copy_code', index: 0, parameters: [{ type: 'text', key: 'codigo', label: 'Copiar código' }] },
      ],
    })
    expect(definition.variables).toEqual(['codigo'])
    expect(definition.payload.builder.components[1]).toMatchObject({ subType: 'otp_copy_code' })
  })
})
