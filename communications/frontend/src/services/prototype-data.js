// Public, deliberately fictional fixtures. This module never imports a client or an account store.
export const SOLUTIONS_URL = 'https://aitosoftwares.com/whatsapp-solucoes'
export const DEMO_SECTIONS = [
  ['settings','Configurações','settings','Início',1,'Conecte os canais, personalize remetentes e defina a autorização automática.'],
  ['sistema','Sistema','dns','Início',3,'Configuração protegida dos canais, infraestrutura e importação de parâmetros.'],
  ['templates','Templates e sites','dashboard_customize','Início',1,'Modelos por canal, variáveis dinâmicas e páginas completas em um link.'],
  ['notifications','Notificações','send','Início',1,'Públicos, prévias e acompanhamento das entregas de cada campanha.'],
  ['schedules','Programações','schedule_send','Início',1,'Avisos futuros e recorrentes com a mesma organização dos envios imediatos.'],
  ['invites','Convites','link','Início',1,'Links para entrada de contatos e autorização de canais.'],
  ['app-mobile','App de atendimento','smartphone','Pessoas',3,'Quatro canais, uma entrada rápida no computador ou no celular.'],
  ['collaborators','Colaboradores','support_agent','Pessoas',3,'Logins individuais, assinaturas e permissões por área e ação.'],
  ['contacts','Contatos','group','Pessoas',1,'Cadastro compartilhado, grupos e preferências de recebimento.'],
  ['contacts/groups','Grupos','groups','Pessoas',1,'Segmente os públicos e reutilize grupos nas campanhas.'],
  ['whatsapp-cloud','WhatsApp Cloud','cloud','Canais',1,'API oficial da Meta: templates, mensagens e status de entrega.'],
  ['telegram','Telegram','send','Canais',1,'Bot, conversas e grupos no mesmo painel de atendimento.'],
  ['email','Gmail','mail','Canais',1,'Conteúdo em HTML, remetente e histórico de notificações por e-mail.'],
  ['whatsapp-web','Conversas Web','forum','WhatsApp Web',2,'IA ativa, triagem e atendimento por colaborador.'],
  ['whatsapp-web/connection','Conexão e QR Code','qr_code_2','WhatsApp Web',2,'Entenda a conexão persistente e as opções de importação. Nenhuma sessão pode ser conectada nesta demonstração.'],
  ['whatsapp-web/flows','Fluxos e simulador','account_tree','WhatsApp Web',2,'Mensagens, decisões, ações e transferência para a equipe em um fluxograma.'],
  ['whatsapp-web/native-flows','Comandos nativos','terminal','WhatsApp Web',2,'Veja o que fazem os comandos de acesso, ajuda e preferências.'],
  ['whatsapp-web/contacts','Contatos Web','contacts','WhatsApp Web',2,'Nomes, números e grupos associados ao atendimento Web.'],
  ['whatsapp-web/catalog','Catálogo e pedidos','storefront','WhatsApp Web',2,'Produtos, propostas e acompanhamento de pedidos junto da conversa.'],
  ['whatsapp-web/files','Biblioteca','perm_media','WhatsApp Web',2,'Arquivos de mídia e referências para fluxos e perfis de IA.'],
  ['whatsapp-web/integrations','Integrações e IA','hub','WhatsApp Web',2,'Perfis OpenAI, contexto, documentos e integrações de pagamento.'],
  ['whatsapp-web/logs','Monitoramento','monitor_heart','WhatsApp Web',2,'Eventos e uso das automações em uma linha do tempo.'],
  ['whatsapp-web/settings','Configurações Web','tune','WhatsApp Web',2,'Assinatura do bot, ritmo das mensagens e políticas do atendimento.'],
  ['help','Ajuda','help_center','Úteis',3,'Guias por menu, espaço para tutoriais e orientação do agente.'],
  ['administrators','Administradores','admin_panel_settings','Governança',3,'Acessos administrativos separados dos perfis de colaboradores.'],
  ['whitelabel','Whitelabel','palette','Governança',3,'Nome, logo, cores e identidade da sua operação.'],
  ['backup','Backup e armazenamento','backup','Governança',3,'Consulte coleções, retenção e confirmações para limpeza.'],
  ['integrations','Integrações externas','hub','Governança',3,'Apps, escopos e acesso controlado a templates.'],
  ['terms','Termos e LGPD','verified_user','Governança',3,'Documentos, versões, preferências e direitos dos titulares.'],
  ['logins','Logins dos contatos','login','Governança',3,'Acompanhe o uso de links de acesso aos perfis dos contatos.'],
  ['colaborador','Perfil do colaborador','badge','Perfis',3,'Um espaço de trabalho com as áreas liberadas para cada pessoa.'],
  ['meu-perfil','Perfil do contato','person','Perfis',3,'Histórico de notificações e preferências do próprio contato.'],
].map(([key,title,icon,group,stage,description])=>({key,title,icon,group,stage,description}))
export const DEMO_CONTACTS = [
  {id:'ana',name:'Ana Martins',email:'ana@example.com',phone:'(11) 90000-0001',group:'Clientes',status:'IA ativa',initials:'AM',last:'Quero conhecer as opções de atendimento.',time:'10:42'},
  {id:'bruno',name:'Bruno Lima',email:'bruno@example.com',phone:'(11) 90000-0002',group:'Pós-venda',status:'Triagem',initials:'BL',last:'Recebi a confirmação, obrigado!',time:'10:38'},
  {id:'carla',name:'Carla Souza',email:'carla@example.com',phone:'(11) 90000-0003',group:'Clientes',status:'Atendido por Júlia',initials:'CS',last:'Podemos conversar sobre meu pedido?',time:'10:31'},
  {id:'diego',name:'Diego Alves',email:'diego@example.com',phone:'(11) 90000-0004',group:'Treinamentos',status:'Concluído',initials:'DA',last:'Tudo certo para amanhã.',time:'09:54'},
]
export const DEMO_CHANNELS = [
  {key:'whatsapp-web',title:'WhatsApp Web',icon:'mdi-whatsapp',eyebrow:'APARELHO CONECTADO',description:'Conversas, IA e atendimento da equipe',color:'web'},
  {key:'whatsapp-cloud',title:'WhatsApp Cloud',icon:'cloud',eyebrow:'API OFICIAL DA META',description:'Mensagens oficiais, contatos e notificações',color:'cloud'},
  {key:'telegram',title:'Telegram',icon:'send',eyebrow:'BOT E ATENDIMENTO',description:'Conversas, grupos e notificações',color:'telegram'},
  {key:'email',title:'Gmail',icon:'mail',eyebrow:'ENVIO POR E-MAIL',description:'Mensagens, campanhas e histórico',color:'gmail'},
]
export const DEMO_COMMANDS = [
  {command:'/login',title:'Acesso ao próprio perfil',description:'Envia um link temporário para o contato consultar seu cadastro e histórico. Não é login administrativo.',steps:['Contato envia /login','Sistema identifica o contato','Link pessoal e temporário','Meu perfil e histórico']},
  {command:'/notify-me',title:'Autorizar notificações',description:'Registra a autorização para receber notificações no canal, conforme as configurações da operação.',steps:['Receber o comando','Identificar o canal','Registrar preferência','Confirmar autorização']},
  {command:'/stop',title:'Parar de receber',description:'Representa o comando de saída configurado na operação: revoga o recebimento naquele canal.',steps:['Solicitação de saída','Atualizar preferência','Bloquear novos disparos','Confirmar ao contato']},
  {command:'/help',title:'Ajuda e comandos',description:'Apresenta as opções de ajuda disponíveis. Comandos e aliases podem variar conforme a configuração.',steps:['Receber pedido','Consultar opções','Responder com ajuda']},
  {command:'menu',title:'Recomeçar o fluxo',description:'Retorna à entrada do fluxograma de atendimento quando essa palavra é configurada no fluxo.',steps:['Reconhecer a palavra','Sair do caminho atual','Exibir o menu inicial']},
  {command:'/desligar',title:'Limpar memória da IA',description:'Exemplo do comando de reinício configurável no perfil de IA. Reinicia o contexto daquela conversa.',steps:['Reconhecer o comando','Descartar contexto temporário','Iniciar uma nova interação']},
]
export const DEMO_TEMPLATES = [
  {id:'pedido',name:'Atualização de pedido',channel:'WhatsApp Cloud',official:'order_update_1',language:'pt_BR',category:'Utilidade',header:'Seu pedido está sendo preparado',body:'Olá {{1}},\n\nAcompanhe seu pedido {{2}} e revise as pendências se houver.',example:'Olá Ana,\n\nAcompanhe seu pedido nº 12345 e revise as pendências se houver.',footer:'Sua equipe de atendimento',variables:['Nome do contato','Número do pedido','Sufixo do link'],button:'Verificar pedido'},
  {id:'agenda',name:'Lembrete de agendamento',channel:'WhatsApp Cloud',official:'appointment_reminder',language:'pt_BR',category:'Utilidade',header:'Seu agendamento',body:'Olá {{1}}, seu atendimento será em {{2}}.',example:'Olá Bruno, seu atendimento será em 29/10 às 14h.',variables:['Nome','Data e horário']},
  {id:'email',name:'Boas-vindas por e-mail',channel:'Gmail',body:'Olá {{nome}},\n\nSeu cadastro foi concluído. Veja os próximos passos na sua área pessoal.',example:'Olá Ana,\n\nSeu cadastro foi concluído. Veja os próximos passos na sua área pessoal.',variables:['Nome'],button:'Ver orientações'},
  {id:'telegram',name:'Aviso para a comunidade',channel:'Telegram',body:'Olá {{nome}}! Nosso próximo encontro será em {{data}}.',example:'Olá Carla! Nosso próximo encontro será em 29/10.',variables:['Nome','Data']},
  {id:'site',name:'Orientações completas',channel:'Site',body:'Todas as informações em uma página\n\nCombine seções, documentos e botões. O link pode ser público ou restrito aos contatos e grupos autorizados.',example:'Orientações para seu atendimento\n\n1. Separe seus documentos.\n2. Confira o horário combinado.\n3. Use o canal indicado para falar com a equipe.',variables:[],button:'Consultar orientações'},
]
export const DEMO_EVENTS = [
  ['10:42','Mensagem recebida','WhatsApp Web','Conversa encaminhada ao fluxo de boas-vindas.'],
  ['10:41','Template entregue','WhatsApp Cloud','Exemplo de confirmação de entrega do provedor.'],
  ['10:39','Atendimento assumido','Colaboradores','Júlia iniciou o atendimento de Carla.'],
  ['10:35','Notificação enviada','Gmail','Orientações do atendimento entregues ao serviço de e-mail.'],
  ['10:30','Programação preparada','Sistema','Lembrete de amanhã aguardando o horário definido.'],
]
export function prototypeUrl(key='settings') { return '/prototype/'+key }
export function prototypeSection(path) { let key=String(path).split(/[?#]/)[0].replace(/^\/prototype\/?/,'').replace(/\/$/,'')||'settings';if(key==='app-mobile/web')key='whatsapp-web';if(key==='app-mobile/cloud')key='whatsapp-cloud';if(key.startsWith('whatsapp-web/flows/'))key='whatsapp-web/flows';if(key.startsWith('notificacao/'))key='templates';return DEMO_SECTIONS.find(item=>item.key===key)||null }
export function tourSections(stage) { return DEMO_SECTIONS.filter(item=>item.stage===stage) }
