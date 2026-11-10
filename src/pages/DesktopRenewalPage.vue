<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../boot/axios'
import { safeReceiptUrl } from '../services/purchase-history'

const route = useRoute()
const details = ref(null)
const error = ref('')
const loading = ref(false)
const buying = ref(false)
const confirmed = ref(false)
const selected = ref(Number(route.query.plano) || 12)
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    details.value = (await api.get('/desktop-renewals/session')).data.data
    const plans = details.value.plans.filter(plan => plan.enabled)
    if (!plans.some(plan => plan.months === selected.value)) selected.value = plans[0]?.months
  } catch (cause) {
    details.value = null
    error.value = cause.response?.data?.message || 'Abra a renovação pelo Desktop ou em Meus produtos.'
  } finally {
    loading.value = false
  }
}

async function checkout() {
  if (buying.value || !details.value?.available || !selected.value) return
  buying.value = true
  error.value = ''
  try {
    const { url: checkoutUrl } = (await api.post('/desktop-renewals/checkout', { months: selected.value })).data.data
    const url = new URL(checkoutUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !/(^|\.)infinitepay\.io$/.test(url.hostname)) throw Error('Checkout inválido.')
    location.assign(url.href)
  } catch (cause) {
    error.value = cause.response?.data?.message || cause.message
  } finally {
    buying.value = false
  }
}

onMounted(async () => {
  if (route.query.origem === 'desktop') return
  const code = new URLSearchParams(location.hash.slice(1)).get('grant')
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search)
  try {
    if (code) await api.post('/desktop-renewals/redeem', { code })
    if (route.query.order_nsu && route.query.transaction_nsu) {
      await api.post('/desktop-renewals/confirm', {
        order_nsu: route.query.order_nsu,
        transaction_nsu: route.query.transaction_nsu,
        slug: route.query.slug || route.query.invoice_slug,
        receipt_url: safeReceiptUrl(route.query.receipt_url) || undefined,
      })
      confirmed.value = true
    }
    await load()
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Abra a renovação novamente pelo Desktop ou em Meus produtos.'
  }
})
</script>

<template>
  <main class="renewal">
    <router-link to="/whatsapp-solucoes">AitoNotify Desktop</router-link>
    <h1>Renove sua licença</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="confirmed" class="renewal-confirmed" role="status">Pagamento confirmado. Sua validade foi atualizada.</p>
    <template v-if="details">
      <p>Se a sua licença ainda estiver ativa, o novo período começa no vencimento atual. Se já tiver expirado, começa na confirmação do pagamento.</p>
      <p v-if="details.expiresAt"><b>Validade atual</b> {{ date.format(new Date(details.expiresAt)) }}</p>
      <template v-if="details.available">
        <div class="plans" aria-label="Períodos de renovação">
          <label v-for="plan in details.plans" :key="plan.months" :class="{ 'plan-selected': selected === plan.months }">
            <input v-model="selected" type="radio" name="renewal-plan" :value="plan.months" :disabled="!plan.enabled" />
            {{ plan.label }} · {{ plan.months === 1 ? '1 mês' : `${plan.months} meses` }}
            <strong>{{ currency.format(plan.priceCents / 100) }}</strong>
            <small v-if="plan.enabled && plan.renewalAt">Validade prevista até {{ date.format(new Date(plan.renewalAt)) }}</small>
            <small v-else>Plano indisponível</small>
          </label>
        </div>
        <q-btn color="teal" no-caps label="Renovar pela InfinitePay" :loading="buying" :disable="loading || !selected" @click="checkout" />
        <q-btn flat no-caps label="Já paguei · consultar" :loading="loading" :disable="buying" @click="load" />
      </template>
      <p v-else>A renovação online está indisponível para esta licença.</p>
    </template>
    <p v-else-if="loading" role="status">Consultando sua licença…</p>
    <p v-else-if="route.query.origem === 'desktop'">Após pagar, volte ao aplicativo e clique em “Verificar acesso”. A licença é atualizada assim que o pagamento for confirmado.</p>
    <p v-else>Abra a renovação pelo Desktop ou em <router-link to="/app?tab=products">Meus produtos</router-link>.</p>
    <p v-if="details?.available" class="renewal-note">Os preços são os vigentes no momento de gerar o pagamento. O pagamento é avulso.</p>
  </main>
</template>

<style scoped>
.renewal { min-height: 100vh; background: #f0faf6; padding: 40px max(20px, calc((100vw - 850px) / 2)); color: #133f30; }
h1 { font-size: clamp(30px, 6vw, 46px); line-height: 1.2; }
.plans { display: flex; flex-wrap: wrap; gap: 16px; margin: 30px 0; }
label { padding: 20px; border: 1px solid #85ad9a; border-radius: 18px; background: white; flex: 1; min-width: 180px; cursor: pointer; }
.plan-selected { border-color: #147360; box-shadow: inset 0 0 0 1px #147360; }
strong { display: block; font-size: 25px; margin-top: 12px; }
small { display: block; margin-top: 6px; color: #47665b; }
p { line-height: 1.7; }
.renewal-confirmed { padding: 12px 16px; border-radius: 10px; background: #d5f2e4; }
.renewal-note { margin-top: 14px; font-size: .9rem; }
[role=alert] { color: #a22938; }
</style>
