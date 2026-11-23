<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMeta } from 'quasar'
import { api } from 'boot/axios'
import { purchaseMoney, safeReceiptUrl } from 'src/services/purchase-history'

const route = useRoute()
useMeta({ title: 'Recarga do projeto · AitoTokens', meta: {
  robots: { name: 'robots', content: 'noindex,nofollow' },
  referrer: { name: 'referrer', content: 'no-referrer' },
} })
const number = new Intl.NumberFormat('pt-BR')
const offers = ref(null)
const selected = ref(null)
const order = ref(null)
const loading = ref(false)
const buying = ref(false)
const checking = ref(false)
const error = ref('')
const checkError = ref('')
let session
let timer

function call(current, action, body = {}) {
  return api.post('/aito-tokens/project-recharge/' + action, { token: current.token, ...body }, {
    signal: current.controller.signal, withCredentials: false,
  }).then(response => response.data.data)
}

async function openLink(hash) {
  session?.controller.abort()
  const token = hash.slice(1)
  const current = { token, controller: new AbortController(), storageKey: '' }
  session = current
  offers.value = order.value = selected.value = null
  error.value = checkError.value = ''
  checking.value = buying.value = false
  loading.value = true
  try {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw Error('link')
    const data = await call(current, 'offers')
    if (session !== current) return
    offers.value = data
    selected.value = data.plans?.[0]?.usdCents ?? null
    // Remember only the order reference, scoped to this link, across checkout navigation.
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      if (session !== current) return
      current.storageKey = 'aito.project-order.' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
      const saved = sessionStorage.getItem(current.storageKey)
      if (saved) {
        order.value = { orderNsu: saved, status: 'pending' }
        await checkOrder()
      }
    } catch { /* The active tab can still follow its order when storage is unavailable. */ }
  } catch (cause) {
    if (session === current) error.value = cause.response?.status >= 500 || cause.code === 'ERR_NETWORK'
      ? 'Não foi possível consultar os pacotes. Tente novamente.'
      : 'Link de recarga inválido ou indisponível. Solicite o link ao administrador do projeto.'
  } finally {
    if (session === current) loading.value = false
  }
}

async function buy() {
  const current = session
  if (buying.value || !offers.value?.checkoutConfigured || !selected.value) return
  buying.value = true
  error.value = ''
  try {
    const result = await call(current, 'checkout', { usdCents: selected.value })
    if (session !== current) return
    const url = safeReceiptUrl(result.url)
    if (!url || !result.orderNsu) throw Error('checkout')
    order.value = { orderNsu: result.orderNsu, url, status: 'pending' }
    checkError.value = ''
    try { if (current.storageKey) sessionStorage.setItem(current.storageKey, result.orderNsu) } catch { /* Optional. */ }
  } catch (cause) {
    if (session === current) error.value = cause.response?.data?.message || 'Não foi possível gerar o pagamento.'
  } finally { if (session === current) buying.value = false }
}

async function checkOrder() {
  const current = session
  const id = order.value?.orderNsu
  if (!id || checking.value || order.value.status !== 'pending') return
  checking.value = true
  try {
    const result = await call(current, 'order', { orderNsu: id })
    if (session === current && order.value?.orderNsu === id) {
      order.value = { ...order.value, ...result }
      checkError.value = ''
    }
  } catch (cause) {
    if (session === current && order.value?.orderNsu === id) {
      checkError.value = 'Não foi possível verificar este pedido.'
      if ([403, 404].includes(cause.response?.status)) {
        order.value = null
        try { sessionStorage.removeItem(current.storageKey) } catch { /* Optional. */ }
      }
    }
  } finally { if (session === current) checking.value = false }
}

const checkVisible = () => { if (!document.hidden) void checkOrder() }
watch(() => route.hash, openLink, { immediate: true })
onMounted(() => {
  timer = setInterval(checkVisible, 10000)
  window.addEventListener('focus', checkVisible)
  document.addEventListener('visibilitychange', checkVisible)
})
onBeforeUnmount(() => {
  session?.controller.abort()
  session = null
  clearInterval(timer)
  window.removeEventListener('focus', checkVisible)
  document.removeEventListener('visibilitychange', checkVisible)
})
</script>

