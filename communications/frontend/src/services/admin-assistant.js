import { http, unwrap } from './http.js'

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
  { id: 'channel', icon: 'settings_input_component', label: 'Configurar canal', description: 'Entender campos e salvar credenciais', prompt: 'Ajude-me a configurar um canal deste sistema. Pergunte qual canal e explique cada campo necessário. Vou informar as credenciais aqui; não repita segredos em respostas ou logs. Mostre quais campos mudarão e peça confirmação antes de salvar.' },
  { id: 'contacts', icon: 'people', label: 'Organizar contatos', description: 'Grupos, cadastro e permissões', prompt: 'Quero organizar contatos e grupos. Pergunte o que precisa mudar, encontre os registros e esclareça duplicidades. Mostre os contatos, grupos e permissões afetados antes de pedir confirmação para alterar.' },
  { id: 'backup', icon: 'storage', label: 'Backup e limpeza', description: 'Consultar armazenamento e revisar remoções', prompt: 'Ajude-me a revisar o armazenamento e os backups. Comece somente consultando os dados e explique as opções. Para qualquer remoção, mostre exatamente a coleção, período e impacto, e exija a frase de confirmação antes de executar.' },
])

export const assistantApi = {
  config: (refreshModels = false) => http.get(ROOT + '/config', { params: refreshModels ? { refreshModels: true } : undefined }).then(unwrap),
  keySources: () => http.get(ROOT + '/key-sources').then(unwrap),
  saveConfig: input => http.put(ROOT + '/config', input).then(unwrap),
  state: () => http.get(ROOT + '/session').then(unwrap),
  message: input => http.post(ROOT + '/message', input, { timeout: 60000 }).then(unwrap),
  confirm: input => http.post(ROOT + '/confirm', input, { timeout: 60000 }).then(unwrap),
  reject: actionId => http.post(ROOT + '/cancel', { actionId }).then(unwrap),
  clear: () => http.delete(ROOT + '/session').then(unwrap),
  upload: file => { const data = new FormData(); data.append('file', file); return http.post(ROOT + '/attachments', data, { timeout: 120000 }).then(unwrap) },
  transcribe: file => { const data = new FormData(); data.append('file', file); return http.post(ROOT + '/transcribe', data, { timeout: 120000 }).then(unwrap) },
  download: async path => (await http.get(assistantFilePath(path), { responseType: 'blob', timeout: 120000 })).data,
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
