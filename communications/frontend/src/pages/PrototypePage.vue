<script setup>
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import WhiteLabelBrand from '../components/WhiteLabelBrand.vue'
import PrototypeNavigation from '../components/prototype/PrototypeNavigation.vue'
import PrototypeOnboarding from '../components/prototype/PrototypeOnboarding.vue'
import PrototypeAssistant from '../components/prototype/PrototypeAssistant.vue'
import WorkspaceLayout from '../modules/whatsapp-web/WorkspaceLayout.vue'
import { DEMO_SECTIONS, SOLUTIONS_URL, prototypeSection, prototypeUrl, tourSections } from '../services/prototype-data.js'
import { prototypeAuth, setPrototypeProfile } from '../services/prototype-runtime.js'
import { routeAllowed } from '../services/access.js'
import { observePrototypeLinks } from '../services/prototype-links.js'
const route=useRoute(),router=useRouter(),$q=useQuasar()
let stopLinkObserver
onMounted(()=>{stopLinkObserver=observePrototypeLinks(router)})
onBeforeUnmount(()=>stopLinkObserver?.())
const drawer=ref($q.screen.gt.sm),onboarding=ref(false),stage=ref(1),finished=ref(false),assistant=ref(null)
const current=computed(()=>prototypeSection(route.path)),isMobileApp=computed(()=>route.path.startsWith('/prototype/app-mobile')),isContact=computed(()=>current.value?.key==='meu-perfil'||route.path.startsWith('/prototype/notificacao/')),isWeb=computed(()=>current.value?.key.startsWith('whatsapp-web'))
const visited=ref(readProgress()),count=computed(()=>visited.value.length),stageItems=computed(()=>tourSections(current.value?.stage||1)),position=computed(()=>Math.max(0,stageItems.value.findIndex(item=>item.key===current.value?.key))+1)
const profileLabel=computed(()=>isContact.value?'Contato Ana':prototypeAuth.isCollaborator?'Colaboradora Júlia':'Administrador fictício')
function readProgress(){try{const value=JSON.parse(sessionStorage.getItem('aito.communication.prototype.visited.v1')||'[]');return Array.isArray(value)?[...new Set(value.filter(key=>DEMO_SECTIONS.some(item=>item.key===key)))]:[]}catch{return[]}}
function remember(){try{sessionStorage.setItem('aito.communication.prototype.visited.v1',JSON.stringify(visited.value))}catch{}}
watch(()=>route.path,()=>{if(current.value&&!visited.value.includes(current.value.key)){visited.value.push(current.value.key);remember()}if(current.value?.key==='colaborador')setPrototypeProfile('collaborator');else if(prototypeAuth.isCollaborator&&!routeAllowed('/'+current.value?.key,prototypeAuth.user))setPrototypeProfile('admin')},{immediate:true})
try{onboarding.value=sessionStorage.getItem('aito.communication.prototype.started.v1')!=='true'}catch{onboarding.value=true}
function go(key){router.push(prototypeUrl(key));if($q.screen.lt.md)drawer.value=false}
function selectProfile(role){setPrototypeProfile(role);go(role==='collaborator'?'colaborador':role==='contact'?'meu-perfil':'settings')}
function startTour(value=1){stage.value=value;onboarding.value=false;try{sessionStorage.setItem('aito.communication.prototype.started.v1','true')}catch{}go(tourSections(value)[0].key)}
function nextScreen(){if(count.value===DEMO_SECTIONS.length){finished.value=true;return}const items=stageItems.value,index=items.findIndex(item=>item.key===current.value?.key);if(index<items.length-1){go(items[index+1].key);return}if((current.value?.stage||1)<3){stage.value=(current.value?.stage||1)+1;onboarding.value=true;return}const remaining=DEMO_SECTIONS.find(item=>!visited.value.includes(item.key));if(remaining)go(remaining.key);else finished.value=true}
// These are the actual screens. Sandbox adapters supply fictional reads and reject writes.
const pages={
  sistema:defineAsyncComponent(()=>import('./PrototypeSystemPage.vue')),
  settings:defineAsyncComponent(()=>import('./HomePage.vue')),
  contacts:defineAsyncComponent(()=>import('./ContactsPage.vue')),
  'contacts/groups':defineAsyncComponent(()=>import('./ContactsPage.vue')),
  templates:defineAsyncComponent(()=>import('./TemplatesPage.vue')),
  notifications:defineAsyncComponent(()=>import('./NotificationsPage.vue')),
  schedules:defineAsyncComponent(()=>import('./NotificationSchedulesPage.vue')),
  invites:defineAsyncComponent(()=>import('./InvitesPage.vue')),
  collaborators:defineAsyncComponent(()=>import('./CollaboratorsPage.vue')),
  'app-mobile':defineAsyncComponent(()=>import('./MobileAppPage.vue')),
  'whatsapp-cloud':defineAsyncComponent(()=>import('./WhatsappCloudPage.vue')),
  telegram:defineAsyncComponent(()=>import('./TelegramPage.vue')),
  email:defineAsyncComponent(()=>import('./EmailPage.vue')),
  help:defineAsyncComponent(()=>import('./HelpPage.vue')),
  administrators:defineAsyncComponent(()=>import('./AdminAccountsPage.vue')),
  whitelabel:defineAsyncComponent(()=>import('./WhiteLabelPage.vue')),
  backup:defineAsyncComponent(()=>import('./WhiteLabelPage.vue')),
  integrations:defineAsyncComponent(()=>import('./IntegrationsPage.vue')),
  terms:defineAsyncComponent(()=>import('./TermsPage.vue')),
  logins:defineAsyncComponent(()=>import('./LoginSettingsPage.vue')),
  colaborador:defineAsyncComponent(()=>import('./CollaboratorHomePage.vue')),
  'meu-perfil':defineAsyncComponent(()=>import('./ProfilePage.vue')),
}
const webPages={
  'whatsapp-web/connection':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/HomePage.vue')),
  'whatsapp-web':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/ChatsPage.vue')),
  'whatsapp-web/flows':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/FlowsPage.vue')),
  'whatsapp-web/native-flows':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/NativeFlowsPage.vue')),
  'whatsapp-web/contacts':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/ContactsPage.vue')),
  'whatsapp-web/catalog':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/CatalogPage.vue')),
  'whatsapp-web/files':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/AssetsPage.vue')),
  'whatsapp-web/integrations':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/IntegrationsPage.vue')),
  'whatsapp-web/logs':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/LogsPage.vue')),
  'whatsapp-web/settings':defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/SettingsPage.vue')),
}
const builder=defineAsyncComponent(()=>import('../modules/whatsapp-web/pages/FlowBuilderPage.vue'))
const publicSite=defineAsyncComponent(()=>import('./PublicSitePage.vue'))
const selectedPage=computed(()=>route.path.startsWith('/prototype/notificacao/')?publicSite:isMobileApp.value?pages['app-mobile']:pages[current.value?.key])
const selectedWebPage=computed(()=>route.path.startsWith('/prototype/whatsapp-web/flows/')?builder:webPages[current.value?.key])
const mobileProps=computed(()=>route.path==='/prototype/app-mobile/web'?{channel:'web'}:route.path==='/prototype/app-mobile/cloud'?{channel:'cloud'}:{})
</script>
<template>
  <q-layout view="lHh Lpr lFf" class="app-shell prototype-faithful" :class="{'prototype-mobile':isMobileApp,'prototype-contact':isContact}">
    <q-header v-if="!isMobileApp&&!isContact" class="app-header glass"><q-toolbar class="app-toolbar"><q-btn flat round dense icon="menu" aria-label="Abrir menu da demonstração" @click="drawer=!drawer"/><WhiteLabelBrand compact class="prototype-compact-brand"/><q-space/><q-badge outline color="primary" class="prototype-demo-badge">Demonstração</q-badge><q-btn flat round dense icon="school" aria-label="Abrir onboarding" @click="stage=current?.stage||1;onboarding=true"/><q-btn flat round dense icon="notifications" aria-label="Notificações de exemplo"><q-badge floating rounded color="negative" label="2"/><q-menu><q-list style="min-width:260px"><q-item clickable @click="go('whatsapp-web')"><q-item-section avatar><q-icon name="mdi-whatsapp" color="teal"/></q-item-section><q-item-section>🟢 Ana Martins<q-item-label caption>Quero conhecer as opções de atendimento.</q-item-label></q-item-section></q-item><q-item clickable @click="go('whatsapp-cloud')"><q-item-section avatar><q-icon name="cloud" color="blue"/></q-item-section><q-item-section>🔵 Bruno Lima<q-item-label caption>Recebi a confirmação, obrigado!</q-item-label></q-item-section></q-item></q-list></q-menu></q-btn><q-btn-dropdown flat no-caps icon="account_circle" :label="profileLabel" class="prototype-profile"><q-list><q-item clickable v-close-popup @click="selectProfile('admin')"><q-item-section>Perfil administrador</q-item-section></q-item><q-item clickable v-close-popup @click="selectProfile('collaborator')"><q-item-section>Perfil colaborador</q-item-section></q-item><q-item clickable v-close-popup @click="selectProfile('contact')"><q-item-section>Perfil do contato</q-item-section></q-item><q-separator/><q-item tag="a" data-prototype-exit href="/admin/login" target="_top"><q-item-section>Voltar ao login real</q-item-section></q-item></q-list></q-btn-dropdown></q-toolbar></q-header>
    <q-drawer v-if="!isMobileApp&&!isContact" v-model="drawer" show-if-above :width="276" :breakpoint="1024" class="app-drawer"><PrototypeNavigation :visited="visited" @navigate="go"/></q-drawer>
    <q-page-container>
      <section class="prototype-tour"><q-btn v-if="isMobileApp||isContact" flat round dense icon="menu" aria-label="Voltar ao painel da demonstração" @click="go('settings')"/><div class="prototype-tour-copy"><strong>Etapa {{current?.stage||1}} / 3 <span>· {{position}} de {{stageItems.length}} telas</span></strong><small>{{count}} de {{DEMO_SECTIONS.length}} telas conhecidas · dados fictícios</small></div><q-linear-progress :value="count/DEMO_SECTIONS.length" rounded color="primary" size="3px"/><q-btn flat dense no-caps icon="school" class="prototype-tour-help" label="Guia" @click="stage=current?.stage||1;onboarding=true"/><q-btn unelevated no-caps dense color="primary" icon-right="arrow_forward" :label="count===DEMO_SECTIONS.length?'Concluir tour':'Próxima tela'" @click="nextScreen"/></section>
      <div class="prototype-sandbox-note"><q-icon name="science"/><span>Você está explorando o sistema com dados fictícios. Pode abrir telas, campos e prévias; salvar, excluir, conectar canais e enviar mensagens estão bloqueados.</span></div>
      <div class="prototype-screen" :class="{'prototype-screen--web':isWeb}">
        <WorkspaceLayout v-if="isWeb&&!isMobileApp&&selectedWebPage" :key="current?.key" :preview-page="selectedWebPage" :preview-visited="visited"/>
        <component :is="selectedPage" v-else-if="selectedPage" :key="current?.key+(route.path.endsWith('/web')?'-web':route.path.endsWith('/cloud')?'-cloud':'')" v-bind="mobileProps"/>
        <section v-else class="q-pa-xl"><h1>Esta tela não está na demonstração.</h1><q-btn color="primary" no-caps label="Voltar ao início" @click="go('settings')"/></section>
      </div>
      <footer class="prototype-footer"><span>AitoNotify + WhatsApp BotBuilder · Demonstração</span><a :href="SOLUTIONS_URL" target="_top">Conhecer os planos <q-icon name="north_east"/></a></footer>
    </q-page-container>
    <PrototypeOnboarding v-model="onboarding" :stage="stage" :visited="visited" @start="startTour"/><PrototypeAssistant v-if="!isContact" ref="assistant"/>
    <q-dialog v-model="finished" persistent :maximized="$q.screen.lt.sm"><q-card class="demo-finish"><q-icon name="task_alt"/><span>TOUR CONCLUÍDO</span><h2>Você conheceu a operação completa.</h2><p>Canais, automações, equipe e governança: {{DEMO_SECTIONS.length}} telas com dados fictícios. Vamos conversar sobre sua implantação?</p><q-btn unelevated color="primary" no-caps icon-right="north_east" label="Conhecer AitoNotify + WhatsApp BotBuilder" :href="SOLUTIONS_URL" target="_top"/><q-btn flat no-caps label="Continuar explorando" @click="finished=false"/></q-card></q-dialog>
  </q-layout>
