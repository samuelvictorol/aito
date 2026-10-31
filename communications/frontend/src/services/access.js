export const CHANNELS = [{ key: 'whatsapp_web', label: 'WhatsApp Web' }, { key: 'whatsapp_cloud', label: 'WhatsApp Cloud' }, { key: 'telegram', label: 'Telegram' }, { key: 'email', label: 'Gmail' }]
export const PERMISSION_GROUPS = [{ key:'start',label:'Início e pessoas' },{key:'channels',label:'Canais'},{key:'web',label:'WhatsApp Web · funcionalidades'},{key:'governance',label:'Governança'},{key:'assistant',label:'Aito I.A'}]
export const AREAS = [
  {key:'settings',label:'Configurações',path:'/',icon:'settings',group:'start'},
  {key:'mobile',label:'App de atendimento',path:'/app-mobile',icon:'smartphone',group:'start',maxLevel:'view'},
  {key:'collaborators',label:'Colaboradores',path:'/collaborators',icon:'support_agent',group:'start'},
  {key:'contacts',label:'Contatos e grupos',path:'/contacts',icon:'group',group:'start'},
  {key:'templates',label:'Templates e sites',path:'/templates',icon:'dashboard_customize',group:'start'},
  {key:'notifications',label:'Notificações',path:'/notifications',icon:'send',group:'start'},
  {key:'schedules',label:'Programações',path:'/schedules',icon:'schedule_send',group:'start'},
  {key:'invites',label:'Convites',path:'/invites',icon:'link',group:'start'},
  {key:'whatsapp_web',label:'WhatsApp Web · conversas',path:'/whatsapp-web',icon:'forum',group:'channels',channel:'whatsapp_web'},
  {key:'whatsapp_cloud',label:'WhatsApp Cloud',path:'/whatsapp-cloud',icon:'cloud',group:'channels',channel:'whatsapp_cloud'},
  {key:'telegram',label:'Telegram',path:'/telegram',icon:'bi-telegram',group:'channels',channel:'telegram'},
  {key:'email',label:'Gmail',path:'/email',icon:'mdi-gmail',group:'channels',channel:'email'},
  {key:'web_connection',label:'Conexão e QR Code',path:'/whatsapp-web/connection',icon:'qr_code_2',group:'web',channel:'whatsapp_web'},
  {key:'web_flows',label:'Fluxos e simulador',path:'/whatsapp-web/flows',icon:'account_tree',group:'web',channel:'whatsapp_web'},
  {key:'web_native',label:'Comandos nativos',path:'/whatsapp-web/native-flows',icon:'terminal',group:'web',channel:'whatsapp_web',maxLevel:'view'},
  {key:'web_contacts',label:'Contatos e grupos do WhatsApp Web',path:'/whatsapp-web/contacts',icon:'contacts',group:'web',channel:'whatsapp_web'},
  {key:'web_catalog',label:'Catálogo e pedidos',path:'/whatsapp-web/catalog',icon:'storefront',group:'web',channel:'whatsapp_web'},
  {key:'web_files',label:'Biblioteca de arquivos',path:'/whatsapp-web/files',icon:'perm_media',group:'web',channel:'whatsapp_web'},
  {key:'web_integrations',label:'Integrações OpenAI e pagamentos',path:'/whatsapp-web/integrations',icon:'hub',group:'web',channel:'whatsapp_web'},
  {key:'web_logs',label:'Monitoramento e logs',path:'/whatsapp-web/logs',icon:'monitor_heart',group:'web',channel:'whatsapp_web',maxLevel:'view'},
  {key:'web_settings',label:'Configurações do WhatsApp Web',path:'/whatsapp-web/settings',icon:'tune',group:'web',channel:'whatsapp_web'},
  {key:'help',label:'Ajuda',path:'/help',icon:'help_center',group:'governance'},
  {key:'administrators',label:'Administradores',path:'/administrators',icon:'admin_panel_settings',group:'governance',maxLevel:'view'},
  {key:'whitelabel',label:'Whitelabel',path:'/whitelabel',icon:'palette',group:'governance'},
  {key:'backup',label:'Backup e armazenamento',path:'/whitelabel#storage',icon:'backup',group:'governance',maxLevel:'view'},
  {key:'integrations',label:'Integrações externas',path:'/integrations',icon:'hub',group:'governance',maxLevel:'view'},
  {key:'terms',label:'Termos e LGPD',path:'/terms',icon:'verified_user',group:'governance'},
  {key:'logins',label:'Logins dos contatos',path:'/logins',icon:'login',group:'governance'},
  {key:'assistant',label:'Aito I.A',path:null,icon:'smart_toy',group:'assistant'},
]
export const isCollaborator = user => user?.role === 'collaborator'
const SENSITIVE_ACTIONS = new Set(['whatsapp_web.delete','assistant.configure','settings.credentials','web_settings.credentials','collaborators.permissions','collaborators.password','whatsapp_web.configure','whatsapp_cloud.configure','telegram.configure','email.configure'])
const LEVELS = new Set(['none','view','manage'])
export function permissionLevel(user, area) {
  if (!isCollaborator(user)) return 'manage'
  const value = user.permissions?.[area]
  if (LEVELS.has(value)) return value
  // Preserve existing channel conversations and the mobile launcher without granting new areas.
  if (CHANNELS.some(item=>item.key===area) && user.permissions?.channels?.includes(area)) return 'manage'
  if (area==='mobile' && user.permissions?.channels?.length) return 'view'
  return 'none'
}
export const canArea = (user, area, manage = false) => manage ? permissionLevel(user,area)==='manage' : ['view','manage'].includes(permissionLevel(user,area))
export const canChannel = (user, channel) => !isCollaborator(user) || Boolean(user.permissions?.channels?.includes(channel))
export function canAction(user, area, action) {
  if (!isCollaborator(user)) return true
  if (!canArea(user,area,true)) return false
  const key = action?.includes('.') ? action : `${area}.${action}`
  if (!ACTIONS.includes(key)) return false
  const override = user.permissions?.actions?.[key]
  return SENSITIVE_ACTIONS.has(key) ? override===true : override!==false
}
export function normalizedPermissions(value = {}) {
  const channels=Array.isArray(value.channels)?value.channels.filter(channel=>CHANNELS.some(item=>item.key===channel)):['whatsapp_web']
  const actor={role:'collaborator',permissions:{...value,channels}}
  return {channels:[...new Set(channels)],...Object.fromEntries(AREAS.map(area=>[area.key,permissionLevel(actor,area.key)])),actions:Object.fromEntries(Object.entries(value.actions||{}).filter(([,allowed])=>typeof allowed==='boolean'))}
}
export function routeArea(rawPath) {
  let path,hash
  try { const url=new URL(rawPath,'http://local');path=url.pathname.replace(/\/$/,'')||'/';hash=url.hash } catch { return null }
  if(path==='/whitelabel'&&hash==='#storage')return 'backup'
  if(path==='/whatsapp-web/colaboradores')return 'collaborators'
  if(path==='/notification')return 'notifications'
  if(path==='/ajuda')return 'help'
  if(['/app','/mobile-app'].includes(path))return 'mobile'
  if(path==='/app-mobile/web')return 'whatsapp_web'
  if(path==='/app-mobile/cloud')return 'whatsapp_cloud'
  const sorted=AREAS.filter(item=>item.path&&!item.path.includes('#')).slice().sort((a,b)=>b.path.length-a.path.length)
  return sorted.find(item=>path===item.path||(item.path!=='/'&&path.startsWith(item.path+'/')))?.key||null
}
export function routeAllowed(rawPath, user) {
  if (!isCollaborator(user)) return true
  let path
  try { path=new URL(rawPath,'http://local').pathname } catch { return false }
  if(path==='/colaborador')return true
  const area=routeArea(rawPath), definition=AREAS.find(item=>item.key===area)
  if(!area||!canArea(user,area))return false
  if(definition?.channel&&!canChannel(user,definition.channel))return false
  if(path.startsWith('/app-mobile/')&&!canArea(user,'mobile'))return false
  return area!=='mobile'||CHANNELS.some(item=>canChannel(user,item.key)&&canArea(user,item.key))
}
export function firstAllowedWeb(user) { return AREAS.filter(item=>item.channel==='whatsapp_web'&&item.path).map(item=>item.path).find(path=>routeAllowed(path,user))||null }
export function firstAllowed(user) {
  if (!isCollaborator(user)) return '/'
  return ['/app-mobile','/telegram','/email',...AREAS.map(item=>item.path).filter(Boolean)].find(path=>routeAllowed(path,user))||'/colaborador'
}
const ACTION_NAMES = {
  settings:['configure','credentials'],mobile:[],contacts:['create','edit','delete','import','export','permissions'],templates:['create','edit','delete','import','export'],notifications:['send','delete'],schedules:['create','edit','delete','send'],invites:['create','edit','delete','export'],collaborators:['create','edit','permissions','password'],
  whatsapp_web:['create','send','edit','delete','assign','import','export','configure'],whatsapp_cloud:['create','send','edit','delete','assign','import','export','configure'],telegram:['create','send','edit','delete','assign','import','export','configure'],email:['create','send','edit','delete','assign','import','export','configure'],
  web_connection:['configure','import'],web_flows:['create','edit','delete','import','export','execute'],web_native:[],web_contacts:['create','edit','delete','import','export'],web_catalog:['create','edit','delete','send'],web_files:['edit','delete','import','export'],web_integrations:['create','edit','delete','configure'],web_logs:[],web_settings:['configure','credentials'],assistant:['execute','configure'],help:['configure'],administrators:[],whitelabel:['configure'],backup:[],integrations:[],terms:['create','edit','delete'],logins:['configure'],
}
export const ACTIONS = Object.freeze(Object.entries(ACTION_NAMES).flatMap(([area,names])=>names.map(name=>`${area}.${name}`)))
export function apiPermission(config={}) {
  let path
  try { const url=String(config.url||'');const prefix=String(config.baseURL||'').includes('/whatsapp-web')&&!url.startsWith('/whatsapp-web')?'/whatsapp-web':'';path=new URL(prefix+url,'http://local').pathname.replace(/^\/api(?=\/)/,'') }catch{return null}
  const method=String(config.method||'get').toUpperCase(),read=['GET','HEAD'].includes(method)
  if(/^\/(auth|collaborator)\//.test(path)||['/settings','/settings/status','/collaborators/permissions'].includes(path)&&read)return null
  let area
  if(path.startsWith('/whatsapp-web/')){
    const local=path.slice('/whatsapp-web'.length)
    if(/^\/(auth|conversation-profile)(\/|$)/.test(local))return null
    if(/^\/collaborators(\/|$)/.test(local))area='collaborators'
    else if(/^\/(chats|media)(\/|$)/.test(local))area='whatsapp_web'
    else if(/^\/whatsapp(\/|$)/.test(local))area=local==='/whatsapp/status'?'whatsapp_web':'web_connection'
    else if(/^\/(flows|actions)(\/|$)/.test(local)||local==='/flow-readiness')area='web_flows'
    else if(local==='/native-flows')area='web_native'
    else if(/^\/catalog(\/|$)/.test(local))area='web_catalog'
    else if(/^\/assets(\/|$)/.test(local))area='web_files'
    else if(/^\/integrations\/contact-groups(\/|$)/.test(local))area='web_contacts'
    else if(/^\/integrations(\/|$)/.test(local))area='web_integrations'
    else if(/^\/settings(\/|$)/.test(local))area='web_settings'
    else if(/^\/logs(\/|$)/.test(local))area='web_logs'
  }else{
    const maps=[[/^\/(contacts|contact-groups|groups|consents)(\/|$)/,'contacts'],[/^\/(templates|template-sets|site-templates|media|template-media)(\/|$)/,'templates'],[/^\/notifications(\/|$)/,'notifications'],[/^\/notification-schedules(\/|$)/,'schedules'],[/^\/invites(\/|$)/,'invites'],[/^\/collaborators(\/|$)/,'collaborators'],[/^\/settings\/whitelabel(\/|$)/,'whitelabel'],[/^\/settings(\/|$)/,'settings'],[/^\/privacy\/contacts(\/|$)/,'contacts'],[/^\/(terms|privacy)(\/|$)/,'terms'],[/^\/(profile-auth|profile-settings|login-settings|logins)(\/|$)/,'logins'],[/^\/integrations(\/|$)/,'integrations'],[/^\/help-guides(\/|$)/,'help'],[/^\/admin-assistant(\/|$)/,'assistant']]
    area=maps.find(([pattern])=>pattern.test(path))?.[1]
    const provider=/^\/(whatsapp-cloud|telegram|email|gmail)(\/|$)/.exec(path);if(provider)area={'whatsapp-cloud':'whatsapp_cloud',telegram:'telegram',email:'email',gmail:'email'}[provider[1]]
    if(path==='/bulk/remove')area=config.data?.target==='contacts'?'contacts':config.data?.target
  }
  if(!area)return null
  if(CHANNELS.some(item=>item.key===area)){
    if(read)return /export|download|backup/.test(path)?{area,action:'export'}:null
    if(method==='PATCH'&&/\/read$/.test(path))return null
    if(/webhook|configure|settings/.test(path))return{area,action:'configure'}
    if(method==='DELETE'||config.data?.action==='delete')return{area,action:'delete'}
    if(/attendance|\/bot$|context\/reset/.test(path))return{area,action:'assign'}
    if(/\/(messages|media|assets|location|contact-card|reaction|forward)$/.test(path)||/send|dispatch|consent-request/.test(path))return{area,action:'send'}
    if(/\/sync$/.test(path))return{area,action:'import'}
    return{area,action:method==='POST'&&/\/groups$/.test(path)?'create':'edit'}
  }
  if(area==='assistant')return /\/(config|key-sources)(\/|$)/.test(path)?(!read||path.endsWith('/key-sources')?{area,action:'configure'}:null):path.endsWith('/confirm')?{area,action:'execute'}:null
  if(read)return /\/reveal(\/|$)/.test(path)?{area,action:'credentials'}:/export|download|backup/.test(path)?{area,action:'export'}:null
  const operationPath=path.replace(/^\/whatsapp-web(?=\/|$)/,'')
  let action
  if(method==='POST'&&(area==='web_files'&&operationPath==='/assets'||area==='templates'&&/^\/(media|template-media)$/.test(operationPath)))return{area,action:'import'}
  if(area==='web_flows'&&/simulate|execute|test|\/active$/.test(path))return{area,action:'execute'}
  if(area==='collaborators')action=method==='POST'?'create':'edit'
  else if(['settings','whitelabel','web_settings','web_connection','help','logins'].includes(area))action=/credentials|reveal/.test(path)?'credentials':/sync|import/.test(path)?'import':'configure'
  else if(/permissions|consents/.test(path))action='permissions'
  else if(method==='DELETE'||/\/bulk|\/remove|\/clear/.test(path)||config.data?.action==='delete')action='delete'
  else if(/import|upload|\/sync/.test(path))action='import'
  else if(/export|download/.test(path))action='export'
  else if(/attendance|takeover|transfer|release|pause|resume/.test(path))action='assign'
  else if(area==='web_flows'&&/simulate|execute|test/.test(path))action='execute'
  else if(area==='notifications'||/send|dispatch|retry|consent-request|\/messages$/.test(path))action='send'
  else if(/configure|webhook|config/.test(path))action='configure'
  else action=method==='POST'?'create':'edit'
  return {area,action}
}
