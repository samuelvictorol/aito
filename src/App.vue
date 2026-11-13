<template>
  <router-view /><CosmicScene v-if="screenLoading"/>
  <AitoCodexOffer />
  <AdminProviderAlert v-if="route.meta.requiresAuth === 'admin'" />
  <button v-if="installEvent && canPromoteInstall" type="button" class="aito-install-button" @click="installAitoIA"><q-icon name="mdi-download-box-outline" size="18px" /> Instalar Aito IA</button>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import CosmicScene from './components/CosmicScene.vue'
import {screenLoading} from './services/screen-loading'
import { useRoute, useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const AitoCodexOffer = defineAsyncComponent(() => import('./components/AitoCodexOffer.vue'))
const AdminProviderAlert = defineAsyncComponent(() => import('./components/AdminProviderAlert.vue'))
const installEvent = shallowRef(null)
const isAitoManifest = computed(() => !route.path.startsWith('/admin') && route.name !== 'notification-generator')
const canPromoteInstall = computed(() => isAitoManifest.value && !['aito-ia-video-studio', 'aito-ia-marketing-studio'].includes(route.name))

function captureInstall(event) {
  if (document.querySelector('link[rel="manifest"]')?.getAttribute('href') !== '/aitoia.webmanifest') return
  event.preventDefault()
  installEvent.value = event
}
function clearInstall() { installEvent.value = null }
async function installAitoIA() {
  const prompt = installEvent.value
  clearInstall()
  try { await prompt?.prompt() } catch { /* The browser may have invalidated the prompt. */ }
}
watch(isAitoManifest, active => { if (!active) clearInstall() })

function handleSessionExpired(event) {
  const loginPath = event.detail?.loginPath || '/?auth=login'
  $q.notify({
    type: 'warning',
    position: 'top',
    icon: 'mdi-login',
    timeout: 10000,
    message: 'Sua sessão expirou. Faça login novamente.',
    actions: [{ label: 'Fazer login', color: 'white', icon: 'mdi-login', handler: () => router.push(loginPath) }],
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('aito:session-expired', handleSessionExpired)
  window.addEventListener('beforeinstallprompt', captureInstall)
  window.addEventListener('appinstalled', clearInstall)
}
onBeforeUnmount(() => {
  window.removeEventListener('aito:session-expired', handleSessionExpired)
  window.removeEventListener('beforeinstallprompt', captureInstall)
  window.removeEventListener('appinstalled', clearInstall)
})
</script>

<style scoped>
.aito-install-button { position: fixed; top: calc(60px + env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); z-index: 20; display: flex; align-items: center; gap: .4rem; padding: .45rem .65rem; border: 1px solid #5ead9e; border-radius: .55rem; background: #0c2a28; color: #c0fcf0; cursor: pointer; font: inherit; font-size: .75rem; }
</style>
