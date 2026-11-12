<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { ASSISTANT_CONFIG_EVENT, assistantApi, assistantCreditsApi } from '../services/admin-assistant.js'
import { errorMessage } from '../services/http.js'

const $q = useQuasar()
const account = ref(null)
const loading = ref(false)
const busy = ref('')
const error = ref('')
const archive = ref(null)
const historyBusy = ref(false)
const currency = code => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code })
const usd = currency('USD')
const brl = currency('BRL')
const number = new Intl.NumberFormat('pt-BR')
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const coin = import.meta.env.BASE_URL + 'aitotokens.svg'
const hasPending = history => Boolean(history?.some(order => order.status === 'pending'))
const pending = computed(() => hasPending(account.value?.history) || hasPending(archive.value?.history))
const orders = computed(() => archive.value?.history || account.value?.history || [])
const historyLimit = computed(() => archive.value?.limit || account.value?.historyLimit || 50)
const historyOffset = computed(() => archive.value?.offset || 0)
const hasOlder = computed(() => archive.value ? historyOffset.value + historyLimit.value < archive.value.total : orders.value.length >= historyLimit.value)
const labels = { pending: 'Pendente', paid: 'Pago', failed: 'Falhou', cancelled: 'Cancelado', expired: 'Expirado' }
let timer, eventsController

function paymentLink(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password && /(^|\.)infinitepay\.io$/.test(url.hostname)) return url.href
  } catch { /* Um pedido pode ainda não ter link. */ }
  return null
}

function signalConfig(value) {
  window.dispatchEvent(new CustomEvent(ASSISTANT_CONFIG_EVENT, { detail: value }))
}

async function load(silent = false) {
  if (loading.value) return
  loading.value = true
  try {
    const previous = account.value
    account.value = await assistantCreditsApi.status()
    error.value = ''
    if (previous && previous.canUse !== account.value.canUse) {
      void assistantApi.config().then(signalConfig).catch(() => {})
    }
    if (silent && previous?.history?.some(order => order.status === 'pending' && account.value.history?.some(item => item.orderNsu === order.orderNsu && item.status === 'paid'))) {
      $q.notify({ type: 'positive', message: 'Recarga de AitoTokens confirmada.' })
    }
  } catch (cause) {
    if (!silent) error.value = errorMessage(cause, 'Não foi possível consultar os AitoTokens.')
  } finally { loading.value = false }
}

async function loadHistory(offset) {
  if (historyBusy.value) return
  if (!offset) { archive.value = null; return }
  historyBusy.value = true
  try { archive.value = { ...await assistantCreditsApi.history(offset), offset } }
  catch (cause) { error.value = errorMessage(cause, 'Não foi possível carregar mais recargas.') }
  finally { historyBusy.value = false }
}

async function checkout(plan) {
  if (busy.value) return
  busy.value = `plan-${plan.usdCents}`
  error.value = ''
  try {
    const result = await assistantCreditsApi.checkout(plan.usdCents)
    const url = paymentLink(result.url)
    if (!url) throw Error('O link de pagamento não está disponível.')
    window.open(url, '_blank', 'noopener,noreferrer')
    await load()
  } catch (cause) { error.value = errorMessage(cause, 'Não foi possível iniciar a recarga.') }
  finally { busy.value = '' }
}

async function confirm(order) {
  if (busy.value) return
  busy.value = order.orderNsu
  error.value = ''
  try {
    const result = await assistantCreditsApi.confirm(order.orderNsu)
    await load()
    if (historyOffset.value) await loadHistory(historyOffset.value)
    $q.notify({ type: result.status === 'paid' ? 'positive' : 'info', message: result.status === 'paid' ? 'Recarga confirmada.' : 'A InfinitePay ainda está processando o pagamento.' })
  } catch (cause) { error.value = errorMessage(cause, 'Não foi possível verificar o pagamento.') }
  finally { busy.value = '' }
}

async function setProvider(provider) {
  if (busy.value) return
  busy.value = 'provider'
  error.value = ''
  try {
    signalConfig(await assistantCreditsApi.setProvider(provider))
    await load()
  } catch (cause) { error.value = errorMessage(cause, 'Não foi possível alterar o provedor.') }
  finally { busy.value = '' }
}

async function watchRechargeEvents() {
  if (!pending.value || eventsController || document.hidden) return
  const controller = new AbortController()
  eventsController = controller
  let reader
  try {
    const stream = await assistantCreditsApi.events(controller.signal)
    reader = stream.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    while (!controller.signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      if (buffer.length > 8192) break
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop()
      if (events.some(event => /(?:^|\n)event:\s*recharge\s*(?:\r?\n|$)/.test(event))) {
        void load(true)
        if (hasPending(archive.value?.history)) void loadHistory(historyOffset.value)
      }
    }
  } catch { /* A verificação periódica permanece disponível. */ }
  finally {
    await reader?.cancel().catch(() => {})
    if (eventsController === controller) eventsController = undefined
  }
}

watch(pending, value => {
  if (value) void watchRechargeEvents()
  else eventsController?.abort()
})
onMounted(() => {
  void load()
  timer = setInterval(() => {
    if (!pending.value || document.hidden) return
    void load(true)
    if (hasPending(archive.value?.history)) void loadHistory(historyOffset.value)
    void watchRechargeEvents()
  }, 8000)
})
onBeforeUnmount(() => { clearInterval(timer); eventsController?.abort() })
</script>

