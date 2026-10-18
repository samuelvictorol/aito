// Keep this curated funnel aligned with api/src/services/siteAssistantFlow.js.
export const assistantMenu = Object.freeze([
  'Criação, migração ou integração de Sistemas',
  'Soluções para WhatsApp',
  'I.A e Automações',
  'Atendimento Humanizado',
])
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const products = ['WhatsApp BotBuilder', 'Notify Flow', 'Voltar ao início']
const botOptions = ['Comprar pelo site', 'Comprar pelo WhatsApp', 'Quero implantação pela AITO', 'Comparar as soluções para WhatsApp']
const notifyOptions = ['Contratar Notify Flow pelo WhatsApp', 'Como integrar o Notify Flow?', 'Comparar as soluções para WhatsApp']
const botLink = { label: 'Ver o WhatsApp BotBuilder e comprar', url: '/whatsappbotbuilder' }
const notifyLink = { label: 'Conhecer o Notify Flow', url: 'https://notify-flow.onrender.com/' }

function selectedProduct(history) {
  for (const entry of [...history].reverse()) {
    if (entry?.from !== 'user') continue
    const value = normalize(entry.text)
    if (value === 'voltar ao inicio' || value === 'solucoes para whatsapp' || value === normalize(assistantMenu[0]) || value === normalize(assistantMenu[2]) || /comparar as solucoes/.test(value)) return ''
    if (/notify\s*flow/.test(value)) return 'Notify Flow'
    if (/bot\s*builder/.test(value)) return 'WhatsApp BotBuilder'
  }
  return ''
}

export function assistantCommercialUrl(history = [], message = '', flow = '') {
  const entries = history.filter(entry => entry?.from === 'user' && typeof entry.text === 'string').map(entry => entry.text.slice(0, 1200))
  if (message && entries.at(-1) !== message) entries.push(message.slice(0, 1200))
  const product = selectedProduct([...history, { from: 'user', text: message }])
  const marker = flow || (product ? `${product} — avaliação comercial e implementação` : 'Atendimento AITO')
  const summary = entries.slice(-5).join('\n').slice(0, 1200)
  return `https://wa.me/5561982637865?text=${encodeURIComponent(`Olá! Vim pelo Assistente AITO.\nFluxo: ${marker}.${summary ? `\nMeu contexto:\n${summary}` : ''}`)}`
}

