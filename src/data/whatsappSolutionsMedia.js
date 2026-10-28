// Public, anonymized captures only. Never point these slots to raw customer screenshots.
export const solutionsMedia = Object.freeze({
  overview: '/whatsapp-solutions/central-canais.webp',
  review: '/whatsapp-solutions/revisao-envio.webp',
  delivery: '/whatsapp-solutions/status-entregas.webp',
  mobile: '/whatsapp-solutions/canais-mobile.webp',
  assistant: '/whatsapp-solutions/assistente-mobile.webp',
  web: '/whatsapp-solutions/atendimento-web.webp',
  cloud: '/whatsapp-solutions/whatsapp-oficial.webp',
  templates: '/whatsapp-solutions/templates-canais.webp',
})

export const solutionDemos = Object.freeze([
  { key: 'cloud', tab: 'Cloud API', media: 'cloudDashboard', image: solutionsMedia.cloud, title: 'API oficial, com o contexto de cada conversa.', copy: 'Acompanhe a janela de atendimento, as permissões do contato e os templates da Cloud API. Atenda no canal oficial e use modelos aprovados quando for preciso iniciar uma nova conversa.' },
  { key: 'review', tab: 'Revisão do envio', media: 'sendReview', image: solutionsMedia.review, title: 'Confira cada canal antes de enviar.', copy: 'Revise a mensagem, o modelo e os destinos de WhatsApp, Telegram e e-mail antes de colocar na fila. A configuração e o consentimento são verificados por canal; uma falha não interrompe as demais entregas.' },
  { key: 'delivery', tab: 'Entregas', media: 'deliveryStatus', image: solutionsMedia.delivery, title: 'Saiba o que aconteceu com cada envio.', copy: 'Veja o resultado por contato e canal, tentativas e horário da última atualização. Filtre mensagens em fila, enviadas, entregues ou com falha e encontre o detalhe que ajuda sua equipe a agir.' },
  { key: 'templates', tab: 'Templates', media: 'templates', image: solutionsMedia.templates, title: 'Uma campanha. Conteúdo certo para cada canal.', copy: 'Organize conjuntos de templates para WhatsApp Cloud, WhatsApp Web, Telegram e Gmail. Use variáveis, favoritos e modelos oficiais da Meta para preparar campanhas consistentes sem refazer tudo do zero.' },
  { key: 'bot', tab: 'Atendimento', media: 'botChats', image: solutionsMedia.web, title: 'Atenda, automatize e resolva no mesmo painel.', copy: 'Triagem, conversa, bot, IA e equipe compartilham o histórico. Tenha catálogo e pedidos, arquivos, contatos, integrações e monitoramento à mão, com identificação de quem assume o atendimento.' },
])
