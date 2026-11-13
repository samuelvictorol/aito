<template>
  <router-view v-slot="{ Component }">
    <component :is="Component">
      <template v-if="canPromoteInstall && route.name === 'landing-3d'" #install-aitoia>
        <button type="button" class="aito-install-button aito-install-button--landing" @click="installOpen = true"><q-icon name="mdi-download-box-outline" size="18px" /> Instalar Aito IA</button>
      </template>
    </component>
  </router-view>
  <CosmicScene v-if="screenLoading"/>
  <AitoInstallDialog v-if="canPromoteInstall || installOpen" v-model="installOpen" :platform="platform" :native-prompt="!!installEvent" :installing="installing" @install="installAitoIA" />
  <AdminProviderAlert v-if="route.meta.requiresAuth === 'admin'" />
  <button v-if="canPromoteInstall && route.name !== 'landing-3d'" type="button" class="aito-install-button" @click="installOpen = true"><q-icon name="mdi-download-box-outline" size="18px" /> Instalar Aito IA</button>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import CosmicScene from './components/CosmicScene.vue'
import {screenLoading} from './services/screen-loading'
import { installPlatform, isInstalledAito, offersAitoInstall } from './services/aitoInstall'
import { siteManifest } from './services/siteManifest'
import { useRoute, useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const AitoInstallDialog = defineAsyncComponent(() => import('./components/AitoInstallDialog.vue'))
const AdminProviderAlert = defineAsyncComponent(() => import('./components/AdminProviderAlert.vue'))
const installEvent = shallowRef(null)
const installOpen = ref(false)
const installing = ref(false)
const installed = ref(typeof window !== 'undefined' && isInstalledAito(window))
const platform = typeof navigator === 'undefined' ? 'desktop' : installPlatform(navigator)
const isAitoManifest = computed(() => siteManifest(route).url === '/aitoia.webmanifest')
const hasInstallShortcut = computed(() => route.name === 'landing-3d' || offersAitoInstall(route) ||
  (route.name !== 'aito-ia-video-studio' && Boolean(installEvent.value)))
const canPromoteInstall = computed(() => isAitoManifest.value && !installed.value && !screenLoading.value && hasInstallShortcut.value)
const installOfferKey = 'aito.install-offer.v1'
let offerShown = false
let offerTimer

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
  window.addEventListener('appinstalled', markInstalled)
}
onBeforeUnmount(() => {
  window.removeEventListener('aito:session-expired', handleSessionExpired)
  window.removeEventListener('beforeinstallprompt', captureInstall)
  window.removeEventListener('appinstalled', markInstalled)
  window.clearTimeout(offerTimer)
})
</script>

<style scoped>
.aito-install-button { position: fixed; top: calc(60px + env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); z-index: 20; display: flex; align-items: center; gap: .4rem; padding: .45rem .65rem; border: 1px solid #5ead9e; border-radius: .55rem; background: #0c2a28; color: #c0fcf0; cursor: pointer; font: inherit; font-size: .75rem; }
.aito-install-button--landing { position: static; pointer-events: auto; }
</style>