export function guidedAssistantReply(message, history = []) {
  const text = normalize(message)
  const product = selectedProduct(history)
  const reply = (ia_replies, link = null, suggestions = products, topic = 'whatsapp') => ({ ia_replies, link, suggestions, topic })
  const handoff = (flow, explanation) => reply([
    explanation,
    'O botão abre o WhatsApp da AITO com o produto, a modalidade escolhida e o resumo deste atendimento. Revise a mensagem e toque em enviar para continuar com uma pessoa da equipe.',
  ], { label: 'Continuar com a AITO no WhatsApp', url: assistantCommercialUrl(history, message, flow) }, ['Voltar ao início'], 'handoff')

  if (/^(voltar ao inicio|quero entender as solucoes|quero continuar tirando duvidas)$/.test(text)) return reply(['Posso ajudar a escolher o próximo passo para sua operação. Qual destas opções você procura?'], null, [...assistantMenu], 'menu')
  if (text === 'atendimento humanizado') return handoff('Atendimento humanizado', 'Você pode conversar diretamente com um atendente da AITO pelo WhatsApp.')
  if (text === normalize(assistantMenu[0])) return reply([
    'Criamos sistemas sob medida, evoluímos ou migramos sistemas existentes e conectamos ferramentas por APIs e webhooks. Começamos entendendo seu processo para definir as entregas por etapas.',
    'Você quer criar um sistema, migrar o que já usa ou integrar ferramentas?',
  ], null, ['Criar um sistema', 'Migrar meu sistema', 'Integrar meus sistemas', 'Atendimento Humanizado'], 'custom')
  if (text === normalize(assistantMenu[2])) return reply([
    'A AITO aplica IA e automações para responder dúvidas, organizar leads, consultar dados e executar tarefas entre sistemas. Avaliamos o processo, as fontes de informação e as integrações disponíveis.',
    'Qual rotina você quer melhorar primeiro?',
  ], null, ['IA no atendimento', 'Automatizar processos', 'Soluções para WhatsApp', 'Atendimento Humanizado'], 'ai')
  if (/^(solucoes para whatsapp|bot ou ia para whatsapp|comparar as solucoes para whatsapp)$/.test(text)) return reply([
    'Temos duas soluções para necessidades diferentes. O WhatsApp BotBuilder organiza o atendimento que chega: fluxos visuais, bot, IA e equipe humana, com adaptação e integração ao seu sistema.',
    'O Notify Flow é voltado a notificações e disparos em massa: WhatsApp pela API oficial da Meta, e-mail via Gmail e Telegram. Ele organiza contatos, templates, agendamentos e acompanhamento de envios.',
    'Qual solução você quer conhecer primeiro?',
  ])
  if (/^(whatsapp botbuilder|wppbotbuilder|botbuilder|quero conhecer o (?:whatsapp )?botbuilder)$/.test(text)) return reply([
    'O WhatsApp BotBuilder permite montar e simular fluxos de atendimento em um editor visual, combinar bot, IA e pessoas, consultar catálogo e conduzir pedidos. A conexão do WhatsApp é por QR Code; ele não é o disparador pela API oficial da Meta.',
    'Você recebe o código-fonte para adaptar marca, telas e regras, com guias para Claude Code e Codex. APIs e webhooks permitem integrar CRM, ERP, loja ou outros sistemas, conforme os recursos de cada um.',
    'Você pode comprar pelo site ou WhatsApp e receber a token key, o acesso à v1, as atualizações vinculadas à licença e os manuais de uso e instalação. Se preferir contratar a solução pronta, a AITO também oferece configuração, deploy, personalização e integração como serviço. Como prefere seguir?',
  ], botLink, botOptions, 'botbuilder')
  if (product === 'Notify Flow' && /^(comprar pelo site|comprar pelo whatsapp|quero implantacao pela aito)$/.test(text)) return handoff('Notify Flow — aquisição e implementação com atendente real', 'O Notify Flow é adquirido exclusivamente pelo WhatsApp da AITO, com atendente real e implementação. A equipe avalia os canais, integrações e volume para apresentar a proposta.')
  if (/^(comprar pelo site|como comprar o (?:whatsapp )?botbuilder|como recebo (?:o token|a token key))$/.test(text)) return reply([
    'Na landing do WhatsApp BotBuilder, entre ou crie sua conta e conclua a compra. Após a confirmação, o código e a token key ficam disponíveis em Meus produtos, junto às orientações de instalação e uso.',
    'A token key identifica sua licença para uma instalação, libera o acesso à v1 e permite receber as atualizações disponibilizadas para essa licença. Você instala no seu ambiente seguindo os manuais; hospedagem e consumo de IA são contratados à parte.',
    'Abra a página para conferir o valor e comprar. Se quiser que a AITO configure, publique e adapte tudo para sua operação, escolha a implantação pela equipe.',
  ], botLink, ['Comprar pelo WhatsApp', 'Quero implantação pela AITO', 'Voltar ao início'], 'botbuilder')
  if (text === 'comprar pelo whatsapp') return handoff('WhatsApp BotBuilder — compra do código e licença/token key', 'Vamos encaminhar sua compra do WhatsApp BotBuilder à equipe. Após a confirmação, você recebe código, token key para acesso à v1 e atualizações da licença, além dos manuais de usuário e instalação.')
  if (text === 'quero implantacao pela aito' || /^(quero contratar|contratar) (?:a )?(?:configuracao|deploy|implantacao)(?: do botbuilder)?$/.test(text)) return handoff('WhatsApp BotBuilder — serviço de configuração, deploy e integração', 'Você pode contratar a AITO para entregar a solução configurada, em vez de adquirir apenas o código e fazer tudo sozinho. A equipe avalia hospedagem, deploy, fluxos, personalização e integração ao seu sistema e combina o escopo e o investimento com você.')
  if (/^(notify\s*flow|quero conhecer o notify\s*flow)$/.test(text)) return reply([
    'O Notify Flow é focado em notificações e disparos em massa, com contatos e grupos, templates, agendamentos, filas e status dos envios. Os canais são WhatsApp pela API oficial da Meta, e-mail via Gmail e Telegram.',
    'A API oficial permite operar dentro das regras da Meta, com base autorizada e templates aprovados quando exigidos. Isso reduz os riscos de disparos não oficiais, mas não permite prometer ausência de bloqueios.',
    'A aquisição é feita exclusivamente pelo WhatsApp da AITO, com um atendente real e implementação acompanhada. A equipe avalia os canais, a conta Meta, as integrações e o volume antes de apresentar a proposta.',
  ], notifyLink, notifyOptions, 'campaigns')
  if (text === 'como integrar o notify flow?') return reply([
    'A AITO avalia as APIs do seu sistema para conectar contatos e acionar notificações por eventos, como atualização de pedido, cobrança ou agendamento. Também configura os canais, templates e testes de envio previstos no escopo.',
    'A contratação do Notify Flow e da implementação é feita pelo WhatsApp com um atendente real. Conte quais canais e sistemas você quer conectar para a equipe avaliar.',
  ], { label: 'Avaliar integração com um atendente', url: assistantCommercialUrl(history, message, 'Notify Flow — aquisição e implementação com integração') }, notifyOptions, 'campaigns')
  if (/^(contratar notify flow pelo whatsapp|quero contratar o notify flow)$/.test(text) || product === 'Notify Flow' && /^(comprar|adquirir|contratar|quero implantacao|como comprar)[?!.]?$/.test(text)) return handoff('Notify Flow — aquisição e implementação com atendente real', 'O Notify Flow é adquirido exclusivamente com a equipe AITO pelo WhatsApp, junto da implementação. Um atendente real avalia sua operação, os canais e o volume de notificações para preparar a proposta.')
  return null
}

export function waitForAssistantBubble(signal, text, index = 0) {
  const delay = index === 0 ? 450 : Math.min(1600, Math.max(850, text.length * 9))
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Resposta cancelada')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, delay)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}
