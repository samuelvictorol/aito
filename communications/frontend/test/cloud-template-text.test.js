import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { cloudTextTokens, cloudTextEditorValue, updateCloudText } from '../src/services/cloud-template-text.js'
vi.mock('quasar', () => ({ useQuasar: () => ({}) }))
import {
  buildCustomWhatsAppCloudDefinition, buildCustomWhatsAppCloudPreviewPayload,
  standardMarketingComponentsFromTemplate, previewCloudHeaderText,
  previewCloudComponentText, validateCustomWhatsAppCloudTemplate,
  normalizeMetaLanguageCode,
} from '../src/pages/TemplatesPage.vue'
import { notificationTemplateVariableDefinitions, notificationTemplatePreview } from '../src/pages/NotificationsPage.vue'

const require = createRequire(import.meta.url)
const { createTemplateSchema } = require('../../../../api/communications/runtime/src/dtos/templates.dto')
const { normalizeOfficialTemplateDefinition, buildCustomTemplateMessage, buildCustomTemplatePreview } = require('../../../../api/communications/runtime/src/utils/whatsapp-cloud-templates')

function reminder() {
  const header = { type: 'header', text: '', parameters: [] }
  const body = { type: 'body', text: '', parameters: [] }
  updateCloudText(header, '{{1}}')
  updateCloudText(body, 'Descrição: {{1}}\n\nData: {{2}} - Notify Flow')
  header.parameters[0].example = 'Você tem um evento futuro'
  body.parameters[0].example = 'Prova de Direito Administrativo'
  body.parameters[1].example = '20/09/2026 às 07:30 na SALA 8'
  return {
    templateName: 'ejut_reminder', languageCode: 'pt_BR', category: 'UTILITY',
    components: [header, body, { type: 'footer', text: 'Desenvolvido por aitosoftwares', parameters: [] }],
  }
}

