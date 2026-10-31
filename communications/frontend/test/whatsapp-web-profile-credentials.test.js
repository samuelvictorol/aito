import { readFileSync } from 'node:fs'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { canArea, canAction } from '../src/services/access.js'

const source = readFileSync(new URL('../src/modules/whatsapp-web/pages/IntegrationsPage.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
const create = new Function('ref', 'onMounted', 'api', 'messageOf', 'location', 'setTimeout', 'canArea', 'canAction', 'getStoredUser', `${script}\nreturn { load, editProfile, saveProfile, refreshModels, models, profile, credentialNames, profiles }`)

function fixture(savedProfiles = [], user = {role:'admin'}) {
  const api = {
    get: vi.fn(async path => ({ data: path === '/integrations/openai/profiles'
      ? { items: savedProfiles, models: ['gpt-5.5'], imageModels: ['gpt-image-2.5-sunburst'] }
      : path === '/settings/credentials'
        ? { items: [{ name: 'OPENAI_PROFILE_KEY', preview: 'private-preview', value: 'private-value' }, { name: 'OPENAI_API_KEY' }] }
        : { items: [] } })),
    put: vi.fn(async () => ({ data: {} })),
  }
  const controller = create(ref, () => {}, api, error => error.message, { origin: 'https://qa.invalid' }, () => {}, canArea, canAction, () => user)
  return { ...controller, api }
}

describe('credencial por perfil de IA do WhatsApp Web', () => {
  it('carrega somente nomes para o seletor, sem previews nem valores das credenciais', async () => {
    const controller = fixture()
    await controller.load()
    expect(controller.api.get).toHaveBeenCalledWith('/settings/credentials')
    expect(controller.credentialNames.value).toEqual(['OPENAI_API_KEY', 'OPENAI_PROFILE_KEY'])
    expect(JSON.stringify(controller.credentialNames.value)).not.toContain('private-')
    expect(source).toContain('Padrão (OPENAI_API_KEY)')
    expect(source).toContain('v-model="profile.credentialName"')
  })

  it('preserva a credencial ao editar e envia a referência junto ao contexto, sem enviar segredo', async () => {
    const saved = { key: 'curso', title: 'Assistente', credentialName: 'OPENAI_PROFILE_KEY', context: [{ type: 'text', text: 'Instruções' }, { type: 'asset', assetId: 'asset-123' }] }
    const controller = fixture([saved])
    await controller.load()
    controller.editProfile(controller.profiles.value[0])
    expect(controller.profile.value.credentialName).toBe('OPENAI_PROFILE_KEY')
    controller.profile.value.title = 'Assistente atualizado'
    await controller.saveProfile()
    const [path, payload] = controller.api.put.mock.calls[0]
    expect(path).toBe('/integrations/openai/profiles/curso')
    expect(payload).toMatchObject({ title: 'Assistente atualizado', credentialName: 'OPENAI_PROFILE_KEY', context: saved.context })
    expect(JSON.stringify(payload)).not.toContain('private-')
  })

  it('usa o padrão em perfis novos e antigos e permite voltar explicitamente para a chave global', async () => {
    const controller = fixture()
    controller.editProfile()
    expect(controller.profile.value.credentialName).toBe('')
    controller.editProfile({ key: 'legado', title: 'Perfil antigo' })
    expect(controller.profile.value.credentialName).toBe('')
    controller.editProfile({ key: 'legado', title: 'Perfil antigo', credentialName: 'OPENAI_PROFILE_KEY' })
    controller.profile.value.credentialName = ''
    await controller.saveProfile()
    expect(controller.api.put.mock.calls[0][1].credentialName).toBe('')
  })

  it('mantém uma referência importada ainda não cadastrada em vez de substituí-la pelo padrão', async () => {
    const controller = fixture()
    await controller.load()
    controller.editProfile({ key: 'importado', title: 'Importado', credentialName: 'OPENAI_MIGRATED_KEY' })
    await controller.saveProfile()
    expect(controller.api.put.mock.calls[0][1].credentialName).toBe('OPENAI_MIGRATED_KEY')
    expect(source).toContain('profile.credentialName && !credentialNames.includes(profile.credentialName)')
    expect(source).toContain('{{ profile.credentialName }} (não encontrada)')
  })
  it('preserva a leitura dos perfis sem acessar credenciais e impede salvar em somente visualização', async () => {
    const controller = fixture([], {role:'collaborator', permissions:{channels:['whatsapp_web'], web_integrations:'view'}})
    await controller.load()
    expect(controller.api.get).toHaveBeenCalledWith('/integrations/openai/profiles')
    expect(controller.api.get).not.toHaveBeenCalledWith('/settings/credentials')
    expect(controller.api.get).not.toHaveBeenCalledWith('/assets', expect.anything())
    controller.editProfile({key:'somente-leitura', title:'Perfil'})
    await controller.saveProfile()
    expect(controller.api.put).not.toHaveBeenCalled()
  })

})

it('preserva modelos salvos e atualiza opções usando a credencial do perfil', async () => {
  const controller=fixture([{key:'novo',title:'Novo',model:'gpt-6.2-mini',visionModel:'gpt-6.2-mini'}])
  await controller.load()
  expect(controller.models.value).toContain('gpt-6.2-mini')
  controller.editProfile({credentialName:'OPENAI_PROFILE_KEY'})
  controller.api.get.mockResolvedValueOnce({data:{models:[{id:'gpt-4.1'},{id:'gpt-6.3'}]}})
  await controller.refreshModels()
  expect(controller.api.get).toHaveBeenLastCalledWith('/integrations/openai/models',{params:{credentialName:'OPENAI_PROFILE_KEY'}})
  expect(controller.models.value).toEqual(expect.arrayContaining(['gpt-4.1','gpt-6.3','gpt-6.2-mini']))
})
