<template>
  <AitoIAMaintenance v-if="maintenance || checkingAvailability" :area="maintenance" :checking="checkingAvailability" @retry="refreshAvailability" />
  <router-view v-else v-slot="{ Component }">
    <component :is="Component">
      <template v-if="canPromoteInstall && route.name === 'landing-3d'" #install-aitoia>
        <button type="button" class="aito-install-button aito-install-button--landing" @click="installOpen = true"><q-icon name="mdi-download-box-outline" size="18px" /> Instalar Aito IA</button>
      </template>
    </component>
  </router-view>
  <CosmicScene v-if="screenLoading"/>
  <AitoInstallDialog v-if="canPromoteInstall || installOpen" v-model="installOpen" :platform="platform" :native-prompt="!!installEvent" :installing="installing" @install="installAitoIA" />
  <AitoCodexOffer v-if="!themePage && !screenLoading && !maintenance && !checkingAvailability && route.meta.requiresAuth !== 'admin'" />
  <AdminProviderAlert v-if="route.meta.requiresAuth === 'admin'" />
  <AitoSupportShortcut v-if="showSupportShortcut" />
  <button v-if="canPromoteInstall && route.name !== 'landing-3d'" type="button" class="aito-install-button" :class="{ 'aito-install-button--workspace': route.name?.startsWith('aito-ia') }" @click="installOpen = true"><q-icon name="mdi-download-box-outline" size="18px" /> Instalar Aito IA</button>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import CosmicScene from './components/CosmicScene.vue'
import {screenLoading} from './services/screen-loading'
import { installPlatform, isInstalledAito, offersAitoInstall } from './services/aitoInstall'
import { siteManifest } from './services/siteManifest'
import AitoIAMaintenance from './components/AitoIAMaintenance.vue'
import { useAitoAvailabilityBoundary } from './composables/useAitoAvailability'
import { useRoute, useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const { maintenance, checkingAvailability, refreshAvailability } = useAitoAvailabilityBoundary(route, router)
const AitoInstallDialog = defineAsyncComponent(() => import('./components/AitoInstallDialog.vue'))
const AitoCodexOffer = defineAsyncComponent(() => import('./components/AitoCodexOffer.vue'))
const AdminProviderAlert = defineAsyncComponent(() => import('./components/AdminProviderAlert.vue'))
const AitoSupportShortcut = defineAsyncComponent(() => import('./components/AitoSupportShortcut.vue'))
const installEvent = shallowRef(null)
const installOpen = ref(false)
const installing = ref(false)
const installed = ref(typeof window !== 'undefined' && isInstalledAito(window))
const platform = typeof navigator === 'undefined' ? 'desktop' : installPlatform(navigator)
const themePage = computed(() => route.name === 'aito-codex-theme')
const isAitoManifest = computed(() => siteManifest(route).url === '/aitoia.webmanifest')
const hasInstallShortcut = computed(() => route.name === 'landing-3d' || offersAitoInstall(route) ||
  (route.name !== 'aito-ia-video-studio' && Boolean(installEvent.value)))
const canPromoteInstall = computed(() => !themePage.value && isAitoManifest.value && !installed.value && !screenLoading.value && !maintenance.value && !checkingAvailability.value && hasInstallShortcut.value)
const installOfferKey = 'aito.install-offer.v1'
const customerSession = ref(false)
const showSupportShortcut = computed(() => !themePage.value && customerSession.value && !screenLoading.value &&
  route.meta.requiresAuth !== 'admin' && route.meta.requiresAuth !== 'affiliate' &&
  route.name !== 'admin-login' && route.name !== 'affiliate-login')
let offerShown = false
let offerTimer

function refreshCustomerSession() {
  if (typeof window === 'undefined') return
  try { customerSession.value = Boolean(localStorage.getItem('aito_user_token') && !localStorage.getItem('aito_admin_token')) }
  catch { customerSession.value = false }
}

function captureInstall(event) {
  if (document.querySelector('link[rel="manifest"]')?.getAttribute('href') !== '/aitoia.webmanifest') return
  event.preventDefault()
  installEvent.value = event
}
function markInstalled() {
  if (!isAitoManifest.value) return
  installed.value = true
  installEvent.value = null
  installOpen.value = false
}
async function installAitoIA() {
  const prompt = installEvent.value
  if (!prompt || !isAitoManifest.value || installing.value) return
  installing.value = true
  installEvent.value = null
  try {
    const choice = await prompt.prompt() || await prompt.userChoice
    if (choice?.outcome === 'accepted') markInstalled()
  } catch { /* The dialog switches to browser-specific instructions. */ }
  finally { installing.value = false }
}

watch(() => route.fullPath, () => { installOpen.value = false })
watch(() => route.fullPath, refreshCustomerSession, { immediate: true })
watch(isAitoManifest, active => { if (!active) installEvent.value = null })
watch([() => route.fullPath, screenLoading], ([, loading]) => {
  if (typeof window === 'undefined') return
  window.clearTimeout(offerTimer)
  if (!offersAitoInstall(route) || loading || installed.value || offerShown) return
  try { if (sessionStorage.getItem(installOfferKey)) return } catch { /* Storage is optional. */ }
  offerTimer = window.setTimeout(() => {
    if (installed.value || !offersAitoInstall(route) || !isAitoManifest.value || document.visibilityState !== 'visible' ||
        document.activeElement?.matches('input, textarea, select, [contenteditable]') || document.querySelector('.q-dialog__inner')) return
    offerShown = true
    try { sessionStorage.setItem(installOfferKey, '1') } catch { /* Keep the offer dismissed in memory. */ }
    installOpen.value = true
  }, 800)
}, { immediate: true })

function handleSessionExpired(event) {
  refreshCustomerSession()
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
  window.addEventListener('aito:session-changed', refreshCustomerSession)
  window.addEventListener('storage', refreshCustomerSession)
  window.addEventListener('beforeinstallprompt', captureInstall)
  window.addEventListener('appinstalled', markInstalled)
}
onBeforeUnmount(() => {
  window.removeEventListener('aito:session-expired', handleSessionExpired)
  window.removeEventListener('aito:session-changed', refreshCustomerSession)
  window.removeEventListener('storage', refreshCustomerSession)
  window.removeEventListener('beforeinstallprompt', captureInstall)
  window.removeEventListener('appinstalled', markInstalled)
  window.clearTimeout(offerTimer)
})
</script>

<style scoped>
.aito-install-button { position: fixed; top: calc(72px + env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); z-index: 20; display: flex; align-items: center; gap: .4rem; padding: .45rem .65rem; border: 1px solid #5ead9e; border-radius: .55rem; background: #0c2a28; color: #c0fcf0; cursor: pointer; font: inherit; font-size: .75rem; }
.aito-install-button--landing { position: static; pointer-events: auto; }
@media (max-width: 670px) {
  .aito-install-button--workspace { top: calc(105px + env(safe-area-inset-top)); }
}
</style>