<template>
  <main class="project-recharge">
    <header><img src="/aito-logo-restored.png" width="34" height="34" alt="" /> AitoSoftwares</header>
    <section aria-labelledby="recharge-title">
      <div class="project-recharge__heading">
        <img src="/aitotokens.svg" width="52" height="52" alt="" />
        <div><h1 id="recharge-title">Recarregar AitoTokens</h1><p v-if="offers">{{ offers.title }}</p></div>
      </div>
      <p v-if="loading" role="status"><q-spinner /> Consultando carteira…</p>
      <div v-if="error" role="alert" class="project-recharge__notice">{{ error }}
        <q-btn v-if="!offers" flat no-caps label="Tentar novamente" @click="openLink(route.hash)" />
      </div>
      <template v-if="offers">
        <fieldset :disabled="buying"><legend>Escolha o valor da recarga</legend>
          <label v-for="pack in offers.plans" :key="pack.usdCents" :class="{ selected: selected === pack.usdCents }">
            <input v-model="selected" type="radio" name="pacote" :value="pack.usdCents" />
            <span><strong>{{ number.format(pack.approximateTokens) }}</strong> AitoTokens</span>
            <b>{{ purchaseMoney(pack.brlCents) }}</b>
          </label>
        </fieldset>
        <q-btn no-caps unelevated class="project-recharge__pay" label="Gerar pagamento" icon="mdi-wallet-plus-outline"
          :loading="buying" :disable="!offers.checkoutConfigured || !selected" @click="buy" />
        <p v-if="!offers.checkoutConfigured" role="status">O checkout está temporariamente indisponível.</p>
        <div v-if="order" class="project-recharge__status" aria-live="polite">
          <template v-if="order.status === 'pending'">
            <strong>Aguardando pagamento</strong>
            <p>Os créditos entram na carteira de {{ offers.title }} após a confirmação da InfinitePay.</p>
            <a v-if="order.url" :href="order.url" target="_blank" rel="noopener noreferrer">Pagar na InfinitePay <q-icon name="mdi-open-in-new" /></a>
            <q-btn flat no-caps icon="mdi-refresh" label="Verificar pagamento" :loading="checking" @click="checkOrder" />
          </template>
          <strong v-else-if="order.credited">Recarga confirmada · {{ number.format(order.approximateTokens) }} AitoTokens creditados</strong>
          <strong v-else-if="order.status === 'paid'">Pagamento recebido. Consulte o administrador sobre a liberação dos créditos.</strong>
          <strong v-else>Pedido encerrado. Você pode gerar outro pagamento.</strong>
        </div>
        <p v-if="checkError" role="alert">{{ checkError }}</p>
      </template>
    </section>
  </main>
</template>

<style scoped>
.project-recharge { min-height: 100vh; padding: clamp(1rem, 4vw, 3rem); color: #2b2112; background: linear-gradient(125deg,#fffae9,#fff 52%,#faf3da); font-family: inherit; }
.project-recharge header, .project-recharge section { width: min(100%, 760px); margin: 0 auto; }
.project-recharge header { display: flex; align-items: center; gap: .6rem; font-weight: 700; margin-bottom: clamp(1.5rem,5vw,4rem); }
.project-recharge section { background: white; border: 1px solid #e5d9bb; border-radius: 1.4rem; padding: clamp(1.2rem,4vw,2.5rem); box-shadow: 0 16px 50px #795e1014; }
.project-recharge__heading { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.8rem; }
.project-recharge h1 { font-size: clamp(1.5rem,4.5vw,2.4rem); line-height: 1.12; font-weight: 700; margin: 0; letter-spacing: -.035em; }
.project-recharge p { margin: .4rem 0; }
.project-recharge fieldset { border: 0; margin: 0 0 1.25rem; padding: 0; display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,170px),1fr)); gap: .65rem; }
.project-recharge legend { padding: 0 0 .8rem; font-weight: 650; }
.project-recharge label { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: .3rem .6rem; padding: .85rem; cursor: pointer; border: 1px solid #dbd4c6; border-radius: .8rem; }
.project-recharge label.selected { border-color: #a47722; background: #fff7dc; }
.project-recharge input { accent-color: #74500d; }
.project-recharge label strong { display: block; font-size: 1.25rem; line-height: 1.2; }
.project-recharge label b { grid-column: 2; color: #72501d; }
.project-recharge__pay { color: white; background: #6a4911; }
.project-recharge__status, .project-recharge__notice { margin: 1rem 0; padding: 1rem; border-radius: .75rem; background: #f7f4eb; }
.project-recharge__status a { color: #184f43; font-weight: 700; display: inline-block; padding: .65rem 0; margin-right: 1rem; }
</style>
