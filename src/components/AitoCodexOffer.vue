<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { usd } from 'src/composables/useAitoIA'
import AuthDialog from 'components/AuthDialog.vue'

const route = useRoute()
const router = useRouter()
const open = ref(false)
const authOpen = ref(false)
const offers = ref([])
const profilePath = '/app?tab=profile'
const promotedRoutes = new Set(['aito-tokens-product', 'user-app', 'aito-ia', 'aito-ia-marketing-studio'])
const promoted = computed(() => promotedRoutes.has(route.name) && !(route.name === 'user-app' && route.query.tab === 'profile'))
let timer
let offersRequest

async function show() {
  if (open.value || authOpen.value || document.visibilityState !== 'visible' ||
      document.activeElement?.matches('input, textarea, select, [contenteditable]') || document.querySelector('.q-dialog__inner')) return
  open.value = true
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
  if (localStorage.getItem('aito_user_token')) router.push(profilePath)
  else authOpen.value = true
}

watch([() => route.name, promoted], ([, visible]) => {
  window.clearInterval(timer)
  open.value = false
  if (!visible) return
  show()
  timer = window.setInterval(show, 5 * 60 * 1000)
}, { immediate: true })

onBeforeUnmount(() => {
  window.clearInterval(timer)
  offersRequest?.abort()
})
</script>

<template>
  <q-dialog v-model="open">
    <q-card dark class="codex-offer">
      <header class="codex-offer__header">
        <img src="/aitotokens.svg" alt="AitoTokens" width="44" height="44" />
        <q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar oferta" />
      </header>
      <h2>Codex com AitoTokens</h2>
      <p>Use o GPT‑6.1 Sol no Codex com o saldo da sua conta AitoSoftwares.</p>
      <div class="codex-offer__actions">
        <a class="codex-offer__primary" href="/downloads/aitoia-codex.zip" download><q-icon name="mdi-download" /> Baixar plugin e guia</a>
        <a href="https://openai.com/codex/" target="_blank" rel="noopener noreferrer"><img src="/codex-app-icon.png" alt="" width="20" height="20" /> Baixar Codex</a>
      </div>
      <div class="codex-offer__footer">
        <q-btn flat no-caps icon="mdi-key-outline" label="Obter minha AitoKey" @click="openProfile" />
        <router-link v-if="offers.length" v-close-popup to="/aitotokens" class="codex-offer__packs">
          Recargas {{ offers.map(offer => usd(offer.usdCents)).join(' · ') }}
        </router-link>
      </div>
    </q-card>
  </q-dialog>
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
.codex-offer .codex-offer__primary { color: #271a04; background: linear-gradient(125deg, #ffe9a9, #dba653); }
.codex-offer__footer { display: flex; flex-wrap: wrap; align-items: center; column-gap: 9px; margin-top: 9px; color: #f7d890; }
.codex-offer__footer .q-btn { padding-inline: 0; }
.codex-offer .codex-offer__packs { font-size: .75rem; color: #bdd3cb; text-underline-offset: 3px; }
</style>
