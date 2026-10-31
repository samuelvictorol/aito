<script setup>
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ScreenPrivacyToggle from "../components/ScreenPrivacyToggle.vue"
import RouterLink from '../components/PrototypeAwareRouterLink.vue'
import { defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue'
import AddToHomeButton from '../components/AddToHomeButton.vue'
import { withScreenLoading } from '../services/route-loading.js'
import { createInboxUnread } from '../services/inbox-unread.js'
import { useWhiteLabel } from '../services/whitelabel.js'
import { useAuthStore } from '../stores/auth.js'
import { canChannel, canArea } from '../services/access.js'
import { useRouter } from 'vue-router'
import ConversationSignature from '../modules/whatsapp-web/ConversationSignature.vue'
const { branding } = useWhiteLabel()
const auth = useAuthStore(), router = useRouter(), webProfile = ref(null)
function openWeb() { webProfile.value?.open() }
function enterWeb() { router.push('/app-mobile/web') }
const WebInbox = defineAsyncComponent(withScreenLoading(() => import('../modules/whatsapp-web/WorkspaceLayout.vue'), 'Abrindo suas conversas…'))
const CloudInbox = defineAsyncComponent(withScreenLoading(() => import('./ChatsPage.vue'), 'Abrindo suas conversas…'))
const props = defineProps({ channel: { type: String, default: '' } })
const frame = ref(null)
const unread = createInboxUnread()
const unreadLabel = channel => `${channel === 'whatsapp_web' ? 'WhatsApp Web' : 'WhatsApp Cloud'}: ${unread.counts[channel]} mensagem(ns) não lida(s)`
const badge = count => count > 99 ? '99+' : count
function fitViewport() {
  frame.value?.style.setProperty('--mobile-app-height', `${Math.round(window.visualViewport?.height || window.innerHeight)}px`)
  if (['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName)) requestAnimationFrame(() => frame.value?.querySelectorAll('.message-stream').forEach(element => { element.scrollTop = element.scrollHeight }))
}
onMounted(() => { unread.start(); fitViewport(); window.addEventListener('resize', fitViewport); window.visualViewport?.addEventListener('resize', fitViewport) })
onBeforeUnmount(() => { unread.stop(); window.removeEventListener('resize', fitViewport); window.visualViewport?.removeEventListener('resize', fitViewport) })
</script>
<template>
  <section ref="frame" :class="['mobile-app', { 'mobile-app--inbox': channel }]">
    <header class="mobile-app-header">
      <RouterLink :to="channel ? '/app-mobile' : auth.isCollaborator ? '/colaborador' : '/'" class="mobile-app-brand" :aria-label="channel ? 'Escolher canal' : 'Abrir painel completo'"><img :src="branding.logoUrl || '/comunicacao/app/icons/aito-v2-180.png'" alt=""><span><strong :title="branding.appName">{{ branding.appName }}</strong><small>{{ channel ? 'Seu atendimento em tempo real' : 'Escolha seu canal de atendimento' }}</small></span></RouterLink>
      <LanguageSwitcher/><ScreenPrivacyToggle />
      <nav v-if="channel" aria-label="Alternar canal"><RouterLink v-if="canChannel(auth.user,'whatsapp_web')" to="/app-mobile/web" :class="{ active: channel === 'web' }" :aria-label="unreadLabel('whatsapp_web')">🟢 Web<span v-if="unread.counts.whatsapp_web" class="channel-unread channel-unread--web" aria-hidden="true">{{ badge(unread.counts.whatsapp_web) }}</span></RouterLink><RouterLink v-if="canChannel(auth.user,'whatsapp_cloud')" to="/app-mobile/cloud" :class="{ active: channel === 'cloud' }" :aria-label="unreadLabel('whatsapp_cloud')">🔵 Cloud<span v-if="unread.counts.whatsapp_cloud" class="channel-unread channel-unread--cloud" aria-hidden="true">{{ badge(unread.counts.whatsapp_cloud) }}</span></RouterLink></nav>
      <RouterLink v-else :to="auth.isCollaborator ? '/colaborador' : '/'" class="mobile-dashboard-link"><q-icon name="space_dashboard" size="22px"/><span>Painel completo</span></RouterLink>
      <AddToHomeButton/>
    </header>
    <div v-if="!channel" class="mobile-channel-picker">
      <article v-if="canChannel(auth.user, 'whatsapp_web') && canArea(auth.user, 'whatsapp_web')" class="mobile-channel mobile-channel--web">
        <a :href="router.resolve('/app-mobile/web').href" class="mobile-channel-main" @click.prevent="openWeb"><span class="channel-eyebrow">APARELHO CONECTADO</span><q-icon name="mdi-whatsapp"/><h1>WhatsApp Web</h1><p>Conversas, IA e atendimento da equipe</p><span class="channel-enter">Abrir conversas <q-icon name="arrow_forward"/></span></a>
        <div v-if="canArea(auth.user, 'web_flows')" class="channel-shortcuts"><RouterLink to="/whatsapp-web/flows"><q-icon name="account_tree"/> Criar fluxos do bot</RouterLink></div>
      </article>
      <article v-if="canChannel(auth.user, 'whatsapp_cloud') && canArea(auth.user, 'whatsapp_cloud')" class="mobile-channel mobile-channel--cloud">
        <RouterLink to="/app-mobile/cloud" class="mobile-channel-main"><span class="channel-eyebrow">API OFICIAL DA META</span><q-icon name="cloud"/><h1>WhatsApp Cloud</h1><p>Mensagens oficiais, contatos e notificações</p><span class="channel-enter">Abrir conversas <q-icon name="arrow_forward"/></span></RouterLink>
        <div class="channel-shortcuts"><RouterLink v-if="canArea(auth.user, 'templates')" to="/templates"><q-icon name="dashboard_customize"/> Templates</RouterLink><RouterLink v-if="canArea(auth.user, 'notifications')" to="/notifications"><q-icon name="send"/> {{ canArea(auth.user,'notifications',true) ? 'Disparar notificações' : 'Histórico de notificações' }}</RouterLink></div>
      </article>
      <article v-if="canChannel(auth.user, 'telegram') && canArea(auth.user, 'telegram')" class="mobile-channel mobile-channel--telegram">
        <RouterLink to="/telegram" class="mobile-channel-main"><span class="channel-eyebrow">BOT E ATENDIMENTO</span><q-icon name="telegram"/><h1>Telegram</h1><p>Conversas, grupos e notificações</p><span class="channel-enter">Abrir Telegram <q-icon name="arrow_forward"/></span></RouterLink>
        <div class="channel-shortcuts"><RouterLink v-if="canArea(auth.user, 'templates')" to="/templates"><q-icon name="dashboard_customize"/> Templates</RouterLink></div>
      </article>
      <article v-if="canChannel(auth.user, 'email') && canArea(auth.user, 'email')" class="mobile-channel mobile-channel--gmail">
        <RouterLink to="/email" class="mobile-channel-main"><span class="channel-eyebrow">ENVIO POR E-MAIL</span><q-icon name="mail"/><h1>Gmail</h1><p>Mensagens, campanhas e histórico</p><span class="channel-enter">Abrir Gmail <q-icon name="arrow_forward"/></span></RouterLink>
        <div class="channel-shortcuts"><RouterLink v-if="canArea(auth.user, 'notifications')" to="/notifications"><q-icon name="send"/> Notificações</RouterLink></div>
      </article>
    </div>
    <main v-else class="mobile-app-content" :class="`mobile-app-content--${channel}`"><WebInbox v-if="channel === 'web'" inbox-only/><CloudInbox v-else embedded/></main>
    <ConversationSignature ref="webProfile" picker-only @selected="enterWeb"/>
  </section>
</template>
<style scoped>
.mobile-app-header .mobile-app-brand{min-width:0;flex:1}.mobile-app-header .mobile-app-brand>span{min-width:0}.mobile-app-header .mobile-app-brand strong{max-width:100%}.mobile-app-header>.q-btn{flex:none}

.mobile-app-brand strong{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mobile-channel-picker:has(>.mobile-channel:only-child){grid-template-columns:1fr;grid-template-rows:1fr}
.mobile-channel-main{display:flex;flex-direction:column;align-items:center;color:inherit;text-decoration:none;width:100%;border-radius:16px}.mobile-channel-main>.q-icon{font-size:88px}.mobile-channel-main:focus-visible,.channel-shortcuts a:focus-visible{outline:3px solid white;outline-offset:4px}.channel-shortcuts{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;margin-top:14px}.channel-shortcuts a{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:9px 14px;border-radius:14px;background:#ffffff19;color:#fff;text-decoration:none;font-size:12px;font-weight:650;border:1px solid #ffffff35}.channel-shortcuts a:hover{background:#ffffff2b}
.mobile-app-header nav a{position:relative}.channel-unread{position:absolute;top:-3px;right:-3px;display:grid;place-items:center;min-width:15px;height:15px;padding:0 3px;border-radius:9px;color:white;font-size:9px;font-weight:800;line-height:1;border:1px solid white;box-shadow:0 1px 3px #143b3425}.channel-unread--web{background:#087e59}.channel-unread--cloud{background:#1673bf}
.mobile-app{height:var(--mobile-app-height,100dvh);box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:#eef7f4;color:#143b34;padding-top:env(safe-area-inset-top)}
.mobile-app-header{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px clamp(12px,3vw,36px);background:#fff;flex:none;border-bottom:1px solid #dfebe7}
.mobile-app-brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;min-width:0}.mobile-app-brand img{height:48px;width:48px;border-radius:16px}.mobile-app-brand strong,.mobile-app-brand small{display:block}.mobile-app-brand strong{font-size:20px;letter-spacing:-.6px}.mobile-app-brand small{font-size:11px;color:#6e827c}
.mobile-app-header nav{display:flex;gap:6px}.mobile-app-header nav a{padding:9px 13px;border-radius:24px;text-decoration:none;color:#45635a;font-weight:700;font-size:13px;white-space:nowrap}.mobile-app-header nav a.active{background:#e6f6ef;color:#0a624a}.mobile-dashboard-link{display:flex;gap:8px;align-items:center;text-decoration:none;color:#326856;font-size:12px}
.mobile-channel-picker{flex:1;min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(220px,1fr);overflow-y:auto;gap:14px;padding:18px;padding-bottom:max(18px,env(safe-area-inset-bottom))}
.mobile-channel{min-width:0;position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:32px 20px;border-radius:30px;color:#fff;text-decoration:none;text-align:center;transition:transform .2s,box-shadow .2s}
.mobile-channel--telegram{background:linear-gradient(145deg,#075778,#169ac6)}.mobile-channel--gmail{background:linear-gradient(145deg,#7d2335,#cf6654)}
.mobile-channel:focus-visible{outline:4px solid #0d1714;outline-offset:3px}.mobile-channel:hover{transform:translateY(-3px);box-shadow:0 20px 40px #0d463221}.mobile-channel::after{content:'';position:absolute;width:420px;height:420px;border:70px solid #ffffff0b;border-radius:50%;right:-230px;bottom:-210px;z-index:-1}.mobile-channel--web{background:linear-gradient(145deg,#073e35,#008f74)}.mobile-channel--cloud{background:linear-gradient(145deg,#101f4d,#146fbc)}
.channel-eyebrow{font-size:10px;letter-spacing:2px;font-weight:750;opacity:.7;margin-bottom:22px}.mobile-channel>.q-icon{font-size:88px}.mobile-channel h1{font-size:clamp(28px,3.5vw,52px);line-height:1.15;letter-spacing:-1px;font-weight:780;margin:20px 0 12px}.mobile-channel p{font-size:14px;margin:0;opacity:.76}.channel-enter{display:inline-flex;gap:16px;align-items:center;padding:12px 20px;margin-top:36px;border:1px solid #ffffff4a;border-radius:30px;font-size:13px;font-weight:650}
.mobile-app-content{flex:1;min-height:0;overflow:hidden;display:flex}.mobile-app-content :deep(.web-workspace--unified){width:100%;height:100%;min-height:0!important;padding:0!important;display:flex;flex-direction:column}.mobile-app-content :deep(.web-workspace-header),.mobile-app-content :deep(.workspace-tabs),.mobile-app-content :deep(.mobile-workspace-navigation){display:none!important}.mobile-app-content :deep(.workspace-content){min-height:0;flex:1;display:flex;overflow:hidden;padding:0!important}.mobile-app-content :deep(.chat-page-header){display:none}.mobile-app-content :deep(.chat-shell){border-radius:0}.mobile-app-content :deep(.embedded-chats){display:flex;flex:1;min-height:0;flex-direction:column;width:100%;padding:0!important;overflow:hidden}.mobile-app-content :deep(.chats-shell){flex:1;min-height:0;height:100%;border-radius:0}.mobile-app-content :deep(.conversation-header){flex-wrap:wrap}.mobile-app-content :deep(.chat-sidebar){min-height:0}.mobile-app-content :deep(.message-stream){overscroll-behavior:contain}
.mobile-channel{padding:20px 14px;border-radius:24px}.mobile-channel-main>.q-icon{font-size:48px}.mobile-channel h1{font-size:clamp(22px,2.6vw,34px);margin:12px 0 8px}.mobile-channel p{font-size:12px}.channel-eyebrow{margin-bottom:10px}.channel-enter{margin-top:16px;padding:9px 15px}.channel-shortcuts{margin-top:10px}.channel-shortcuts a{padding:7px 10px;min-height:32px;font-size:11px}
@media(max-width:700px){.mobile-channel-picker{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(220px,1fr));gap:10px;padding:10px;padding-bottom:max(10px,env(safe-area-inset-bottom))}.mobile-channel{padding:18px;border-radius:24px}.mobile-channel>.q-icon{font-size:56px}.mobile-channel h1{font-size:30px;margin:10px 0 6px}.mobile-channel p{font-size:12px}.channel-eyebrow{margin-bottom:12px;font-size:9px}.channel-enter{margin-top:18px;padding:8px 16px;font-size:12px}.mobile-app-header{min-height:66px;padding:7px 10px}.mobile-app-brand img{width:40px;height:40px;border-radius:13px}.mobile-app-brand strong{font-size:17px}.mobile-app-brand small{max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px}.mobile-dashboard-link span{display:none}.mobile-app--inbox .mobile-app-brand small{display:none}.mobile-app-header nav a{padding:9px;font-size:12px}.mobile-app-content{padding-bottom:env(safe-area-inset-bottom)}}
@media(prefers-reduced-motion:reduce){.mobile-channel{transition:none}}
@media(max-width:700px){.mobile-channel-picker{grid-template-rows:repeat(2,minmax(220px,1fr));overflow-y:auto}.mobile-channel-main>.q-icon{font-size:38px}.mobile-channel h1{font-size:22px;letter-spacing:-.5px}.mobile-channel{padding:16px 10px;border-radius:20px}.mobile-channel p{font-size:10px;line-height:1.5}.channel-enter{padding:7px 10px;gap:6px;font-size:10px}.channel-eyebrow{font-size:8px;letter-spacing:1px}.channel-shortcuts a{font-size:9px!important;padding:5px 7px!important;min-height:29px!important}.channel-shortcuts{gap:4px!important}.channel-eyebrow{margin-bottom:8px}.channel-enter{margin-top:14px}.channel-shortcuts{margin-top:10px;gap:6px}.channel-shortcuts a{font-size:11px;padding:8px 11px;min-height:36px}}
.mobile-app-content--cloud :deep(.conversation-panel){display:flex;flex-direction:column;min-height:0!important;height:100%;overflow:hidden}.mobile-app-content--cloud :deep(.message-stream){flex:1;min-height:0;max-height:none;overflow:auto;padding:14px}.mobile-app-content--cloud :deep(.message-composer){flex:none;max-height:48%;overflow:auto}.mobile-app-content--cloud :deep(.chat-sidebar){height:100%;display:flex;flex-direction:column;overflow:hidden}.mobile-app-content--cloud :deep(.chat-list){flex:1;max-height:none;min-height:0;overflow:auto}.mobile-app-content--cloud :deep(.conversation-header){padding:10px;gap:8px}.mobile-app-content--cloud :deep(.conversation-identity){flex:1;min-width:0}.mobile-app-content--cloud :deep(.identity-flags){max-width:100%;overflow:hidden}.mobile-app-content--cloud :deep(.q-banner){font-size:12px;flex:none}.mobile-app-content--cloud :deep(.composer-controls){flex-wrap:wrap}
@media(max-width:850px){.mobile-app-content--cloud :deep(.chats-shell){display:block}.mobile-app-content--cloud :deep(.conversation-panel){display:none}.mobile-app-content--cloud :deep(.chats-shell--conversation-mobile .conversation-panel){display:flex}.mobile-app-content--cloud :deep(.chats-shell--conversation-mobile .chat-sidebar){display:none}.mobile-app-content--cloud :deep(.conversation-header .q-space){display:none}.mobile-app-content--cloud :deep(.conversation-header .q-btn){min-width:32px;min-height:32px;padding:4px}.mobile-app-content--cloud :deep(.identity-flags .q-badge){font-size:10px}}
</style>
