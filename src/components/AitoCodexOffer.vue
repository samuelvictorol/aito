<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import { aitoTokens, brl, usd } from 'src/composables/useAitoIA'

const route = useRoute()
const open = ref(false)
const offers = ref([])
const offerError = ref(false)
const promotedRoutes = new Set(['aito-tokens-product', 'user-app', 'aito-ia', 'aito-ia-marketing-studio'])
let timer
let offersRequest

async function show() {
  if (open.value || document.visibilityState !== 'visible') return
  open.value = true
  if (offers.value.length || offersRequest) return
  offerError.value = false
  const controller = new AbortController()
  offersRequest = controller
  try {
    const { data } = await api.get('/aitoia/packages', { signal: controller.signal })
    offers.value = data.data?.plans || []
  } catch {
    if (!controller.signal.aborted) offerError.value = true
  } finally { offersRequest = null }
}

watch(() => route.name, name => {
  window.clearInterval(timer)
  open.value = false
  if (!promotedRoutes.has(name)) return
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
        <img src="/aitotokens.svg" alt="" width="44" height="44" />
        <q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar oferta" />
      </header>
      <h2>Use o Codex com AitoTokens</h2>
      <p>Trabalhe nos seus repositórios com o Codex oficial e pague pelo uso do modelo. Use o plugin da AitoSoftwares para consultar saldo, recarregar e, quando habilitado, gerar vídeos Higgsfield com a mesma AitoKey.</p>
      <div class="codex-offer__model"><q-icon name="mdi-brain" /> GPT‑6.1 Sol <small>Modelo disponível na integração</small></div>
      <ul v-if="offers.length" class="codex-offer__plans" aria-label="Pacotes AitoTokens">
        <li v-for="offer in offers" :key="offer.usdCents">
          <strong>{{ usd(offer.usdCents) }}</strong>
          <span>{{ brl(offer.brlCents) }}</span>
          <small>≈ {{ aitoTokens(offer.approximateTokens) }} AitoTokens</small>
        </li>
      </ul>
      <p v-else-if="offerError" role="status">Consulte os pacotes na <router-link to="/aitotokens">página de AitoTokens</router-link>.</p>
      <div class="codex-offer__actions">
        <a class="codex-offer__primary" href="/downloads/aitoia-codex.zip" download><q-icon name="mdi-download" /> Baixar plugin (.zip)</a>
        <a href="https://openai.com/codex/" target="_blank" rel="noopener noreferrer"><q-icon name="mdi-console-line" /> Baixar Codex</a>
      </div>
      <small class="codex-offer__note">O ZIP inclui o guia de instalação. Para usar o modelo, você precisa de uma AitoKey de projeto com o piloto liberado.</small>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.codex-offer { width: min(520px, 100%); padding: clamp(16px, 4vw, 26px); border: 1px solid #cdaa6666; border-radius: 18px; background: radial-gradient(ellipse at top left, #48371e, transparent 60%), #091a19; color: #f2fcf7; }
.codex-offer__header { display: flex; align-items: center; justify-content: space-between; }
.codex-offer h2 { margin: 9px 0 7px; font-size: clamp(1.35rem, 5vw, 1.95rem); font-weight: 760; line-height: 1.15; }
.codex-offer p { margin: 0 0 14px; color: #bdd3cb; }
.codex-offer a { color: #f7d890; }
.codex-offer__model { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 8px; margin: 10px 0 12px; color: #ffdf96; font-weight: 700; }
.codex-offer__model small { color: #bdd3cb; font-weight: 450; }
.codex-offer__plans { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0 0 14px; padding: 0; list-style: none; }
.codex-offer__plans li { display: grid; gap: 3px; padding: 8px 6px; border: 1px solid #5a5540; border-radius: 8px; background: #c3a05a16; }
.codex-offer__plans small { color: #bdd3cb; font-size: .7rem; }
.codex-offer__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.codex-offer__actions a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; padding: 7px 10px; border: 1px solid #cdaa6666; border-radius: 9px; text-decoration: none; font: inherit; font-weight: 700; }
.codex-offer .codex-offer__primary { color: #271a04; background: linear-gradient(125deg, #ffe9a9, #dba653); }
.codex-offer__note { display: block; margin-top: 10px; color: #bdd3cb; }
@media (max-width: 460px) { .codex-offer__plans { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
