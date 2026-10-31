<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { inPrototype, prototypeAuth } from '../../services/prototype-runtime.js'
import { routeAllowed } from '../../services/access.js'
import ChatsPage from './pages/ChatsPage.vue'
import WhiteLabelBrand from '../../components/WhiteLabelBrand.vue'
import { api, currentUser, messageOf, socket, startSessionListeners, stopSessionListeners } from './services.js'
import { clearAuthenticatedMedia } from './authenticated-media.js'
import './styles.css'
import './mobile-layout.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps({ collaboratorOnly: Boolean, inboxOnly: Boolean, previewPage: [Object, Function], previewVisited: { type: Array, default: () => [] } })
const route = useRoute()
const webBase = inPrototype() ? '/prototype/whatsapp-web' : '/whatsapp-web'
if (inPrototype()) currentUser.value = prototypeAuth.user
const webVisited = item => props.previewVisited.includes('whatsapp-web' + item.path)
const ready = ref(false)
const connected = ref(false)
const loginBusy = ref(false)
const error = ref('')
const licenseActive = ref(true)
const workspace = ref(null)
const navigationOpen = ref(false)
const conversationSelected = ref(false)
let previousViewportHeight = ''
const chatView = computed(() => Boolean(props.inboxOnly || (inPrototype() && route.path === '/prototype/whatsapp-web') || route.meta.whatsappWebChat || (props.collaboratorOnly && currentUser.value)))
provide('whatsapp-web:conversation-selected', (value) => { conversationSelected.value = Boolean(value) })
const loginForm = ref({ username: '', password: '' })
const navigation = [
  { path: '', label: 'Conversas', icon: 'forum' },
  { path: '/connection', label: 'Conexão', icon: 'qr_code_2' },
  { path: '/flows', label: 'Fluxos e simulador', icon: 'account_tree' },
  { path: '/native-flows', label: 'Comandos nativos', icon: 'terminal' },
  { path: '/contacts', label: 'Contatos e grupos', icon: 'contacts' },
  { path: '/catalog', label: 'Catálogo e pedidos', icon: 'storefront' },
  { path: '/files', label: 'Arquivos', icon: 'perm_media' },
  { path: '/integrations', label: 'Integrações', icon: 'hub' },
  { path: '/logs', label: 'Monitoramento e logs', icon: 'monitor_heart' },
  { path: '/settings', label: 'Configurações', icon: 'settings' },
]
const visibleNavigation = computed(() => navigation.filter(item => routeAllowed('/whatsapp-web'+item.path,currentUser.value)))
const primaryNavigation = computed(() => visibleNavigation.value.filter(item => ['', '/connection', '/flows'].includes(item.path)))
const secondaryNavigation = computed(() => visibleNavigation.value.filter(item => !primaryNavigation.value.includes(item)))

function updateViewport() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight
  workspace.value?.style.setProperty('--web-viewport-height', `${Math.round(viewportHeight)}px`)
  document.documentElement.style.setProperty('--web-viewport-height', `${Math.round(viewportHeight)}px`)
}
watch(() => route.path, () => { navigationOpen.value = false; conversationSelected.value = false })

function onStatus(status) { connected.value = Boolean(status.ready) }
async function loadSession() {
  try {
    currentUser.value = (await api.get('/auth/me')).data.user
    socket.connect()
    if (currentUser.value?.role === 'admin') {
      const [status, license] = await Promise.allSettled([api.get('/whatsapp/status'), api.get('/license/status')])
      if (status.status === 'fulfilled') onStatus(status.value.data)
      if (license.status === 'fulfilled') licenseActive.value = license.value.data.active === true
    }
  } catch (cause) {
    if (!props.collaboratorOnly) error.value = messageOf(cause)
  } finally { ready.value = true }
}
async function login() {
  loginBusy.value = true
  error.value = ''
  try {
    currentUser.value = (await api.post('/auth/login', loginForm.value)).data.user
    loginForm.value.password = ''
    socket.connect()
  } catch (cause) { error.value = messageOf(cause) }
  finally { loginBusy.value = false }
}
async function logout() {
  try { await api.post('/auth/logout') }
  finally { currentUser.value = null; socket.disconnect() }
}
onMounted(() => {
  previousViewportHeight = document.documentElement.style.getPropertyValue('--web-viewport-height')
  startSessionListeners(props)
  socket.on('whatsapp:status', onStatus)
  loadSession()
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
})
onBeforeUnmount(() => {
  socket.off('whatsapp:status', onStatus)
  clearAuthenticatedMedia()
  stopSessionListeners()
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  if (previousViewportHeight) document.documentElement.style.setProperty('--web-viewport-height', previousViewportHeight)
  else document.documentElement.style.removeProperty('--web-viewport-height')
})
</script>

