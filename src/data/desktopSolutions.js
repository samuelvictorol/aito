export const desktopSolutions = {
  intro: 'No Windows, seu time atende pelo WhatsApp, automatiza conversas e envia avisos pelo WhatsApp oficial, e-mail e Telegram.',
  notifications: {
    title: 'Envie seus avisos de um só lugar.',
    summary: 'AitoNotify reúne campanhas, confirmações e lembretes na API oficial do WhatsApp, no Gmail e no Telegram.',
    features: [
      { icon: 'mdi-whatsapp', title: 'Disparos pelo WhatsApp oficial', text: 'Use a API oficial da Meta para enviar avisos em escala com modelos aprovados e destinatários que autorizaram o contato.' },
      { icon: 'mdi-email-multiple-outline', title: 'E-mail e Telegram no mesmo envio', text: 'Use um texto próprio para cada canal. Envie e-mails pelo Gmail e avisos pelo bot do Telegram.' },
      { icon: 'mdi-calendar-clock', title: 'Programação e recorrência', text: 'Marque o horário do próximo envio ou configure lembretes que se repetem.' },
      { icon: 'mdi-account-check-outline', title: 'Público e consentimento', text: 'Organize contatos em grupos, convide novos destinatários e acompanhe as permissões.' },
      { icon: 'mdi-file-document-outline', title: 'Modelos que poupam retrabalho', text: 'Reaproveite mensagens com campos para nome, data ou pedido e confira a prévia de cada canal.' },
      { icon: 'mdi-chart-timeline-variant', title: 'Status de entrega por contato', text: 'Veja o que saiu, o que ainda está na fila e onde ocorreu uma falha.' },
    ],
  },
  bot: {
    title: 'Tire as perguntas repetidas da fila.',
    summary: 'O WhatsApp BotBuilder conduz a conversa até o pedido, o agendamento ou a hora de chamar alguém da equipe.',
    features: [
      { icon: 'mdi-sitemap-outline', title: 'Fluxograma que vira bot', text: 'Ligue mensagens, escolhas e ações no editor visual. Importe fluxos e teste cada caminho no simulador antes de ativar.' },
      { icon: 'mdi-robot-outline', title: 'IA no atendimento', text: 'Conecte sua chave de IA para o bot responder com contexto e encaminhar a conversa quando precisar de uma pessoa.' },
      { icon: 'mdi-storefront-outline', title: 'Catálogo, pedidos e pagamentos', text: 'Mostre produtos, organize pedidos e gere links de pagamento com a integração configurada.' },
      { icon: 'mdi-account-multiple-outline', title: 'Um QR Code para toda a equipe', text: 'Conecte uma sessão do WhatsApp Web no computador. Cada colaborador entra no painel com seu login e continua a conversa pelo histórico.' },
      { icon: 'mdi-message-reply-text-outline', title: 'Triagem, arquivos e atendimento humano', text: 'Organize conversas, compartilhe anexos e defina quem assume o atendimento.' },
      { icon: 'mdi-palette-outline', title: 'Painel com sua marca', text: 'Personalize a identidade do painel e ajuste os acessos às ferramentas por colaborador.' },
    ],
  },
  agent: {
    title: 'Peça o trabalho. A IA prepara a ação.',
    summary: 'O agente Aito I.A. conhece as ferramentas do Desktop. Descreva o objetivo, confira o que ele preparou e autorize a execução.',
    features: [
      { icon: 'mdi-bullhorn-outline', title: 'Agente de campanhas', text: 'Transforme uma ideia em mensagens e modelos por canal. Revise o público e o conteúdo antes de programar.' },
      { icon: 'mdi-sitemap-outline', title: 'Agente de chatbot', text: 'Descreva como a conversa deve funcionar. A IA prepara os cards e as conexões para você testar no simulador.' },
      { icon: 'mdi-magnify', title: 'Agente administrativo', text: 'Consulte a operação, entenda falhas de envio e veja quais configurações precisam de atenção.' },
      { icon: 'mdi-shield-check-outline', title: 'Ações com revisão', text: 'As ações seguem as permissões da conta. A IA mostra o que será alterado para você aprovar.' },
    ],
  },
}

