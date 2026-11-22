<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { aitoTokens, brl, usd } from 'src/composables/useAitoIA'
import { aitoTokenPackagePresentation } from 'src/services/aitoTokenPackagePresentation'
import { GUEST_RECHARGE_DELAY, shouldOfferGuestRecharge } from 'src/services/aitoGuestRecharge'

const props = defineProps({ enabled: Boolean })
const AuthDialog = defineAsyncComponent(() => import('components/AuthDialog.vue'))
const route = useRoute()
const router = useRouter()
const open = ref(false)
const authOpen = ref(false)
const signedIn = ref(false)
const offers = ref(null)
const loading = ref(false)
const loadError = ref(false)
const selected = ref(500)
const plans = computed(() => (offers.value?.plans || []).map(plan => ({ ...plan, display: aitoTokenPackagePresentation(plan) })))
const returnPath = computed(() => `/aitotokens?pacote=${selected.value}`)
let timer
let request
let disposed = false

function session() {
  try { return { userToken: localStorage.getItem('aito_user_token'), adminToken: localStorage.getItem('aito_admin_token') } }
  catch { return {} }
}
function refreshSession() {
  const current = session()
  signedIn.value = Boolean(current.userToken || current.adminToken)
  if (signedIn.value) { clearTimeout(timer); open.value = false }
}
async function loadOffers() {
  request?.abort()
  const owner = new AbortController()
  request = owner
  loading.value = true
  loadError.value = false
  try {
    const { data } = await api.get('/aitoia/packages', { signal: owner.signal, timeout: 8000 })
    if (disposed || request !== owner) return
    offers.value = data.data
    if (!plans.value.some(plan => plan.usdCents === selected.value)) selected.value = plans.value[0]?.usdCents || 500
  } catch {
    if (!disposed && request === owner) loadError.value = true
  } finally {
    if (request === owner) { loading.value = false; request = null }
  }
}
function continueWithAccount() {
  open.value = false
  authOpen.value = true
}
function authenticated() {
  refreshSession()
  authOpen.value = false
  router.push(returnPath.value)
}

refreshSession()
watch([() => route.name, () => props.enabled, signedIn], () => {
  clearTimeout(timer)
  open.value = false
  if (!props.enabled || !shouldOfferGuestRecharge(route.name, session())) return
  timer = setTimeout(() => {
    if (!props.enabled || !shouldOfferGuestRecharge(route.name, session())) return
    open.value = true
    if (!offers.value) void loadOffers()
  }, GUEST_RECHARGE_DELAY)
}, { immediate: true })
window.addEventListener('storage', refreshSession)
window.addEventListener('aito:session-changed', refreshSession)
window.addEventListener('aito:session-expired', refreshSession)
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  request?.abort()
  window.removeEventListener('storage', refreshSession)
  window.removeEventListener('aito:session-changed', refreshSession)
  window.removeEventListener('aito:session-expired', refreshSession)
})
</script>

