import { http, unwrap } from './http.js'
import { sealAssistantKey } from './assistant-key-envelope.js'

const ROOT = '/admin-assistant'
export const ASSISTANT_NAME = 'Aito I.A'
export function assistantCapabilities(value = {}, role = 'collaborator') {
  const sharedAccount = value.sharedAccount === true || role !== 'admin'
  return { sharedAccount, canConfigure: typeof value.canConfigure === 'boolean' ? value.canConfigure : !sharedAccount, canExecute: typeof value.canExecute === 'boolean' ? value.canExecute : !sharedAccount }
}
export const ASSISTANT_SHORTCUTS = Object.freeze([
  { id: 'email', icon: 'mail', label: 'Enviar e-mail', description: 'Texto ou HTML, destinatários e revisão', prompt: 'Quero preparar um e-mail. Pergunte o objetivo, se quero HTML ou texto, o conteúdo e os destinatários (contatos ou grupos). Resolva nomes ambíguos, mostre a prévia e peça minha confirmação antes de enviar.' },
  { id: 'flow', icon: 'account_tree', label: 'Criar fluxograma', description: 'Desenhar, testar e gerar o JSON do bot', prompt: 'Vamos criar um fluxo completo para o WhatsApp BotBuilder. Pergunte o objetivo, o público e as etapas. Use o formato de importação deste sistema, com IDs e conexões válidas, caminhos de retorno e atendimento humano. Gere um JSON para baixar e explique antes de pedir aprovação para aplicar.' },
  { id: 'meta', icon: 'dashboard_customize', label: 'Modelo da Meta', description: 'Converter um print ou sugerir o modelo', prompt: 'Quero cadastrar um modelo oficial da Meta a partir de um ou vários prints. Leia todos como partes do mesmo modelo, preserve nome, idioma exato, categoria, cabeçalho, corpo, rodapé, botões e variáveis independentes por seção. Separe as amostras dos valores que serão definidos em cada envio. Use a ferramenta de preparação de template, pergunte sobre campos cortados ou ilegíveis e mostre a prévia antes de pedir confirmação para cadastrar. Se eu pedir um clone, leia o template original, aplique somente os ajustes pedidos e crie outro registro sem alterar a origem; confirme dúvidas e sugira adaptações compatíveis.' },
  { id: 'site', icon: 'public', label: 'Criar site', description: 'Conteúdo completo em um link', prompt: 'Ajude-me a criar um site de notificação com título, seções e botões. Pergunte o conteúdo, se é público ou privado, contatos/grupos autorizados e se deve expirar. Proponha um slug e uma página responsiva e peça confirmação antes de publicar.' },
  { id: 'campaign', icon: 'campaign', label: 'Criar campanha', description: 'Público, canal, template e agendamento', prompt: 'Quero criar uma campanha de notificações. Pergunte o objetivo, canal, público, template, variáveis e quando enviar. Confira permissões e limitações do canal. Mostre o resumo exato e peça confirmação antes de cadastrar ou disparar.' },
  { id: 'channel', icon: 'settings_input_component', label: 'Configurar canal', description: 'Verificar o que falta na integração', prompt: 'Ajude-me a configurar um canal deste sistema. Pergunte qual canal, verifique os campos pendentes e indique a tela protegida para preenchê-los. Não solicite senhas, chaves nem tokens nesta conversa.' },
  { id: 'contacts', icon: 'people', label: 'Organizar contatos', description: 'Grupos, cadastro e permissões', prompt: 'Quero organizar contatos e grupos. Pergunte o que precisa mudar, encontre os registros e esclareça duplicidades. Mostre os contatos, grupos e permissões afetados antes de pedir confirmação para alterar.' },
  { id: 'backup', icon: 'storage', label: 'Backup e limpeza', description: 'Consultar armazenamento e revisar remoções', prompt: 'Ajude-me a revisar o armazenamento e os backups. Comece somente consultando os dados e explique as opções. Para qualquer remoção, mostre exatamente a coleção, período e impacto, e exija a frase de confirmação antes de executar.' },
  { id: 'diagnostics', icon: 'monitor_heart', label: 'Investigar falhas', description: 'Entender erros de disparo e do sistema', prompt: 'Quero investigar uma falha. Pergunte se ocorreu em um disparo ou em outra parte do sistema e em qual horário. Consulte os diagnósticos autorizados e explique as causas e os próximos passos.' },
  { id: 'flow-payment', icon: 'payments', label: 'Montar fluxo de compra', description: 'Catálogo, link de pagamento e confirmação', prompt: 'Ajude a montar um fluxo de compra com código de produto, link InfinitePay e confirmação após o pagamento. Verifique o que falta na integração e mostre onde configurar com segurança, sem pedir segredos no chat.' },
  { id: 'flow-improve', icon: 'insights', label: 'Revisar atendimento', description: 'Rever etapas, saídas e integrações', prompt: 'Revise o fluxo aberto e sugira melhorias para as etapas, condições, integrações e encaminhamento para a equipe. Mostre o que mudaria antes de aplicar.' },
])

export const ASSISTANT_CONFIG_EVENT = 'aito-assistant:configuration'
export const ASSISTANT_SESSION_API = Symbol('assistant-session-api')