<template>
  <q-page padding class="aito-credit-page">
    <header class="aito-credit-hero">
      <img :src="coin" alt="" width="88" height="88" />
      <div>
        <h1>AitoTokens</h1>
        <p>Saldo para usar os agentes de IA nesta instalação.</p>
        <strong v-if="account && !account.licenseRequired">{{ account.unlimited ? 'Saldo ilimitado' : usd.format(account.balanceUsdCents / 100) }}</strong>
        <small v-if="account && !account.licenseRequired && !account.unlimited">{{ number.format(account.approximateTokens) }} tokens aproximados</small>
        <p v-if="account?.nextGrantAt">Próximo crédito da licença em {{ date.format(new Date(account.nextGrantAt)) }}.</p>
      </div>
      <q-btn flat round icon="refresh" aria-label="Atualizar saldo" :loading="loading" @click="load()" />
    </header>

    <q-banner v-if="error" rounded class="bg-red-1 text-red-10 q-my-md" role="alert">{{ error }}</q-banner>
    <q-banner v-if="account?.licenseRequired" rounded class="bg-amber-1 text-brown-10 q-my-md">
      Vincule uma chave Whitelabel ativa nas configurações da instalação para usar AitoTokens.
    </q-banner>

    <section v-if="account?.providerEditable" class="aito-credit-section" aria-label="Provedor de inteligência artificial">
      <h2>Provedor dos agentes</h2>
      <q-btn flat no-caps label="Usar AitoTokens" :disable="account.managed || account.licenseRequired || !!busy" @click="setProvider('aitotokens')" />
      <q-btn flat no-caps label="Usar chave própria" :disable="!account.managed || !!busy" @click="setProvider('openai')" />
      <q-btn v-if="!account.managed" flat no-caps label="Configurar a chave" to="/agent-ai" />
    </section>

    <section v-if="account && !account.licenseRequired && !account.unlimited" class="aito-credit-section" aria-label="Pacotes de AitoTokens">
      <h2>Recarregar Créditos</h2>
      <p v-if="account.checkoutConfigured === false">O pagamento está temporariamente indisponível.</p>
      <div class="aito-credit-plans">
        <article v-for="plan in account.plans" :key="plan.usdCents" class="aito-credit-plan">
          <strong>{{ usd.format(plan.usdCents / 100) }}</strong>
          <span>{{ number.format(plan.approximateTokens) }} tokens aproximados</span>
          <q-btn color="primary" unelevated no-caps :label="`Pagar ${brl.format(plan.brlCents / 100)}`" :loading="busy === `plan-${plan.usdCents}`" :disable="!!busy || account.checkoutConfigured === false" @click="checkout(plan)" />
        </article>
      </div>
      <p>O total em reais usa a cotação da AitoSoftwares no momento da recarga.</p>
    </section>

    <section v-if="account && !account.licenseRequired && !account.unlimited" class="aito-credit-section" aria-label="Histórico de recargas">
      <h2>Histórico de recargas</h2>
      <p v-if="!orders.length">Nenhuma recarga nesta página.</p>
      <ul v-else class="aito-credit-history">
        <li v-for="order in orders" :key="order.orderNsu">
          <div>
            <strong>{{ usd.format(order.usdCents / 100) }} · {{ brl.format(order.brlCents / 100) }}</strong>
            <span>{{ date.format(new Date(order.createdAt)) }} · {{ labels[order.status] || order.status }}</span>
          </div>
          <template v-if="order.status === 'pending'">
            <q-btn v-if="paymentLink(order.checkoutUrl)" flat no-caps label="Abrir pagamento" :href="paymentLink(order.checkoutUrl)" target="_blank" rel="noopener noreferrer" />
            <q-btn outline no-caps label="Já fiz o pagamento" :loading="busy === order.orderNsu" :disable="!!busy" @click="confirm(order)" />
          </template>
        </li>
      </ul>
      <div v-if="historyOffset || hasOlder" class="aito-credit-history-nav">
        <q-btn flat no-caps icon="chevron_left" label="Mais recentes" :disable="!historyOffset || historyBusy" @click="loadHistory(historyOffset - historyLimit)" />
        <q-btn flat no-caps icon-right="chevron_right" label="Mais antigas" :disable="!hasOlder || historyBusy" @click="loadHistory(historyOffset + historyLimit)" />
      </div>
    </section>
  </q-page>
</template>

<style scoped>
.aito-credit-page { max-width: 1050px; margin: auto; color: #17372f; }
.aito-credit-hero { display: flex; align-items: center; gap: 16px; padding: clamp(14px, 4vw, 32px); border-radius: 20px; background: linear-gradient(135deg, #e2f6ee, #fff6d9); }
.aito-credit-hero > div { flex: 1; min-width: 0; }
.aito-credit-hero h1 { font-size: clamp(1.6rem, 5vw, 2.5rem); margin: 0; line-height: 1.12; }
.aito-credit-hero p { margin: 8px 0; }
.aito-credit-hero strong { display: block; font-size: 1.35rem; }
.aito-credit-hero img { width: clamp(48px, 13vw, 88px); height: auto; }
.aito-credit-section { margin: 22px 0; }
.aito-credit-section h2 { font-size: 1.25rem; line-height: 1.3; margin-bottom: 12px; }
.aito-credit-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr)); gap: 10px; }
.aito-credit-plan, .aito-credit-history li { border: 1px solid #d1e5de; border-radius: 12px; padding: 14px; background: #fcfffd; }
.aito-credit-plan { display: grid; gap: 8px; }
.aito-credit-history { display: grid; gap: 8px; padding: 0; list-style: none; }
.aito-credit-history li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.aito-credit-history li > div { flex: 1 1 175px; display: grid; }
.aito-credit-history-nav { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
</style>