<template>
  <q-dialog v-model="open">
    <q-card class="guest-recharge">
      <header><img src="/aitotokens.svg" alt="" width="43" height="43" /><div><span>Uma carteira, várias possibilidades</span><h2>Crie com AitoTokens</h2></div><q-btn v-close-popup flat round icon="mdi-close" aria-label="Fechar pacotes de AitoTokens" /></header>
      <p>Use o chat, crie imagens e produza vídeos. Escolha uma recarga e entre ou crie sua conta para continuar.</p>
      <div v-if="loading" class="guest-recharge__status" role="status"><q-spinner size="26px" /> Carregando valores…</div>
      <div v-else-if="loadError || !plans.length" class="guest-recharge__status" role="alert">Não foi possível carregar os pacotes.<button type="button" @click="loadOffers">Tentar novamente</button></div>
      <div v-else class="guest-recharge__plans" role="group" aria-label="Pacotes de recarga">
        <button v-for="plan in plans" :key="plan.usdCents" type="button" :aria-pressed="selected === plan.usdCents" @click="selected = plan.usdCents">
          <span>{{ plan.display.usage }}<q-icon :name="selected === plan.usdCents ? 'mdi-check-circle' : 'mdi-circle-outline'" /></span>
          <strong>{{ aitoTokens(plan.display.totalTokens || plan.approximateTokens) }}<small>AitoTokens no total</small></strong>
          <b v-if="Number.isFinite(plan.brlCents)">{{ brl(plan.brlCents) }}</b><small>{{ usd(plan.usdCents) }}</small>
          <em v-if="plan.display.bonusTokens">{{ aitoTokens(plan.display.bonusTokens) }} de bônus incluídos</em>
        </button>
      </div>
      <button type="button" class="guest-recharge__continue" @click="continueWithAccount"><q-icon name="mdi-login" /> Entrar ou criar conta</button>
      <router-link to="/aitotokens" class="guest-recharge__details" @click="open = false">Entenda os AitoTokens e veja os pacotes</router-link>
    </q-card>
  </q-dialog>
  <AuthDialog v-if="authOpen" v-model="authOpen" :return-path="returnPath" @authenticated="authenticated" />
</template>

<style scoped>
.guest-recharge { width: min(760px, calc(100vw - 28px)); max-width: 100% !important; max-height: calc(100dvh - 28px); overflow: auto; padding: clamp(17px, 4vw, 28px); border: 1px solid #e5d8b9; border-radius: 23px; color: #17312b; background: linear-gradient(135deg, #fff 35%, #fff9e9); }
.guest-recharge header { display: flex; align-items: center; gap: 12px; }
.guest-recharge header > div { flex: 1; }
.guest-recharge header span { font-size: .73rem; color: #7b672d; }
.guest-recharge h2 { margin: 4px 0 0; font-size: clamp(1.3rem, 4vw, 1.8rem); line-height: 1.15; font-weight: 800; }
.guest-recharge p { margin: 19px 0; color: #58675f; font-size: .91rem; line-height: 1.6; }
.guest-recharge__plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.guest-recharge__plans button { display: grid; align-content: start; gap: 8px; padding: 15px 11px; border: 1px solid #dcded0; border-radius: 14px; background: #fff; color: #214239; text-align: left; cursor: pointer; }
.guest-recharge__plans button[aria-pressed=true] { border-color: #ad8537; background: #fff5d8; box-shadow: 0 0 0 1px #ad8537; }
.guest-recharge__plans button > span { display: flex; justify-content: space-between; font-size: .73rem; color: #6d641f; }
.guest-recharge__plans strong { font-size: clamp(1.05rem, 2.8vw, 1.4rem); letter-spacing: -.03em; }
.guest-recharge__plans strong small { display: block; font-size: .69rem; font-weight: 500; letter-spacing: 0; margin-top: 2px; }
.guest-recharge__plans b { font-size: 1rem; }
.guest-recharge__plans small { font-size: .7rem; }
.guest-recharge__plans em { font-size: .62rem; font-style: normal; color: #7a5b0d; }
.guest-recharge__continue { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; margin-top: 20px; padding: 13px 16px; border: 0; border-radius: 11px; color: #342406; background: linear-gradient(110deg, #f2d88b, #e5b94f); font: inherit; font-weight: 750; cursor: pointer; }
.guest-recharge__details { display: block; margin-top: 13px; color: #526a5d; text-align: center; font-size: .77rem; }
.guest-recharge__status { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; min-height: 110px; color: #5e685f; }
.guest-recharge__status button { border: 1px solid #938553; border-radius: 8px; padding: 5px 10px; background: transparent; color: #4c571d; cursor: pointer; }
.guest-recharge button:focus-visible, .guest-recharge a:focus-visible { outline: 3px solid #047d65; outline-offset: 3px; }
@media (max-width: 530px) { .guest-recharge__plans { grid-template-columns: repeat(2, minmax(0, 1fr)); } .guest-recharge header { gap: 7px; } }
</style>