export function createAssistantSessionApi(scope = '') {
  const params = scope ? { scope } : undefined
  const upload = (path, file) => {
    const data = new FormData()
    data.append('file', file)
    return http.post(ROOT + path, data, { params, timeout: 120000 }).then(unwrap)
  }
  return {
    state: () => http.get(ROOT + '/session', { params }).then(unwrap),
    message: input => http.post(ROOT + '/message', input, { params, timeout: 60000 }).then(unwrap),
    confirm: input => http.post(ROOT + '/confirm', input, { params, timeout: 60000 }).then(unwrap),
    reject: actionId => http.post(ROOT + '/cancel', { actionId }, { params }).then(unwrap),
    clear: () => http.delete(ROOT + '/session', { params }).then(unwrap),
    upload: file => upload('/attachments', file),
    transcribe: file => upload('/transcribe', file),
    download: async path => (await http.get(assistantFilePath(path), { params, responseType: 'blob', timeout: 120000 })).data,
  }
}

export const assistantApi = {
  ...createAssistantSessionApi(),
  config: (refreshModels = false) => http.get(ROOT + '/config', { params: refreshModels ? { refreshModels: true } : undefined }).then(unwrap),
  keySources: () => http.get(ROOT + '/key-sources').then(unwrap),
  async saveConfig(input) {
    const { apiKey, ...changes } = input
    if (typeof apiKey === 'string') {
      const { publicKey } = await http.get(ROOT + '/config/transport').then(unwrap)
      changes.keyEnvelope = await sealAssistantKey(apiKey, publicKey)
    } else if (apiKey === null) changes.apiKey = null
    const saved = unwrap(await http.put(ROOT + '/config', changes))
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ASSISTANT_CONFIG_EVENT, { detail: saved }))
    return saved
  },
}

export function assistantFilePath(value) {
  const path = String(value || '').replace(/^\/api(?=\/admin-assistant\/files\/)/, '')
  if (!/^\/admin-assistant\/files\/[A-Za-z0-9_-]{1,100}$/.test(path)) throw new Error('Link de arquivo indisponível.')
  return path
}

export function formatAssistantCost(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Não disponível'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(Number(value))
}

export function formatAssistantTokens(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0))
}

export function assistantConfigInput(config, manualPricing, hadCustomPricing = false) {
  const payload = { model: config.model, effort: config.effort, speed: config.speed, ...(config.temperature !== undefined ? {temperature: config.temperature} : {}) }
  if (config.keyMode === 'import') {
    if (!config.keySourceId) throw new Error('Selecione a chave OpenAI que deseja importar.')
    payload.keySourceId = config.keySourceId
  } else if (config.apiKey?.trim()) payload.apiKey = config.apiKey.trim()
  if (manualPricing.enabled) {
    if ([manualPricing.input, manualPricing.output, manualPricing.cached].some(value => String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error('Informe os três preços por milhão de tokens, com zero quando não houver cobrança.')
    payload.pricing = { inputPerMillion: Number(manualPricing.input), outputPerMillion: Number(manualPricing.output), cachedInputPerMillion: Number(manualPricing.cached) }
  } else if (hadCustomPricing) payload.pricing = null
  return payload
}

// Keep readable text independent of the selected brand color, including very light palettes.
export function assistantTheme(branding = {}) {
  const primary = /^#[0-9a-f]{6}$/i.test(branding.primaryColor || '') ? branding.primaryColor : '#35BCA4'
  const channels = primary.slice(1).match(/../g).map(value => parseInt(value, 16))
  const mix = (amount, target = 255) => '#' + channels.map(value => Math.round(value * amount + target * (1 - amount)).toString(16).padStart(2, '0')).join('')
  return { '--aito-brand': primary, '--aito-background': mix(.025), '--aito-panel': mix(.065), '--aito-code': mix(.045), '--aito-line': mix(.2), '--aito-accent': mix(.44, 0), '--aito-text': '#19352f', '--aito-muted': '#526760', '--aito-tint': mix(.1) }
}

export function actionConfirmationAllowed(action, { reviewed = false, phrase = '' } = {}) {
  if (!action || action.status && !['pending', 'awaiting_confirmation'].includes(action.status)) return false
  if (action.expiresAt && new Date(action.expiresAt).getTime() <= Date.now()) return false
  if (!reviewed) return false
  const required = action.confirmationText || action.confirmationPhrase
  return !action.destructive && !required || Boolean(required && phrase === required)
}

export function assistantSafeDetails(value, depth = 0) {
  if (depth > 12) return '[conteúdo aninhado]'
  if (Array.isArray(value)) return value.slice(0, 100).map(item => assistantSafeDetails(item, depth + 1))
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 30000) : value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token|password|secret|api.?key|authorization|credential/i.test(key) ? '•••••• (protegido)' : assistantSafeDetails(item, depth + 1)]))
}

export function assistantAttachmentError(file) {
  if (!file || !file.size) return 'O arquivo está vazio.'
  if (file.size > 20 * 1024 * 1024) return 'Use arquivos de até 20 MB.'
  if (!/\.(png|jpe?g|webp|gif|pdf|txt|md|csv|json|docx|xlsx|pptx|html|css)$/i.test(file.name || '')) return 'Use uma imagem, PDF, documento, planilha, TXT, Markdown, JSON, HTML ou CSS.'
  return ''
}

export function parseAssistantBlocks(text) {
  const source = String(text || ''), blocks = [], pattern = /```([\w-]*)\s*\n([\s\S]*?)```/g
  let end = 0, match
  while ((match = pattern.exec(source))) {
    if (match.index > end) blocks.push({ type: 'text', text: source.slice(end, match.index) })
    blocks.push({ type: 'code', language: match[1] || 'text', text: match[2] })
    end = pattern.lastIndex
  }
  if (end < source.length) blocks.push({ type: 'text', text: source.slice(end) })
  return blocks
}
