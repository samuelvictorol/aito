<script>
let lastShown = 0
</script>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { usd } from 'src/composables/useAitoIA'
import { codexOfferDelay, codexOfferInterval, codexOfficialUrl, codexProductPath, offersCodex } from 'src/services/aitoCodexInstall'
import AuthDialog from 'components/AuthDialog.vue'
import AitoCodexInstallDialog from './AitoCodexInstallDialog.vue'
import AitoCodexInstallVideo from './AitoCodexInstallVideo.vue'

const route = useRoute()
const router = useRouter()
const open = ref(false)
const authOpen = ref(false)
const installGuide = ref(false)
const offers = ref([])
const profilePath = '/app?tab=profile'
const eligibleRoute = computed(() => offersCodex(route, false))
let timer
let offersRequest

function readStorage(key) {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function schedule(delay) {
  window.clearTimeout(timer)
  timer = window.setTimeout(checkOffer, delay)
}

function checkOffer() {
  if (!eligibleRoute.value) return
  if (readStorage('aito_admin_token')) return schedule(codexOfferInterval)
  const now = Date.now()
  const remaining = codexOfferDelay(now, lastShown)
  if (remaining) return schedule(remaining)
  if (open.value || authOpen.value || installGuide.value || document.visibilityState !== 'visible' ||
      document.activeElement?.matches('input, textarea, select, [contenteditable]') || document.querySelector('.q-dialog__inner')) {
    return schedule(15_000)
  }
  lastShown = now
  open.value = true
  schedule(codexOfferInterval)
  loadOffers()
}

async function loadOffers() {
  if (offers.value.length || offersRequest) return
  const controller = new AbortController()
  offersRequest = controller
  try {
    const { data } = await api.get('/aitoia/packages', { signal: controller.signal })
    offers.value = data.data?.plans || []
  } catch { /* The guide and download remain available. */ }
  finally { offersRequest = null }
}

function openProfile() {
  open.value = false
  if (readStorage('aito_user_token')) router.push(profilePath)
  else authOpen.value = true
}

function openInstallGuide() {
  open.value = false
  installGuide.value = true
}

watch(() => route.fullPath, () => {
  if (typeof window === 'undefined') return
  window.clearTimeout(timer)
  open.value = false
  if (eligibleRoute.value) schedule(1500)
}, { immediate: true })

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  offersRequest?.abort()
})
</script>

<template>
  <q-dialog v-model="open">
    <q-card dark class="codex-offer">
      <header class="codex-offer__header">
        <img src="/codex-app-icon.png" alt="" width="44" height="44" />
        <q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar oferta" />
      </header>
      <h2>Codex com AitoTokens</h2>
      <p>Use o app oficial do Codex para Windows com o saldo da sua conta AitoSoftwares e pague conforme o uso.</p>
      <div class="codex-offer__actions">
        <q-btn unelevated no-caps icon="mdi-download" label="Baixar plugin e guia" class="codex-offer__primary" @click="openInstallGuide" />
        <a :href="codexOfficialUrl" target="_blank" rel="noopener noreferrer">Baixar Codex oficial <q-icon name="mdi-arrow-top-right" /></a>
      </div>
      <AitoCodexInstallVideo class="codex-offer__tutorial" />
      <div class="codex-offer__footer">
        <q-btn flat no-caps icon="mdi-key-outline" label="Obter minha AitoKey" @click="openProfile" />
        <router-link v-close-popup :to="codexProductPath" class="codex-offer__packs">Conhecer o plugin</router-link>
        <router-link v-if="offers.length" v-close-popup to="/aitotokens" class="codex-offer__packs">
          Recargas {{ offers.map(offer => usd(offer.usdCents)).join(' · ') }}
        </router-link>
      </div>
    </q-card>
  </q-dialog>
  <AitoCodexInstallDialog v-model="installGuide" />
  <AuthDialog v-model="authOpen" :return-path="profilePath" :show-project-login="false" @authenticated="router.push(profilePath)" />
</template>

<style scoped>
.codex-offer { width: min(520px, 100%); padding: clamp(16px, 4vw, 26px); border: 1px solid #cdaa6666; border-radius: 18px; background: radial-gradient(ellipse at top left, #48371e, transparent 60%), #091a19; color: #f2fcf7; }
.codex-offer__header { display: flex; align-items: center; justify-content: space-between; }
.codex-offer h2 { margin: 9px 0 7px; font-size: clamp(1.35rem, 5vw, 1.95rem); font-weight: 760; line-height: 1.15; }
.codex-offer p { margin: 0 0 14px; color: #bdd3cb; }
.codex-offer a { color: #f7d890; }
.codex-offer__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.codex-offer__actions a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; padding: 7px 10px; border: 1px solid #cdaa6666; border-radius: 9px; text-decoration: none; font: inherit; font-weight: 700; }
.codex-offer .codex-offer__primary { min-height: 42px; border-radius: 9px; color: #271a04; background: linear-gradient(125deg, #ffe9a9, #dba653); font-weight: 700; }
.codex-offer__tutorial { margin: 1rem auto .75rem; }
.codex-offer__footer { display: flex; flex-wrap: wrap; align-items: center; column-gap: 9px; margin-top: 9px; color: #f7d890; }
.codex-offer__footer .q-btn { padding-inline: 0; }
.codex-offer .codex-offer__packs { font-size: .75rem; color: #bdd3cb; text-underline-offset: 3px; }
</style>
