// Shared ordering and grouping for the real panel and the public demonstration.
export function createAppNavigation({invitesAvailable=true,inviteAccessExplanation='',usefulLinks=[],channelEnabled=()=>true}={}) {
  return [
    {key: 'home',label: 'Início',icon: 'space_dashboard',children:[
      {label: 'Configurações',icon: 'settings',to: '/',available:true},
      {label: 'Sistema',icon: 'dns',to: '/sistema',available:true},
      {label: 'Templates',icon: 'dashboard_customize',to: '/templates',available:true},
      {label: 'Notificações',icon: 'send',to: '/notifications',available:true},
      {label: 'Programações',icon: 'schedule_send',to: '/schedules',available:true},
      {label: 'Convites',icon: 'link',to: '/invites',available:invitesAvailable,unavailableMessage:inviteAccessExplanation,tooltip:invitesAvailable?'':inviteAccessExplanation},
    ]},
    {label: 'App de atendimento',caption: 'Acesso rápido aos chats',icon: 'smartphone',to: '/app-mobile',available:true},
    {label: 'Colaboradores',icon: 'support_agent',to: '/collaborators',available:true},
    {label: 'Contatos',caption: 'Pessoas e grupos',icon: 'group',to: '/contacts',available:true},
    {separator:true,label: 'Canais'},
    {key: 'whatsapp',label: 'WhatsApp',icon: 'mdi-whatsapp',children:[
      {label: 'WhatsApp Cloud',caption: 'API oficial da Meta',icon: 'cloud',to: '/whatsapp-cloud',available:true},
      {label: 'WhatsApp Web',caption: 'Aparelho conectado e atendimento',icon: 'qr_code_2',to: '/whatsapp-web',available:true},
    ]},
    {label: 'Telegram',icon: 'bi-telegram',to: '/telegram',available:channelEnabled('telegram'),channelColor:'telegram'},
    {label: 'Gmail',icon: 'mdi-gmail',to: '/email',available:channelEnabled('email'),channelColor:'gmail'},
    {separator:true,label: 'Úteis'},
    {label: 'Ajuda',caption: 'Guias e primeiros passos',icon: 'help_center',to: '/help',available:true},
    ...usefulLinks,
    {separator:true,label: 'Governança'},
    {label: 'Administradores',icon: 'admin_panel_settings',to: '/administrators',available:true},
    {label: 'Whitelabel',caption: 'Marca e aparência',icon: 'palette',to: '/whitelabel',available:true},
    {label: 'Backup e armazenamento',icon: 'backup',to: '/whitelabel#storage',available:true},
    {label: 'Integrações',icon: 'hub',to: '/integrations',available:true},
    {label: 'Termos e LGPD',icon: 'verified_user',to: '/terms',available:true},
    {label: 'Logins',caption: 'Acesso seguro dos contatos',icon: 'login',to: '/logins',available:true},
  ]
}