export const desktopSolutionsFaq = [
  { question: 'Qual é a diferença entre WhatsApp oficial e WhatsApp Web?', answer: 'A API oficial da Meta é usada para notificações, modelos aprovados e conversas no canal oficial. A conexão por QR Code do BotBuilder usa o WhatsApp Web, em uma modalidade não oficial voltada à conversa, aos bots e ao atendimento em equipe.' },
  { question: 'Quanto custa e o que o plano Desktop inclui?', answer: 'Os valores dos planos de 1, 6 e 12 meses aparecem nesta página. Cada plano inclui AitoNotify, BotBuilder, acesso em equipe e Aito I.A. no instalador Windows. Tarifas da Meta, créditos de IA e serviços externos podem ser cobrados separadamente por cada provedor.' },
  { question: 'Como funcionam os 7 dias grátis?', answer: 'Crie e confirme sua primeira conta e abra Meus produtos para resgatar o teste. Os 7 dias começam no resgate. A oferta é única para novos clientes elegíveis sem licença ativa, com acesso aos módulos do Desktop e sem cartão.' },
  { question: 'Posso renovar antes de vencer?', answer: 'Sim. Com a licença ativa, o prazo comprado é somado à data de vencimento. Se já venceu, o novo prazo começa quando o pagamento é confirmado.' },
  { question: 'Como controlo os envios em massa?', answer: 'Selecione contatos autorizados, revise os modelos e acompanhe o resultado por canal. A API oficial está sujeita às políticas, à qualidade e aos limites da conta Meta.' },
  { question: 'Minha equipe consegue atender fora do escritório?', answer: 'Sim. O aplicativo fica aberto no computador Windows e sua equipe usa o painel pelo navegador, com logins individuais e acesso remoto HTTPS configurado.' },
]

const canonical = 'https://aitosoftwares.com/whatsapp-solucoes'
const title = 'WhatsApp para empresas, chatbot com IA e disparos oficiais | AitoSoftwares Desktop'
const description = 'Atenda em equipe, crie chatbots e envie avisos pelo WhatsApp oficial, Gmail e Telegram em um aplicativo Windows. Experimente o kit Desktop por 7 dias.'
const image = 'https://aitosoftwares.com/whatsapp-solutions/product-kit.webp'

export function desktopSolutionsSeo(offer) {
  const plans = (offer?.desktopPlans || []).filter(plan => offer.available && plan.enabled && Number.isSafeInteger(plan.priceCents) && plan.priceCents > 0)
  const application = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    name: 'AitoNotify + WhatsApp BotBuilder Desktop', url: canonical, image, description,
    operatingSystem: 'Windows 10 e Windows 11 (x64)', applicationCategory: 'BusinessApplication',
    publisher: { '@type': 'Organization', name: 'AitoSoftwares', url: 'https://aitosoftwares.com/' },
    featureList: ['WhatsApp Cloud API oficial da Meta', 'WhatsApp Web com conexão por QR Code', 'Editor visual e simulador de chatbot', 'Notificações pelo Gmail e Telegram', 'Atendimento com logins individuais', 'Agentes de IA para campanhas, fluxos e diagnóstico'],
    ...(plans.length ? { offers: plans.map(plan => ({
      '@type': 'Offer', name: `Desktop · ${plan.label}`, url: `${canonical}#planos`,
      priceCurrency: 'BRL', price: (plan.priceCents / 100).toFixed(2), availability: 'https://schema.org/InStock',
    })) } : {}),
  }
  return {
    title,
    meta: {
      description: { name: 'description', content: description },
      robots: { name: 'robots', content: 'index,follow,max-image-preview:large' },
      ogTitle: { property: 'og:title', content: title },
      ogDescription: { property: 'og:description', content: description },
      ogUrl: { property: 'og:url', content: canonical },
      ogType: { property: 'og:type', content: 'website' },
      ogLocale: { property: 'og:locale', content: 'pt_BR' },
      ogImage: { property: 'og:image', content: image },
      twitterCard: { name: 'twitter:card', content: 'summary_large_image' },
    },
    link: { canonical: { rel: 'canonical', href: canonical } },
    script: { desktopApplication: { type: 'application/ld+json', innerHTML: JSON.stringify(application).replace(/</g, '\\u003c') } },
  }
}