</template>
<style src="../css/prototype.css"></style>
<style scoped>
.app-header{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--app-background) 68%,white 32%);color:var(--ink)}.app-toolbar{min-height:68px;padding-inline:14px 20px}.app-drawer{border-right:1px solid var(--line);background:color-mix(in srgb,var(--app-background) 82%,white 18%);backdrop-filter:blur(28px)}.prototype-compact-brand{display:none;margin-left:8px}.prototype-demo-badge{margin-right:12px}.prototype-tour{display:flex;align-items:center;gap:14px;padding:12px 24px;background:color-mix(in srgb,var(--brand) 7%,white);border-bottom:1px solid var(--line);position:relative;min-width:0}.prototype-tour-copy{flex:1;min-width:0}.prototype-tour strong{font-size:12px}.prototype-tour strong span{font-weight:400}.prototype-tour small{display:block;font-size:10px;color:var(--muted);margin-top:4px}.prototype-tour>.q-linear-progress{position:absolute;bottom:0;left:0;width:100%}.prototype-tour>.q-btn{font-size:11px;flex:none;border-radius:10px;padding:6px 10px}.prototype-sandbox-note{display:flex;align-items:center;gap:8px;padding:8px 24px;background:#fffaf0;color:#866836;font-size:10px;line-height:1.6}.prototype-screen{min-width:0}.prototype-screen :deep(.q-page){min-height:calc(100dvh - 200px)!important}.prototype-screen--web{padding:16px}.prototype-footer{display:flex;justify-content:space-between;gap:12px;padding:16px 28px;font-size:10px;color:var(--muted)}.prototype-footer a{color:var(--brand-dark)}.demo-connection{padding:40px;text-align:center}.demo-connection p{max-width:600px;margin:20px auto;line-height:1.8}.demo-connection .q-checkbox{display:flex;justify-content:center}.demo-connection h2{font-size:28px}.prototype-mobile .prototype-screen :deep(.mobile-app-page){min-height:calc(100dvh - 110px)}@media(max-width:1023px){.prototype-compact-brand{display:flex}.prototype-demo-badge{display:none}.prototype-profile :deep(.block){display:none}.app-toolbar{min-height:60px;padding:6px 8px}.prototype-tour{padding:10px 12px;gap:7px}.prototype-tour-help{display:none}.prototype-tour-copy strong span{display:none}.prototype-tour small{font-size:9px}.prototype-sandbox-note{padding:7px 12px;font-size:9px}.prototype-screen--web{padding:8px}.prototype-footer{padding:14px;font-size:9px}.prototype-footer>span{max-width:60%}}@media(max-width:500px){.prototype-compact-brand :deep(.brand-name){font-size:16px}.prototype-tour>.q-btn{font-size:10px}.prototype-tour-copy strong{font-size:11px}.prototype-screen--web{padding:0}.prototype-mobile .prototype-sandbox-note{display:none}.prototype-footer{padding-bottom:80px}}
</style>

<style scoped>
.prototype-screen--web :deep(.web-workspace--chat) { height: calc(100dvh - 200px); min-height: 440px; }
@media(max-width: 850px) { .prototype-screen--web :deep(.web-workspace--chat) { height: calc(100dvh - 164px); min-height: 420px; } }
</style>

<style scoped>
.prototype-faithful:has(.chat-page--conversation) :deep(.demo-ai-float) { bottom: calc(100px + env(safe-area-inset-bottom, 0px)); }
</style>
