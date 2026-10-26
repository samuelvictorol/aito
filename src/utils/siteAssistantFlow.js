export const assistantMenu = Object.freeze(['Criação, migração ou integração de Sistemas', 'Soluções para WhatsApp', 'I.A e Automações', 'Atendimento Humanizado']);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const plans = ['Comprar código-fonte', 'Usar mensal', 'Conhecer o BotBuilder', 'Conhecer a API oficial'];
const productLink = { label: 'Conhecer o AitoNotify + WhatsApp BotBuilder e os planos', url: '/whatsapp-solucoes' };
export function assistantCommercialUrl(history = [], message = '', flow = '') {
  const entries = history.filter(entry => entry?.from === 'user' && typeof entry.text === 'string').map(entry => entry.text.slice(0, 1200));
  if (message && entries.at(-1) !== message) entries.push(message.slice(0, 1200));
  const summary = entries.slice(-5).join('\n').slice(0, 1200);
  return 'https://wa.me/5561982637865?text=' + encodeURIComponent('Olá! Vim pelo Assistente AITO.\nFluxo: ' + (flow || 'Atendimento AitoNotify + WhatsApp BotBuilder') + '.' + (summary ? '\nMeu contexto:\n' + summary : ''));
}
export function guidedAssistantReply(message, history = []) {
  const text = normalize(message);
  const reply = (ia_replies, link = productLink, suggestions = plans, topic = 'aitonotify') => ({ ia_replies, link, suggestions, topic });
  if (/qr code|colaborad|atendent|equipe|multiacess/.test(text) && /acess|login|qr|compartilh|simultan|varios|varias|clon/.test(text)) return reply([
    'No kit AitoNotify + WhatsApp BotBuilder, conecte o WhatsApp Web uma vez por QR Code no servidor. A equipe acessa o painel em vários computadores ou celulares, com login individual, identificação do responsável e assinatura opcional nas respostas.',
    'Sua equipe pode assumir, transferir e finalizar conversas mantendo o histórico. Adicione colaboradores conforme a operação cresce e dimensione os acessos simultâneos de acordo com a infraestrutura e o plano da instalação.'
  ], productLink, plans, 'botbuilder');
  const handoff = flow => reply(['A equipe AITO avalia canais, implantação e integrações com você. O valor mensal anunciado e as condições atualizadas estão na página do AitoNotify + WhatsApp BotBuilder.', 'O botão abre o WhatsApp com o resumo desta conversa para você revisar e enviar.'], { label: 'Conversar com a AITO', url: assistantCommercialUrl(history, message, flow) }, ['Voltar ao início'], 'handoff');
  if (/^(voltar ao inicio|quero entender as solucoes|quero continuar tirando duvidas)$/.test(text)) return reply(['Qual destas opções ajuda mais sua empresa agora?'], null, [...assistantMenu], 'menu');
  if (text === 'atendimento humanizado') return handoff('Atendimento humanizado');
  if (text === normalize(assistantMenu[0])) return reply(['Criamos e evoluímos sistemas, migramos aplicações e conectamos ferramentas por APIs e webhooks. Começamos entendendo seu processo e definimos as entregas por etapas.', 'Você quer criar, migrar ou integrar um sistema?'], null, ['Criar um sistema', 'Migrar meu sistema', 'Integrar meus sistemas', 'Atendimento Humanizado'], 'custom');
  if (text === normalize(assistantMenu[2])) return reply(['A AITO aplica IA e automações para responder dúvidas, organizar leads e consultar dados. No AitoNotify + WhatsApp BotBuilder, o BotBuilder permite combinar fluxos, IA e equipe humana.', 'Qual rotina você quer melhorar?'], null, ['IA no atendimento', 'Automatizar processos', 'Soluções para WhatsApp', 'Atendimento Humanizado'], 'ai');
  if (/^(solucoes para whatsapp|bot ou ia para whatsapp|comparar as solucoes para whatsapp|aitonotify|notify ?flow|quero conhecer o notify ?flow|quero combinar atendimento e campanhas)$/.test(text)) return reply(['O kit AitoNotify + WhatsApp BotBuilder reúne API oficial da Meta para campanhas e notificações, e WhatsApp Web com BotBuilder para fluxos, IA e atendimento humano. As conexões e os números são gerenciados separadamente, compartilhando os contatos.', 'O pacote inclui contatos, grupos, templates, agendamentos e personalização da marca. Você pode comprar o código-fonte com licença para uma instalação ou conversar sobre o plano mensal.']);
  if (/^(whatsapp botbuilder|wppbotbuilder|botbuilder|quero conhecer o (?:whatsapp )?botbuilder|conhecer o botbuilder)$/.test(text)) return reply(['No kit AitoNotify + WhatsApp BotBuilder, desenhe mensagens, decisões e ações no editor visual, simule os caminhos e combine IA com atendimento humano. A conexão WhatsApp Web é por QR Code e é separada da Cloud API oficial.', 'O código-fonte do pacote permite personalizar a marca e integrar seu sistema. Também oferecemos implantação e operação mensal.'], productLink, plans, 'botbuilder');
  if (/^(conhecer a api oficial|como funciona o notify flow\?|quero fazer disparos em massa)$/.test(text)) return reply(['A Cloud API do AitoNotify + WhatsApp BotBuilder organiza campanhas, notificações, contatos, templates, agendamentos e acompanhamento dos envios. O mesmo pacote traz o BotBuilder para o atendimento.', 'A integração usa a infraestrutura e a documentação oficiais da Meta para uma operação mais segura. Templates aprovados, contatos autorizados, conteúdo adequado e respeito aos limites da conta ajudam a reduzir riscos e manter a qualidade dos envios.'], productLink, plans, 'campaigns');
  if (/^(comprar pelo site|comprar codigo.fonte|como comprar o (?:whatsapp )?botbuilder|como recebo (?:o token|a token key))$/.test(text)) return reply(['Na página do AitoNotify + WhatsApp BotBuilder, confira o preço atualizado, entre ou crie sua conta e conclua o checkout. Após a confirmação do pagamento, código-fonte e token de licença ficam em Meus produtos.', 'A licença atende uma instalação. Hospedagem, consumo de IA e cobranças da Meta dependem da configuração e das condições contratadas.']);
  if (/^(usar mensal|contratar notify flow pelo whatsapp|quero contratar o notify flow|comprar pelo whatsapp|quero implantacao pela aito)$/.test(text)) return handoff('AitoNotify + WhatsApp BotBuilder — plano mensal e implantação');
  if (/^como integrar o (?:notify flow|aitonotify)\?$/.test(text)) return reply(['Podemos conectar seu sistema ao AitoNotify + WhatsApp BotBuilder por APIs e webhooks: contatos, notificações por eventos e autenticação por e-mail para aplicações autorizadas. As interfaces e permissões são avaliadas conforme o projeto.', 'Que sistema você quer integrar?']);
  return null;
}

export function waitForAssistantBubble(signal, text, index = 0) {
  const delay = index === 0 ? 1500 : Math.min(4500, Math.max(2200, text.length * 15))
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Resposta cancelada')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, delay)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}