describe('cadastro fiel ao modelo Meta', () => {
  it('preserva até 10 mil caracteres e quebras de linha entre cadastro, prévia e envio', () => {
    const value = 'Primeiro parágrafo\n\n' + 'a'.repeat(9979) + 'Z'
    expect(value).toHaveLength(10000)
    const body = { type: 'body', text: '', parameters: [] }
    updateCloudText(body, 'Prezado(a),\n\n{{1}}\n\nEquipe.')
    body.parameters[0].example = value
    const input = { templateName: 'texto_longo', languageCode: 'pt_BR', category: 'UTILITY', components: [body] }
    const definition = buildCustomWhatsAppCloudDefinition(input)
    const parsed = createTemplateSchema.parse({ body: { name: 'Texto longo', channel: 'whatsapp_cloud', ...definition } })
    const stored = normalizeOfficialTemplateDefinition(parsed.body)
    expect(stored.payload.builder.components[0].parameters[0].example).toBe(value)
    const custom = { name: stored.externalTemplateName, languageCode: stored.languageCode, builder: stored.payload.builder, variables: { body_1: value } }
    expect(buildCustomTemplatePreview(custom).body.text).toBe('Prezado(a),\n\n' + value + '\n\nEquipe.')
    expect(buildCustomTemplateMessage(custom).template.components[0].parameters[0].text).toBe(value)
    const tooLong = JSON.parse(JSON.stringify(definition))
    tooLong.payload.builder.components[0].parameters[0].example = value + '!'
    expect(createTemplateSchema.safeParse({ body: { name: 'Texto longo', channel: 'whatsapp_cloud', ...tooLong } }).success).toBe(false)
  })
  it.each(['pt_BR', 'en', 'en_US'])('preserva %s do seletor ao cadastro, reabertura, edição e envio', (languageCode) => {
    const input = { ...reminder(), languageCode }
    const definition = buildCustomWhatsAppCloudDefinition(input)
    const dto = createTemplateSchema.parse({ body: { name: 'Idioma aprovado', channel: 'whatsapp_cloud', ...definition } })
    const stored = JSON.parse(JSON.stringify(normalizeOfficialTemplateDefinition(dto.body)))
    expect(stored.languageCode).toBe(languageCode)
    const reopened = {
      ...input,
      languageCode: normalizeMetaLanguageCode(stored.languageCode),
      components: standardMarketingComponentsFromTemplate(stored),
    }
    expect(validateCustomWhatsAppCloudTemplate(reopened)).toBeNull()
    const updated = normalizeOfficialTemplateDefinition({ ...stored, ...buildCustomWhatsAppCloudDefinition(reopened) })
    const values = { header_1: 'Título', body_1: 'Descrição', body_2: 'Data' }
    expect(buildCustomWhatsAppCloudPreviewPayload(reopened).template.language.code).toBe(languageCode)
    expect(notificationTemplatePreview(updated, 'whatsapp_cloud', values).languageCode).toBe(languageCode)
    expect(buildCustomTemplateMessage({
      name: updated.externalTemplateName, languageCode: updated.languageCode,
      builder: updated.payload.builder, variables: values,
    }).template.language.code).toBe(languageCode)
  })

  it('leva ejut_reminder do editor ao DTO, armazenamento, reabertura e payload de envio', () => {
    const input = reminder()
    expect(validateCustomWhatsAppCloudTemplate(input)).toBeNull()
    const definition = buildCustomWhatsAppCloudDefinition(input)
    const dto = createTemplateSchema.parse({ body: { name: 'Notify Flow lembrete', channel: 'whatsapp_cloud', ...definition } })
    const stored = normalizeOfficialTemplateDefinition(dto.body)
    expect(stored.externalTemplateName).toBe('ejut_reminder')
    expect(stored.payload.builder.category).toBe('utility')
    expect(definition.variables).toEqual(['header_1', 'body_1', 'body_2'])
    expect(stored.payload.builder.components[1].text).toBe(input.components[1].text)
    const restored = standardMarketingComponentsFromTemplate(stored)
    expect(restored[1].parameters).toHaveLength(2)
    expect(cloudTextEditorValue(restored[0])).toBe('{{1}}')
    const values = { header_1: 'Seu evento começa amanhã', body_1: 'Curso de formação', body_2: '26/09 às 10h' }
    const custom = { name: stored.externalTemplateName, languageCode: stored.languageCode, builder: stored.payload.builder, variables: values }
    expect(buildCustomTemplateMessage(custom).template.components).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: values.header_1 }] },
      { type: 'body', parameters: [{ type: 'text', text: values.body_1 }, { type: 'text', text: values.body_2 }] },
    ])
    expect(notificationTemplateVariableDefinitions(stored, 'whatsapp_cloud').map((item) => item.key)).toEqual(definition.variables)
    expect(buildCustomTemplatePreview(custom).header.text).toBe(values.header_1)
    expect(buildCustomTemplatePreview(custom).body.text).toBe('Descrição: Curso de formação\n\nData: 26/09 às 10h - Notify Flow')
    expect(JSON.stringify(notificationTemplatePreview(stored, 'whatsapp_cloud', values))).not.toContain('{{')
    expect(previewCloudHeaderText(input.components[0])).toBe(input.components[0].parameters[0].example)
    expect(previewCloudComponentText(input.components[1])).toContain('20/09/2026')
    expect(JSON.stringify(buildCustomWhatsAppCloudPreviewPayload(input))).not.toContain('parameter_name')
    expect(() => buildCustomTemplateMessage({ ...custom, variables: { header_1: 'Título', body_1: 'Descrição' } })).toThrow()
  })

  it('edita vários marcadores preservando valores, rótulos e a ordem numérica', () => {
    const body = reminder().components[1]
    body.parameters[0].fixedValue = 'Descrição fixa'
    body.parameters[0].contentMode = 'fixed'
    body.parameters[1].label = 'Data do evento'
    updateCloudText(body, 'Data: {{2}}. Descrição: {{1}}. Local: {{3}}')
    expect(body.parameters.map((p) => p.key)).toEqual(['body_1', 'body_2', 'body_3'])
    expect(body.parameters[0].fixedValue).toBe('Descrição fixa')
    expect(body.parameters[1].label).toBe('Data do evento')
    updateCloudText(body, 'Data: {{2}}. Descrição: {{1}}')
    expect(body.parameters).toHaveLength(2)
    updateCloudText(body, 'Texto sem variáveis')
    expect(body.parameters).toEqual([])
  })

  it('preserva os mapeamentos nomeados existentes e permite acrescentar variáveis', () => {
    const body = { type: 'body', text: 'Olá {{nome}}', parameters: [{ type: 'text', key: 'customerName', parameterName: 'nome', label: 'Cliente', example: 'Ana' }] }
    updateCloudText(body, 'Olá {{nome}}, pedido {{pedido}}')
    expect(body.parameters[0]).toMatchObject({ key: 'customerName', parameterName: 'nome', example: 'Ana' })
    expect(body.parameters[1]).toMatchObject({ key: 'body_pedido', parameterName: 'pedido' })
    const payload = buildCustomWhatsAppCloudPreviewPayload({ components: [body] })
    expect(payload.template.components[0].parameters.map((p) => p.parameter_name)).toEqual(['nome', 'pedido'])
  })

  it.each(['{{0}}', '{{01}}', '{{2}}', '{{1}} {{3}}', '{{1}} {{nome}}', '{{Nome}}', '{{1}', '{{1}} {{}}'])('rejeita marcadores inválidos: %s', (text) => {
    expect(cloudTextTokens(text).error).toBeTruthy()
  })

  it('limita o cabeçalho a uma variável e o corpo a vinte, sem contar repetições', () => {
    expect(cloudTextTokens('{{1}} {{2}}', 'header').error).toBeTruthy()
    expect(cloudTextTokens('{{1}} e {{1}}').tokens).toEqual(['1'])
    expect(cloudTextTokens(Array.from({ length: 21 }, (_, i) => `{{${i + 1}}}`).join(' ')).error).toBeTruthy()
  })

  it('recusa marcador sem parâmetro e parâmetro que não existe no texto', () => {
    const input = reminder()
    input.components[1].parameters.pop()
    expect(validateCustomWhatsAppCloudTemplate(input)).toMatch(/corresponder/)
    input.components[1].text = 'Texto fixo'
    expect(validateCustomWhatsAppCloudTemplate(input)).toMatch(/corresponder/)
  })

  it('remove o seletor de perfil e usa o editor de texto em cabeçalho e corpo', () => {
    const source = readFileSync(new URL('../src/pages/TemplatesPage.vue', import.meta.url), 'utf8')
    expect(source).not.toContain('label="Perfil do template"')
    expect(source).toContain('label="Categoria oficial na Meta"')
    expect(source).toContain('<CloudTextTemplateFields :component="cloudStandardHeader"')
    expect(source).toContain('<CloudTextTemplateFields :component="cloudStandardBody"')
  })
})
