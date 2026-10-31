// The real views consume these contracts without ever reaching a network adapter.
import { DEMO_CONTACTS, DEMO_TEMPLATES, DEMO_EVENTS, DEMO_COMMANDS } from './prototype-data.js'
import { DEMO_BRANDING, DEMO_SETTINGS, DEMO_STATUS, DEMO_PERMISSIONS, prototypeAuth, prototypeBlocked } from './prototype-runtime.js'
import { AREAS, ACTIONS } from './access.js'
import { simulatePrototypeFlow, PROTOTYPE_FLOW } from './prototype-flow.js'

const id=n=>String(n).padStart(24,'0'), now=()=>new Date().toISOString()
const groupNames=['Clientes','Pós-venda','Treinamentos']
export const prototypeGroups=groupNames.map((name,i)=>({_id:id(20+i),id:id(20+i),name,description:'Grupo de demonstração',active:true,contactCount: i?48:120,contactsCount:i?48:120,createdAt:'2026-10-20T12:00:00Z'}))
export const prototypeContacts=DEMO_CONTACTS.map((person,i)=>({...person,_id:id(i+1),id:id(i+1),name:person.name,phone:'551190000000'+(i+1),email:person.email,active:true,groups:[prototypeGroups.find(g=>g.name===person.group)?._id],groupIds:[prototypeGroups.find(g=>g.name===person.group)?._id],updatedAt:'2026-10-27T12:00:00Z',channels:{whatsapp_cloud:{enabled:true,allowed:true,optIn:true,waId:'551190000000'+(i+1)},whatsapp_web:{enabled:true,allowed:true,optIn:true,externalId:'551190000000'+(i+1)},telegram:{enabled:true,allowed:true,optIn:true,chatId:String(1000+i)},email:{enabled:true,allowed:true,optIn:true,address:person.email}},permissions:{whatsapp_cloud:true,whatsapp_web:true,telegram:true,email:true},consents:['whatsapp_cloud','whatsapp_web','telegram','email'].map(channel=>({channel,status:'granted',granted:true,active:true,allowed:true,source:'demo',grantedAt:'2026-10-20T12:00:00Z'}))}))
for(const contact of prototypeContacts){contact.displayName=contact.name;contact.channels=Object.entries(contact.channels).map(([channel,identity])=>({...identity,channel,authorized:true,consentStatus:'granted',externalId:identity.externalId||identity.waId||identity.chatId||identity.address,metadata:{phone_number_id:'demo-phone-id',display_phone_number:'5511900000100',username:contact.name.toLowerCase().split(' ')[0]}}))}
for(const group of prototypeGroups){group.contacts=prototypeContacts.filter(c=>c.groups.includes(group._id)).map(c=>c._id);group.contactIds=group.contacts}
export const prototypeTemplates=DEMO_TEMPLATES.map((item,i)=>({_id:id(40+i),id:id(40+i),name:item.name,channel:({'WhatsApp Cloud':'whatsapp_cloud',Gmail:'email',Telegram:'telegram',Site:'site'})[item.channel],active:true,isFavorite:i===0,body:item.body,content:item.body,title:item.header||item.name,variables:item.variables.map((label,index)=>({key:String(index+1),name:String(index+1),label,required:true,example:index?'29/10 às 14h':'Ana',defaultValue:index?'29/10 às 14h':'Ana'})),createdAt:'2026-10-20T12:00:00Z',updatedAt:'2026-10-27T12:00:00Z',whatsapp:{name:item.official,templateName:item.official,language:'pt_BR',category:'UTILITY',parameterFormat:'POSITIONAL',components:[...(item.header?[{type:'HEADER',format:'TEXT',text:item.header}]:[]),{type:'BODY',text:item.body},...(item.footer?[{type:'FOOTER',text:item.footer}]:[])]},email:{subject:item.name,html:'<h2>Olá, Ana!</h2><p>Seu atendimento está confirmado.</p>',text:item.body},telegram:{text:item.body},site:{slug:'orientacoes-do-atendimento',title:item.name,visibility:'public',sections:[{title:'Orientações para seu atendimento',body:item.example}],buttons:[]}}))
for(const template of prototypeTemplates){template.externalTemplateName=template.whatsapp.name;template.languageCode='pt_BR';template.category='UTILITY';template.subject=template.name;template.siteTemplateIds=template.channel==='email'||template.channel==='whatsapp_cloud'?['demo-site']:[];template.html=template.email.html;template.metadata={approvedName:template.whatsapp.name,language:'pt_BR'};template.payload={builder:{category:'UTILITY',components:template.whatsapp.components.map(c=>({type:c.type.toLowerCase(),text:c.text,parameters:[...String(c.text||'').matchAll(/\{\{(\d+)\}\}/g)].map(match=>{const v=template.variables.find(v=>v.key===match[1])||{};return {type:'text',key:match[1],label:v.label,example:v.example,fixedValue:''}})}))}}}
const site={url:'/prototype/notificacao/orientacoes-do-atendimento',id:'demo-site',_id:'demo-site',name:'Orientações completas',slug:'orientacoes-do-atendimento',title:'Orientações para seu atendimento',visibility:'public',active:true,expiresAt:null,contactIds:[],groupIds:[],sections:[{title:'Tudo pronto para seu atendimento',format:'text',text:'Separe seus documentos.\nConfira o horário combinado.\nFale com a equipe se precisar de ajuda.'}],css:'',media:[],buttons:[],updatedAt:'2026-10-27T12:00:00Z'}
const bots=[{ai:{profileKey:'assistente-demo'},mode:'ai'},{mode:'bot'},{ownerId:'demo-julia',ownerNick:'Júlia',paused:true,mode:'human'},{attendanceStatus:'closed',mode:'closed'}]
export const prototypeChats=prototypeContacts.map((p,i)=>({_id:p._id,id:p.id,contactId:p._id,displayName:p.name,name:p.name,phone:p.phone,externalId:p.phone+'@c.us',waId:p.phone,isGroup:false,isMyContact:true,unreadCount:i===0?2:0,bot:bots[i],tags:[p.group],lastMessage:{body:DEMO_CONTACTS[i].last,text:DEMO_CONTACTS[i].last,timestamp:'2026-10-27T12:42:00Z'},lastMessageAt:'2026-10-27T12:42:00Z',serviceWindow:{lastInboundAt:now(),expiresAt:new Date(Date.now()+86400000).toISOString()}}))
export function prototypeMessages(chatId){return [{_id:id(70),chatId,conversationId:chatId,direction:'inbound',fromMe:false,type:'text',body:'Olá! Gostaria de saber mais sobre meu atendimento.',text:'Olá! Gostaria de saber mais sobre meu atendimento.',timestamp:now(),createdAt:now(),ack:4,status:'read'},{_id:id(71),chatId,conversationId:chatId,direction:'outbound',fromMe:true,type:'text',body:'*Assistente virtual:*\nOlá! Posso apresentar as opções, consultar orientações ou encaminhar para nossa equipe. Como posso ajudar?',text:'Olá! Posso apresentar as opções ou encaminhar para nossa equipe.',timestamp:now(),createdAt:now(),ack:4,status:'read'}]}
const profiles=[{id:'demo-admin',name:'Administrador de exemplo',nick:'Admin',role:'admin',signatureEnabled:true},{id:'demo-julia',name:'Júlia Costa',nick:'Júlia',role:'collaborator',signatureEnabled:true}]
let chosenProfile='demo-admin'
const accounts=profiles.filter(p=>p.role==='collaborator').map(p=>({...p,_id:p.id,username:'julia.demo',email:'julia@example.com',active:true,emailMfaEnabled:true,permissions:DEMO_PERMISSIONS,stats:{total:24,active:3,completed:21}}))
const assets=[{_id:id(80),name:'Orientações de atendimento.txt',originalName:'Orientações.txt',type:'text',mimeType:'text/plain',size:1024,description:'Referência ilustrativa de conhecimento',createdAt:'2026-10-20T12:00:00Z',url:'/comunicacao/app/brand/prototype-reference.txt'}]
const webSettings={branding:{...DEMO_BRANDING,title:'AitoNotify'},runtime:{collectWindowMs:500,allowPrivateEndpoints:false,messageIntervalMs:1000,processHistoryMessages:false,importContacts:false},messages:{adminNick:'Admin',signatureEnabled:true,botSignature:'Assistente virtual',botSignatureEnabled:true},whatsapp:{autoStart:false,importContacts:false,importHistoryMessages:false}}
const page=(items,params={})=>{const limit=Math.max(1,Number(params.limit)||100),page=Math.max(1,Number(params.page)||1);return {items:items.slice((page-1)*limit,page*limit),total:items.length,page,pages:Math.max(1,Math.ceil(items.length/limit)),limit}}
const list=(items,key,params)=>({...page(items,params),[key]:page(items,params).items})
const logs=DEMO_EVENTS.map((event,i)=>({_id:id(100+i),level:'info',scope:'demo',message:event[3],event:event[1],channel:['whatsapp_web','whatsapp_cloud','email'][i%3],createdAt:now(),timestamp:now()}))