<template>
  <section ref="workspace" class="whatsapp-web-workspace web-workspace--unified" :class="{ 'web-workspace--chat': chatView, 'web-workspace--conversation': conversationSelected, 'web-workspace--standalone': collaboratorOnly }">
    <header class="web-workspace-header">
      <WhiteLabelBrand v-if="collaboratorOnly" compact />
      <div><h1>{{ collaboratorOnly ? 'Central de atendimento' : 'WhatsApp Web' }}</h1><p>{{ collaboratorOnly ? (currentUser?.nick || currentUser?.name || 'Acesso da equipe') : 'Conversas, equipe e automações em um só lugar' }}</p></div>
      <span :class="['status-chip', { warn: !connected }]"><i class="status-dot"></i>{{ connected ? 'Sessão conectada' : 'Sessão desconectada' }}</span>
    </header>
    <p v-if="!ready" class="card empty" role="status">Carregando canal…</p>
    <form v-else-if="!currentUser && collaboratorOnly" class="card web-login" @submit.prevent="login">
      <h2>Acesso do colaborador</h2><p>Use sua conta individual de atendimento.</p>
      <div class="field"><label for="web-collaborator-login">Login</label><input id="web-collaborator-login" v-model="loginForm.username" autocomplete="username" required></div>
      <div class="field"><label for="web-collaborator-password">Senha</label><input id="web-collaborator-password" v-model="loginForm.password" type="password" autocomplete="current-password" required></div>
      <p v-if="error" role="alert">{{ error }}</p><button class="btn" :disabled="loginBusy">{{ loginBusy ? 'Entrando…' : 'Entrar' }}</button>
    </form>
    <div v-else-if="!currentUser" class="card empty"><p role="alert">{{ error || 'Não foi possível abrir o canal.' }}</p><button class="btn" @click="loadSession">Tentar novamente</button></div>
    <template v-else>
      <aside v-if="!licenseActive" class="card web-license-notice" role="status"><strong>Canal aguardando ativação</strong><p>Ative a licença do WhatsApp Web nas configurações da instalação para conectar o aparelho e usar as automações.</p></aside>
      <div v-if="collaboratorOnly" class="web-collaborator-session"><span>{{ currentUser.nick || currentUser.name }}</span><button class="btn secondary" @click="logout">Sair do atendimento</button></div>
      <nav v-if="!collaboratorOnly && visibleNavigation.length" class="workspace-tabs" aria-label="Áreas do WhatsApp Web">
        <RouterLink v-for="item in primaryNavigation" :key="item.path" :to="`${webBase}${item.path}`" active-class="" exact-active-class="tab-active" :class="{ 'tab-active': item.path === '/flows' && route.path.startsWith(webBase+'/flows') }"><span class="material-icons" aria-hidden="true">{{ item.icon }}</span><span>{{ item.label }}</span><q-icon v-if="webVisited(item)" name="check" size="13px" color="teal"/></RouterLink>
        <q-btn v-if="secondaryNavigation.length" flat no-caps icon="apps" label="Mais ferramentas" class="workspace-tools-button"><q-menu auto-close><q-list class="workspace-tools-menu"><q-item v-for="item in secondaryNavigation" :key="item.path" clickable :to="`${webBase}${item.path}`"><q-item-section avatar><q-icon :name="item.icon" /></q-item-section><q-item-section>{{ item.label }}</q-item-section><q-item-section v-if="webVisited(item)" side><q-icon name="check" size="13px" color="teal"/></q-item-section></q-item></q-list></q-menu></q-btn>
      </nav>
      <nav v-if="!collaboratorOnly && visibleNavigation.length" class="mobile-workspace-navigation" aria-label="Navegação do WhatsApp Web">
        <RouterLink v-if="routeAllowed('/whatsapp-web',currentUser)" :to="webBase" active-class="" exact-active-class="router-link-active"><span class="material-icons" aria-hidden="true">forum</span>Conversas</RouterLink>
        <RouterLink v-if="routeAllowed('/whatsapp-web/connection',currentUser)" :to="webBase+'/connection'" active-class="" exact-active-class="router-link-active"><span class="material-icons" aria-hidden="true">qr_code_2</span>Conexão</RouterLink>
        <button type="button" aria-label="Mais áreas do WhatsApp Web" :aria-expanded="navigationOpen" @click="navigationOpen = true"><span class="material-icons" aria-hidden="true">apps</span>Mais</button>
      </nav>
      <main class="workspace-content"><component :is="previewPage" v-if="previewPage"/><ChatsPage v-else-if="inboxOnly || collaboratorOnly"/><RouterView v-else /></main>
    </template>
    <q-dialog v-model="navigationOpen" position="bottom">
      <div class="whatsapp-web-workspace web-navigation-sheet">
        <header><h2>WhatsApp Web</h2><button class="icon-button" aria-label="Fechar áreas do WhatsApp Web" @click="navigationOpen = false">×</button></header>
        <nav aria-label="Todas as áreas do WhatsApp Web"><RouterLink v-for="item in visibleNavigation" :key="item.path" :to="`${webBase}${item.path}`" @click="navigationOpen = false"><span class="material-icons" aria-hidden="true">{{ item.icon }}</span><span>{{ item.label }}</span><q-icon v-if="webVisited(item)" name="check" size="13px" color="teal"/></RouterLink></nav>
        <span :class="['status-chip', { warn: !connected }]"><i class="status-dot"></i>{{ connected ? 'Sessão conectada' : 'Sessão desconectada' }}</span>
      </div>
    </q-dialog>
  </section>
</template>
