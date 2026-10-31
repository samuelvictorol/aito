// Public, deterministic demo. No contact, payment, AI or messaging API is called.
export const simulatorFlows = Object.freeze([
  { id: 'dentist', label: 'Dentista', icon: 'mdi-tooth-outline', business: 'Clínica Sorriso', subtitle: 'Recepção virtual · demonstração', nodes: {
    start: { text: 'Olá! 👋 Sou a assistente da Clínica Sorriso. Vamos cuidar do seu sorriso? Escolha como posso ajudar.', options: [['Agendar consulta', 'appointment'], ['Ver tratamentos', 'treatments'], ['Falar com a equipe', 'human']] },
    appointment: { text: 'Claro! Qual período funciona melhor para você? Os horários abaixo são fictícios.', options: [['Manhã · 9h', 'confirm'], ['Tarde · 15h', 'confirm']] },
    confirm: { text: '🦷 Perfeito! Seu horário de demonstração foi reservado. Na sua operação, o fluxo pode enviar lembretes e encaminhar o atendimento à recepção.', end: true },
    treatments: { text: 'Temos avaliação, limpeza e clareamento. O bot apresenta suas opções, tira dúvidas e organiza o próximo passo.', options: [['Quero uma avaliação', 'appointment'], ['Falar com a equipe', 'human']] },
    human: { text: 'Sua conversa entrou na triagem da recepção. Um colaborador pode assumir com login próprio, assinatura e todo o histórico à vista.', end: true },
  } },
  { id: 'payment', label: 'Compra e pagamento', icon: 'mdi-credit-card-check-outline', business: 'Ateliê Aurora', subtitle: 'Pedido e pagamento · simulação', nodes: {
    start: { text: 'Olá! ✨ Bem-vindo ao Ateliê Aurora. Nosso kit presente está disponível por R$ 89,90. Quer conhecer ou simular uma compra?', options: [['Conhecer o kit', 'details'], ['Simular compra', 'checkout']] },
    details: { text: '🎁 O kit vem com uma caneca e um cartão personalizado. Neste exemplo, o bot apresenta o produto e conduz o pedido.', options: [['Quero esse kit', 'checkout'], ['Tirar uma dúvida', 'human']] },
    checkout: { text: '🛍️ Pedido fictício #1042 criado! Uma integração de pagamento pode gerar o checkout. Aqui não há cobrança nem checkout real.', payment: true, options: [['Simular pagamento aprovado', 'paid'], ['Simular pagamento recusado', 'declined']] },
    paid: { text: '✅ Pagamento de demonstração confirmado! Seu pedido foi encaminhado à equipe. Como foi essa experiência de compra?', options: [['Adorei! ⭐⭐⭐⭐⭐', 'feedback'], ['Quero falar com alguém', 'human']] },
    declined: { text: 'O pagamento de demonstração foi recusado. O fluxo pode oferecer uma nova tentativa ou chamar a equipe.', options: [['Tentar novamente', 'checkout'], ['Falar com a equipe', 'human']] },
    feedback: { text: '💚 Obrigado pelo feedback! Compra, confirmação e pós-venda podem fazer parte do mesmo fluxo. Nenhum pedido ou pagamento foi realizado.', end: true },
    human: { text: 'Tudo certo! A equipe recebe o contexto da compra e continua o atendimento pelo painel.', end: true },
  } },
  { id: 'catalog', label: 'Catálogo', icon: 'mdi-store-outline', business: 'Casa Botânica', subtitle: 'Catálogo virtual · demonstração', nodes: {
    start: { text: 'Olá! 🌿 Bem-vindo à Casa Botânica. Que tal encontrar um pouco de verde para o seu espaço? Escolha uma categoria do nosso catálogo fictício.', options: [['Plantas de interior', 'plants'], ['Vasos e acessórios', 'pots']] },
    plants: { text: 'Estas plantas gostam de luz indireta. Escolha uma para ver o próximo passo.', products: [{ emoji: '🌱', name: 'Jiboia', price: 'R$ 39,90' }, { emoji: '🪴', name: 'Zamioculca', price: 'R$ 69,90' }], options: [['Quero a Jiboia', 'order'], ['Quero a Zamioculca', 'order'], ['Ver vasos', 'pots']] },
    pots: { text: 'Um vaso novo muda o ambiente! Veja um exemplo de catálogo que pode ser organizado na sua operação.', products: [{ emoji: '🏺', name: 'Vaso Terracota', price: 'R$ 29,90' }, { emoji: '🧺', name: 'Cachepô Natural', price: 'R$ 49,90' }], options: [['Escolher um vaso', 'order'], ['Ver plantas', 'plants']] },
    order: { text: '🛒 Boa escolha! No seu fluxo, a seleção pode virar um pedido e seguir para pagamento ou atendimento humano. Aqui é só uma demonstração.', options: [['Simular pedido', 'finish'], ['Voltar ao catálogo', 'start']] },
    finish: { text: '🌿 Pedido fictício preparado! A equipe pode conferir os itens e continuar com você no mesmo histórico.', end: true },
  } },
])

export function getSimulatorFlow(id) { return simulatorFlows.find(flow => flow.id === id) || simulatorFlows[0] }
export function simulatorReply(flowId, nodeId, input) {
  const flow = getSimulatorFlow(flowId)
  const node = flow.nodes[nodeId] || flow.nodes.start
  const text = String(input || '').trim().toLocaleLowerCase('pt-BR')
  if (['menu', 'início', 'inicio', 'recomeçar'].includes(text)) return { nodeId: 'start', node: flow.nodes.start }
  const index = /^\d+$/.test(text) ? Number(text) - 1 : -1
  const option = node.options?.find(([label]) => label.toLocaleLowerCase('pt-BR') === text) || node.options?.[index]
  const next = option?.[1]
  return next ? { nodeId: next, node: flow.nodes[next] } : { nodeId, node: { ...node, text: 'Nesta demonstração, use uma das opções abaixo ou digite o número dela. Digite “menu” para recomeçar. Não informe dados pessoais.' } }
}