export function prototypeRead(config){
  const url=new URL(config.url||'/', 'https://demo.invalid'),path=url.pathname.replace(/^\/api/,'').replace(/\/$/,'')||'/',params={...Object.fromEntries(url.searchParams),...config.params}
  const web=String(config.baseURL||'').includes('/whatsapp-web')||path.startsWith('/whatsapp-web/'),p=path.replace(/^\/whatsapp-web/,'')||'/'
  if(web){
    if(p==='/auth/me')return {user:prototypeAuth.user}
    if(p==='/license/status')return {active:true}
    if(p==='/whatsapp/status')return {ready:true,connected:true,state:'ready',displayName:'Conta de demonstração',phone:'5511900000100',persistent:true}
    if(p==='/dashboard')return {chats:4,messages:24,flows:1,activeFlows:1,contacts:4,whatsapp:{ready:true,state:'ready',phone:'5511900000100',name:'Conta de demonstração',self:{name:'Conta de demonstração',number:'5511900000100'}}}
    if(p==='/flow-readiness')return {ready:true,flow:{_id:'demo-flow',name:PROTOTYPE_FLOW.name},errors:[],warnings:[]}
    if(p==='/settings')return webSettings
    if(p==='/settings/credentials')return {items:[{_id:'demo-key',name:'OPENAI_API_KEY',description:'Credencial ilustrativa · sem chave real',configured:true}]}
    if(p==='/conversation-profile')return {current:profiles.find(x=>x.id===chosenProfile),profiles,canChoose:prototypeAuth.user.role==='admin'}
    if(p==='/chats/search/messages')return page(prototypeMessages(params.chatId).filter(item=>(item.body||'').toLowerCase().includes(String(params.q||'').toLowerCase())),params)
    if(p==='/chats/attendance')return {total:24,active:3,completed:21}
    if(p==='/chats/assignees')return {items:profiles}
    if(p==='/chats'){let items=prototypeChats.filter(chat=>[chat.displayName,chat.phone].join(' ').toLowerCase().includes((params.search||'').toLowerCase()));if(params.scope==='mine')items=items.filter(chat=>chat.bot.ownerId==='demo-julia');return page(items,params)}
    if(/^\/chats\/[^/]+\/messages$/.test(p))return page(prototypeMessages(p.split('/')[2]),params)
    if(/^\/chats\/[^/]+$/.test(p))return prototypeChats.find(chat=>chat._id===p.split('/')[2])||prototypeChats[0]
    if(p==='/flows')return page([PROTOTYPE_FLOW],params)
    if(p==='/native-flows')return {items:DEMO_COMMANDS.map((command,i)=>({id:'demo-command-'+i,title:command.title,name:command.title,description:command.description,commands:[command.command],nodes:command.steps.map((step,n)=>({id:String(n),position:{x:n%2?370:40,y:Math.floor(n/2)*150+40},data:{label:step}})),edges:command.steps.slice(1).map((step,n)=>({id:String(n),source:String(n),target:String(n+1)}))}))}
    if(p.startsWith('/flows/'))return {flow:PROTOTYPE_FLOW,analysis:{errors:[],warnings:[],conflicts:[]}}
    if(p==='/assets')return page(assets,params)
    if(p==='/integrations/openai/models')return {models:[{id:'gpt-5-mini'},{id:'gpt-5'},{id:'gpt-6.1-sol'}]}
    if(p==='/integrations/openai/profiles')return {items:[{_id:'demo-ai',key:'assistente-demo',title:'Assistente de atendimento',model:'gpt-5-mini',visionModel:'gpt-5-mini',imageModel:'gpt-image-1',credentialName:'OPENAI_API_KEY',temperature:.7,context:[{type:'text',text:'Oriente sobre os serviços e transfira para a equipe quando necessário.'}],resetCommand:'/desligar',generateDocuments:true,generateImages:true}],models:['gpt-5-mini','gpt-5','gpt-6.1-sol'],imageModels:['gpt-image-1']}
    if(p==='/integrations/infinitepay/configs')return {items:[{key:'servico-demo',title:'Consultoria de exemplo',product:'Consultoria',enabled:true,priceCents:20000,originalPriceCents:25000,recipients:[],contactGroupIds:[]}]}
    if(p==='/integrations/contact-groups')return {items:prototypeGroups}
    if(p==='/integrations/openai/usage')return {totals:{inputTokens:12000,outputTokens:4000,totalTokens:16000,estimatedCostUsd:.05},byConversation:[],byModel:[],byProfile:[]}
    if(p==='/integrations/infinitepay/monitor')return {items:[],totals:{paid:0,pending:0,declined:0}}
    if(p==='/logs')return page(logs,params)
    if(p==='/catalog')return {items:[{_id:'demo-catalog',title:'Serviços de exemplo',slug:'servicos-demo',description:'Catálogo ilustrativo',enabled:true,currency:'BRL',settings:{},categories:[]}]}
    if(p.endsWith('/products'))return {items:[{_id:'demo-product',name:'Consultoria inicial',title:'Consultoria inicial',code:'SERV-01',priceCents:20000,active:true,stock:10,description:'Atendimento de 1 hora · exemplo'}]}
    if(p.endsWith('/orders'))return {items:[]}
  }
  if(path==='/settings/status')return DEMO_STATUS
  if(path==='/auth/mfa/settings')return {enabled:true,gmailConfigured:true,sender:{email:'atendimento@example.com',name:'AitoNotify'}}
  if(path==='/settings')return DEMO_SETTINGS
  if(path==='/settings/whitelabel'||path==='/whitelabel')return DEMO_BRANDING
  if(path==='/settings/admin-security'||path==='/admin-security')return {emailMfaEnabled:true,enabled:true,gmailConfigured:true,fromName:'AitoNotify'}
  if(path==='/contacts')return list(prototypeContacts,'contacts',params)
  if(/^\/contacts\/[^/]+$/.test(path))return prototypeContacts.find(p=>p._id===path.split('/')[2])||prototypeContacts[0]
  if(path==='/contact-groups')return list(prototypeGroups,'groups',params)
  if(path==='/templates')return list(prototypeTemplates.filter(t=>!params.channel||t.channel===params.channel),'templates',params)
  if(path==='/site-templates'||path==='/site-templates/links')return {items:[site]}
  if(path.startsWith('/public/sites/')||/^\/site-templates\/[^/]+\/preview$/.test(path))return {...site,document:'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;color:#173b30;background:#f4fbf9;padding:28px}main{max-width:720px;margin:auto;padding:28px;background:white;border-radius:22px}p{line-height:1.9;white-space:pre-wrap}</style><main><small>DEMONSTRAÇÃO</small><h1>Orientações para seu atendimento</h1><p>Separe seus documentos.\nConfira o horário combinado.\nFale com a equipe se precisar de ajuda.</p></main></html>',media:[]}
  if(path.startsWith('/site-templates/'))return site
  if(path.startsWith('/templates/'))return prototypeTemplates.find(t=>t._id===path.split('/')[2])||prototypeTemplates[0]
  if(path==='/template-sets')return list([{_id:id(50),name:'Relacionamento com clientes',description:'Biblioteca de exemplo',templates:{whatsappCloud:prototypeTemplates[0]._id,email:prototypeTemplates[2]._id,telegram:prototypeTemplates[3]._id},active:true}],'templateSets',params)
  if(path==='/invites')return list([{_id:id(51),name:'Boas-vindas',title:'Boas-vindas',slug:'boas-vindas-demo',description:'Convite ilustrativo',active:true,uses:42,contacts:[],channels:['whatsapp_cloud','email']}],'invites',params)
  if(path==='/notifications/stats')return {total:240,delivered:236,failed:4,contacts:248}
  if(path==='/notifications')return list([{_id:id(52),name:'Lembrete de atendimento',title:'Lembrete de atendimento',channel:'whatsapp_cloud',templateId:prototypeTemplates[1]._id,template:prototypeTemplates[1],status:'completed',createdAt:now(),total:120,delivered:118,sent:120,failed:2,stats:{total:120,delivered:118,sent:120,failed:2}}],'notifications',params)
  if(path==='/notification-schedules')return list([{_id:id(53),name:'Resumo da semana',channel:'email',templateId:prototypeTemplates[2]._id,template:prototypeTemplates[2],status:'active',active:true,nextRunAt:'2026-10-30T11:00:00Z',recurrence:{type:'weekly'},schedule:{type:'weekly'},recipientGroupIds:[prototypeGroups[0]._id],createdAt:now()}],'schedules',params)
  if(path==='/conversations')return list(prototypeChats.map(chat=>({...chat,channel:params.channel||'whatsapp_cloud',contactName:chat.displayName,contact:prototypeContacts.find(p=>p._id===chat.contactId),lastMessage:chat.lastMessage.body,unread:chat.unreadCount})),'conversations',params)
  if(path==='/whatsapp-cloud/conversations')return list(prototypeChats.map(chat=>({...chat,channel:'whatsapp_cloud',contactName:chat.displayName,contact:prototypeContacts.find(p=>p._id===chat.contactId),lastMessage:chat.lastMessage.body,unread:chat.unreadCount})),'conversations',params)
  if(/^\/whatsapp-cloud\/conversations\/[^/]+\/messages$/.test(path))return list(prototypeMessages(path.split('/')[3]),'messages',params)
  if(/^\/whatsapp-cloud\/conversations\/[^/]+$/.test(path))return prototypeChats.find(c=>c._id===path.split('/')[3])||prototypeChats[0]
  if(/^\/conversations\/[^/]+\/messages$/.test(path))return list(prototypeMessages(path.split('/')[2]),'messages',params)
  if(path==='/whatsapp-cloud/status')return {enabled:true,configured:true,connected:true,displayPhoneNumber:'5511900000100',phoneNumberId:'demo-phone-id',businessAccountId:'demo-waba',webhookConfigured:true}
  if(path==='/telegram/status')return {...DEMO_STATUS.telegram,botUsername:'atendimento_exemplo_bot',connected:true,webhook:{configured:true,healthy:true}}
  if(path==='/telegram/groups')return {groups:[{_id:'demo-telegram-group',chatId:'-1000100',title:'Comunidade de exemplo',name:'Comunidade de exemplo',isGroup:true,active:true}]}
  if(path==='/logs')return list(logs,'logs',params)
  if(path==='/collaborators/permissions')return {areas:AREAS.map(area=>({...area,actions:ACTIONS.filter(action=>action.startsWith(area.key+'.')).map(key=>({key,label:key.split('.').slice(1).join('.')}))})),gmailConfigured:true}
  if(path==='/collaborators')return {items:accounts,gmailConfigured:true,loginUrl:'/prototype/colaborador'}
  if(path==='/admin-accounts')return page([{_id:'demo-admin',email:'admin@example.com',name:'Administrador de exemplo',emailMfaEnabled:true,active:true,lastLoginAt:now()}],params)
  if(path==='/integrations/apps')return page([{_id:'demo-integration',name:'Portal de agendamentos',description:'Integração de exemplo',active:true,scopes:['notifications:create'],createdAt:now(),allowedTemplateIds:[prototypeTemplates[1]._id]}],params)
  if(path==='/terms')return list([{_id:id(54),title:'Termos de uso',name:'Termos de uso',version:'1.0',status:'published',content:'Documento de demonstração. A versão real é definida pela operação.',createdAt:now(),publishedAt:now()}],'terms',params)
  if(path==='/profile-logins')return list([{_id:id(55),name:'Ana Martins',contact:prototypeContacts[0],channel:'whatsapp_cloud',createdAt:now(),lastLoginAt:now(),status:'used'}],'items',params)
  if(path==='/my-profile')return {...prototypeContacts[0],displayName:'Ana Martins',permissions:['whatsapp_cloud','whatsapp_web','telegram','email'].map(channel=>({channel,enabled:true,allowed:true,authorized:true,consentStatus:'granted',status:'granted',externalId:channel==='email'?'ana@example.com':'5511900000001',grantedAt:now()}))}
  if(path==='/my-profile/history')return list([{_id:id(56),channel:'whatsapp_cloud',template:{name:'Lembrete de atendimento'},templateName:'Lembrete de atendimento',status:'delivered',content:{header:'Seu agendamento',text:'Olá Ana, seu atendimento está confirmado para amanhã às 14h.',footer:'Sua equipe de atendimento'},updatedAt:now(),createdAt:now(),attempts:1}],'items',params)
  if(path.startsWith('/my-profile/groups/'))return {...prototypeGroups[0],members:prototypeContacts}
  if(path==='/my-profile/memberships')return {groups:prototypeGroups.map(g=>({...g,memberCount:120})),invites:[]}
  if(path==='/my-profile/activation-links')return {helpCommands:{whatsapp:DEMO_COMMANDS.filter(x=>x.command.startsWith('/')),telegram:DEMO_COMMANDS.filter(x=>x.command.startsWith('/'))}}
  if(path==='/system/storage-collections')return {collections:['contacts','messages','logs'].map(name=>({name,label:name,count:name==='contacts'?4:24,documents:name==='contacts'?4:24,size:4096,bytes:4096,canExport:true,canClear:true,clearSupported:true,confirmation:'LIMPAR '+name,periods:['week','quarter','total']})),global:{canExport:true,canClear:false}}
  if(path==='/system/storage-usage')return {totalBytes:16384,collections:['contacts','messages','logs'].map(name=>({name,count:24,size:4096,storageSize:4096,totalSize:4096}))}
  // Unimplemented reads remain local and empty. They never fall through to a provider.
  return {items:[],total:0,page:1,pages:1,limit:100,events:[],logs:[],models:[],areas:[],channels:[],kinds:[],unread:0,filters:{channels:[],kinds:[]}}
}
export function prototypeRequest(config){
  const method=String(config.method||'get').toLowerCase(),web=String(config.baseURL||'').includes('/whatsapp-web'),path=config.url||''
  let data
  if(method==='get')data=prototypeRead(config)
  else if(web&&method==='post'&&path==='/flows/simulate')data=simulatePrototypeFlow(typeof config.data==='string'?JSON.parse(config.data):config.data)
  else if(method==='post'&&path==='/site-templates/preview'){const input=typeof config.data==='string'?JSON.parse(config.data):config.data,escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));data={document:'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;padding:24px;color:#183d32;background:#f4fbf9}main{max-width:760px;margin:auto;background:white;border-radius:20px;padding:28px}p{white-space:pre-wrap;line-height:1.8}small{color:#568373}</style><main><small>PRÉVIA FICTÍCIA</small><h1>'+escape(input.title||input.name)+'</h1>'+(input.sections||[]).map(section=>'<section><h2>'+escape(section.title)+'</h2><p>'+escape(section.text)+'</p></section>').join('')+'</main></html>',media:[]}}
  else if(web&&method==='post'&&path==='/conversation-profile'){const input=typeof config.data==='string'?JSON.parse(config.data):config.data;chosenProfile=profiles.some(p=>p.id===input?.profileId)?input.profileId:chosenProfile;data={current:profiles.find(p=>p.id===chosenProfile),profiles,canChoose:true}}
  else throw prototypeBlocked()
  return {data:JSON.parse(JSON.stringify(data)),status:200,statusText:'OK',headers:{},config}
}
