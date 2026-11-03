// Curated public showroom. All routes stay inside the isolated prototype.
export const TOUR_STORAGE_KEY = 'aito.communication.prototype.showroom.v2'
export const SOURCE_SOLUTIONS_URL = 'https://aitosoftwares.com/whatsapp-solucoes-whitelabel'
export const TOUR_HELP_URL = 'https://wa.me/5561982637865?text=' + encodeURIComponent('Olá! Conheci a demonstração do AitoNotify + WhatsApp BotBuilder e quero ajuda para escolher ou configurar a solução.')
export const SHOWROOM_STEPS = [
  {id:'welcome',key:'app-mobile',path:'/prototype/app-mobile',chapter:'Sua operação',title:'Quatro canais. Uma entrada para sua equipe.',icon:'devices',tone:'mint',target:'.mobile-channel-picker',description:'O kit reúne duas soluções diferentes de WhatsApp e também Gmail e Telegram. Vamos mostrar onde cada uma resolve melhor o seu dia a dia.',benefit:'Pense em uma operação: atendimento, automações e comunicação organizados no mesmo produto.',action:'Quero conhecer as soluções',activity:'Veja os quatro canais e depois siga a visita.'},
  {id:'official',key:'whatsapp-cloud',path:'/prototype/whatsapp-cloud',chapter:'Notificações oficiais',title:'Quer avisar muitos clientes? Comece pela API oficial.',icon:'cloud_done',tone:'blue',target:'.cloud-identity',description:'O WhatsApp Cloud usa a API oficial da Meta. É o caminho para notificações, confirmações e campanhas com modelos aprovados e contatos autorizados.',benefit:'Exemplo: confirmar um pedido ou lembrar um agendamento, acompanhando o status de cada entrega.',activity:'A configuração real exige sua conta Meta. Políticas, capacidade e qualidade do canal continuam valendo.'},
  {id:'templates',key:'templates',path:'/prototype/templates',chapter:'Do modelo à campanha',title:'Um conteúdo preparado para cada canal.',icon:'dashboard_customize',tone:'blue',target:'.template-sets-panel',description:'Organize modelos oficiais do WhatsApp, e-mails em HTML, mensagens do Telegram e páginas completas em um link. Variáveis personalizam a mensagem de cada contato.',benefit:'A Aito I.A pode ajudar a converter prints de um modelo oficial em um cadastro para revisão.',activity:'Pause para abrir um template e explorar a prévia. Os dados são fictícios e não serão salvos.'},
  {id:'campaign',key:'notifications',path:'/prototype/notifications',chapter:'Campanhas multicanal',title:'Escolha o público. Revise. Envie com clareza.',icon:'campaign',tone:'blue',target:'.composer-card',description:'Selecione contatos ou grupos, combine os canais disponíveis e confira as prévias antes de colocar uma campanha na fila. Também há programações futuras e recorrentes.',benefit:'WhatsApp oficial, Gmail e Telegram podem trabalhar juntos na mesma estratégia de comunicação.',activity:'Neste protótipo não há disparos reais. Disparos em massa pelo WhatsApp Web têm maior risco de restrições.'},
  {id:'flow',key:'whatsapp-web/flows',path:'/prototype/whatsapp-web/flows/demo-flow',chapter:'Chatbots e IA',title:'Agora veja o outro lado: o atendimento que responde.',icon:'account_tree',tone:'mint',target:'.flow-canvas',description:'O BotBuilder usa uma sessão WhatsApp Web conectada por QR Code. Monte mensagens, decisões, IA, pagamentos e passagem para uma pessoa em um fluxograma visual.',benefit:'Exemplo: entender a necessidade do cliente, apresentar opções e encaminhar somente o que precisa da equipe.',activity:'Pause para mover os cards, selecionar uma opção ou abrir “Simular bot”. Você pode testar o fluxo, mas não salvar nem conectar um QR real.'},
  {id:'inbox',key:'whatsapp-web',path:'/prototype/whatsapp-web',chapter:'Atendimento humano',title:'A conversa continua com a pessoa certa.',icon:'forum',tone:'mint',target:'.chat-list-panel',description:'Separe IA ativa, triagem e atendimentos assumidos. Cada colaborador usa seu próprio acesso e pode assinar as respostas, sem precisar compartilhar o login do administrador.',benefit:'Automatize o início e mantenha a equipe no controle quando o cliente precisa de atendimento humano.',activity:'Pause e abra a conversa fictícia da Ana para conhecer o chat, o histórico e as ações.'},
  {id:'ai',key:'whatsapp-web/integrations',path:'/prototype/whatsapp-web/integrations',chapter:'Seu agente e integrações',title:'IA com contexto e ações que você revisa.',icon:'auto_awesome',tone:'violet',target:'.integration-grid',description:'Configure perfis de IA para o fluxo. O Aito I.A também ajuda a preparar templates, sites, fluxogramas e campanhas, além de explicar campos e integrações.',benefit:'No produto real, você usa sua própria chave e créditos de IA. Ações seguem as permissões e etapas de revisão do sistema.',activity:'O robô flutuante oferece exemplos de como o agente funciona, sem usar uma chave nem consumir créditos nesta demonstração.'},
  {id:'telegram',key:'telegram',path:'/prototype/telegram',chapter:'Além do WhatsApp',title:'Telegram também faz parte da operação.',icon:'telegram',tone:'blue',target:'.bot-identity',description:'Conecte seu bot do Telegram, organize conversas e envie avisos para contatos ou grupos autorizados. A equipe mantém os canais próximos, no mesmo painel.',benefit:'Use o canal que seu público já acompanha, sem concentrar toda a comunicação no WhatsApp.',activity:'Pause para explorar as abas do Telegram com as conversas e mensagens de exemplo.'},
  {id:'email',key:'email',path:'/prototype/email',chapter:'Além do WhatsApp',title:'E-mails completos, com sua identidade.',icon:'mail',tone:'rose',target:'.email-layout',description:'Crie mensagens em HTML ou texto, escolha contatos e grupos e consulte o histórico de envios. Gmail complementa notificações e conteúdos que precisam de mais espaço.',benefit:'Boas-vindas, instruções e campanhas podem combinar e-mail, Telegram e WhatsApp oficial.',activity:'No produto real, configure o remetente e a autenticação de e-mail antes de enviar.'},
  {id:'team',key:'collaborators',path:'/prototype/collaborators',chapter:'Equipe e segurança',title:'Cresça com acessos organizados.',icon:'support_agent',tone:'violet',target:'.collaborator-accounts, .global-collaborators-page',description:'Defina canais, menus e ações de cada colaborador. O administrador mantém a governança, enquanto cada pessoa recebe somente as áreas liberadas para seu trabalho.',benefit:'Multifator por e-mail, assinaturas, permissões e configurações ajudam a proteger a operação.',activity:'Os perfis Administrador, Colaborador e Contato também podem ser explorados pelo menu de perfil da demonstração.'},
  {id:'mobile',key:'app-mobile',path:'/prototype/app-mobile',chapter:'Pronto para seu dia a dia',title:'Leve o atendimento para o celular.',icon:'add_to_home_screen',tone:'mint',target:'.mobile-channel-picker',description:'Use o App de atendimento como atalho no iPhone ou Android. No produto real, instale o webapp e autorize os alertas para receber novas mensagens.',benefit:'Você acabou de conhecer chatbots, API oficial, Telegram, Gmail e equipe no mesmo kit.',activity:'No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. A demonstração não envia alertas nem conecta contas reais.',action:'Ver como começar'},
]
export function tourIndexForPath(path, currentIndex=0) {
  const clean=String(path||'').split(/[?#]/)[0].replace(/\/$/,'')
  if(SHOWROOM_STEPS[currentIndex]?.path===clean)return currentIndex
  return SHOWROOM_STEPS.findIndex(step=>step.path===clean)
}
export function restoreTour(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))return {index:0,started:false,completed:false}
  const index=SHOWROOM_STEPS.findIndex(step=>step.id===value.step)
  return {index:index<0?0:index,started:value.started===true,completed:value.completed===true}
}
export function storeTour(state) {
  return {step:SHOWROOM_STEPS[Math.min(SHOWROOM_STEPS.length-1,Math.max(0,Number(state.index)||0))].id,started:state.started===true,completed:state.completed===true}
}
// Rectangle clamps are shared by positioning and tests. Missing/offscreen anchors
// use a central card rather than leaving the page trapped behind an empty cutout.
export function spotlightRect(value, viewport, padding=8) {
  if(!value || ![value.top,value.left,value.width,value.height,viewport.width,viewport.height].every(Number.isFinite))return null
  const top=Math.max(8,value.top-padding),left=Math.max(8,value.left-padding)
  const right=Math.min(viewport.width-8,value.left+value.width+padding),bottom=Math.min(viewport.height-8,value.top+value.height+padding)
  if(right-left<32||bottom-top<24)return null
  return {top,left,width:right-left,height:bottom-top,right,bottom}
}
export function spotlightCardPosition(rect,viewport,cardHeight=400) {
  const margin=12,width=Math.min(430,viewport.width-margin*2),height=Math.min(cardHeight,viewport.height-margin*2)
  const left=rect?Math.max(margin,Math.min(rect.left,viewport.width-width-margin)):Math.max(margin,(viewport.width-width)/2)
  if(viewport.width<700)return {left:margin,right:margin,bottom:margin,maxHeight:Math.max(180,viewport.height-margin*2),width:'auto'}
  if(!rect)return {left,top:Math.max(margin,(viewport.height-height)/2),width,maxHeight:viewport.height-margin*2}
  const below=viewport.height-rect.bottom-margin,above=rect.top-margin
  if(below>=height)return {left,top:rect.bottom+margin,width,maxHeight:below-margin}
  if(above>=height)return {left,top:rect.top-height-margin,width,maxHeight:above-margin}
  const side=viewport.width-rect.right-margin
  if(side>=width)return {left:rect.right+margin,top:Math.max(margin,Math.min(rect.top,viewport.height-height-margin)),width,maxHeight:viewport.height-margin*2}
  return {left:viewport.width-width-margin,top:margin,width,maxHeight:viewport.height-margin*2}
}
