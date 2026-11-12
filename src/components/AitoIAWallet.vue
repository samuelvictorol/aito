<script setup>
import { computed, ref, watch } from 'vue'
import { brl, usd } from 'src/composables/useAitoIA'
import { checkoutLink } from 'src/services/aitoiaChat'

const props = defineProps({ modelValue: Boolean, state: { type: Object, required: true } })
defineEmits(['update:modelValue'])
const { status, walletId, walletLoading, walletError, pending, history, historyLoading, historyOffset, historyLimit,
  historyTotal, checkoutBusy, paymentBusy, paymentNotice } = props.state
const selected = ref(null)
const plans = computed(() => status.value?.plans || [])
const wallets = computed(() => status.value?.wallets || [])
const orderStates = { paid: 'Pago', approved: 'Pago', pending: 'Pendente', expired: 'Expirado', cancelled: 'Cancelado', failed: 'Falhou' }
const orderLink = order => checkoutLink(order.checkoutUrl || order.url)
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''
const tokens = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
watch(walletId, () => { selected.value = null })
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card dark class="aito-wallet">
      <header class="aito-wallet__header">
        <img src="/aitotokens.svg" alt="" width="42" height="42" />
        <h2>AitoTokens</h2>
        <button type="button" class="aito-wallet__icon" aria-label="Atualizar saldo" :disabled="walletLoading" @click="state.refreshStatus(); state.loadHistory(historyOffset)"><q-icon name="mdi-refresh" size="22px" /></button>
        <button v-close-popup type="button" class="aito-wallet__icon" aria-label="Fechar recarga"><q-icon name="mdi-close" size="22px" /></button>
      </header>
      <div v-if="walletError" class="aito-wallet__notice aito-wallet__notice--error" role="alert">{{ walletError }}</div>
      <div v-if="paymentNotice" class="aito-wallet__notice" role="status">{{ paymentNotice }}</div>
      <section class="aito-wallet__summary" aria-label="Saldo disponível">
        <div><span>Saldo disponível</span><strong>{{ status ? usd(status.balanceUsdCents) : '—' }}</strong>
          <small v-if="status?.exchangeRate?.rate">{{ brl(status.balanceUsdCents * status.exchangeRate.rate) }} pela cotação atual</small>
          <small v-if="status?.reconcilingUsdCents > 0">{{ usd(status.reconcilingUsdCents) }} em conciliação</small></div>
        <label v-if="wallets.length > 1">Carteira<select :value="walletId" :disabled="walletLoading || checkoutBusy" @change="state.selectWallet($event.target.value)"><option v-for="wallet in wallets" :key="wallet.id" :value="wallet.id">{{ wallet.label }}</option></select></label>
      </section>
      <section class="aito-wallet__section" aria-labelledby="aito-wallet-recharge">
        <h3 id="aito-wallet-recharge">Recarregar</h3>
        <div v-if="status?.checkoutConfigured === false" class="aito-wallet__notice">As recargas estão temporariamente indisponíveis.</div>
        <div class="aito-wallet__plans" role="group" aria-label="Pacotes de recarga">
          <button v-for="plan in plans" :key="plan.usdCents" type="button" :aria-pressed="selected?.usdCents === plan.usdCents" :disabled="status?.checkoutConfigured === false" @click="selected = plan">
            <strong>{{ usd(plan.usdCents) }}</strong><span>{{ brl(plan.brlCents) }}</span><small v-if="plan.approximateTokens">≈ {{ tokens(plan.approximateTokens) }} tokens</small>
          </button>
        </div>
        <div v-if="selected" class="aito-wallet__checkout"><span>{{ brl(selected.brlCents) }} via InfinitePay</span><button type="button" class="aito-wallet__action" :disabled="checkoutBusy || walletLoading || status?.checkoutConfigured === false" @click="state.checkout(selected)">{{ checkoutBusy ? 'Preparando…' : 'Gerar pagamento' }}</button></div>
        <div v-if="pending" class="aito-wallet__pending">
          <div><strong>Checkout disponível</strong><span>O saldo aparece após a confirmação do pagamento.</span></div>
          <div><a class="aito-wallet__action" :href="pending.url" target="_blank" rel="noopener noreferrer">Abrir InfinitePay <q-icon name="mdi-arrow-top-right" size="17px" /></a><button type="button" :disabled="Boolean(paymentBusy)" @click="state.checkPayment(pending)">{{ paymentBusy ? 'Verificando…' : 'Já paguei' }}</button></div>
        </div>
      </section>
      <section class="aito-wallet__section" aria-labelledby="aito-wallet-history">
        <h3 id="aito-wallet-history">Histórico de recargas</h3>
        <p v-if="historyLoading && !history.length" role="status">Carregando pagamentos…</p>
        <p v-else-if="!history.length">Nenhum pagamento nesta carteira.</p>
        <ul v-else class="aito-wallet__history">
          <li v-for="order in history" :key="order.orderNsu || order.id">
            <div><strong>{{ usd(order.usdCents) }}</strong><small>{{ date(order.createdAt) }}</small></div>
            <span>{{ orderStates[order.status] || order.status }}</span>
            <a v-if="order.status === 'pending' && orderLink(order)" :href="orderLink(order)" target="_blank" rel="noopener noreferrer" aria-label="Abrir pagamento"><q-icon name="mdi-open-in-new" size="17px" /></a>
            <button v-if="order.status === 'pending'" type="button" :disabled="Boolean(paymentBusy)" @click="state.checkPayment(order)">Verificar</button>
          </li>
        </ul>
        <div v-if="historyTotal > historyLimit" class="aito-wallet__pager"><button type="button" :disabled="!historyOffset || historyLoading" @click="state.loadHistory(Math.max(0, historyOffset - historyLimit))">Anteriores</button><button type="button" :disabled="historyOffset + historyLimit >= historyTotal || historyLoading" @click="state.loadHistory(historyOffset + historyLimit)">Próximas</button></div>
      </section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.aito-wallet { width: min(630px, calc(100vw - 2rem)); max-width: 100% !important; max-height: calc(100dvh - 2rem); padding: 17px; overflow: auto; border: 1px solid #624c68; border-radius: 17px; color: #f1e9f4; background: #211a29; font-family: 'Geist', 'Inter', system-ui, sans-serif; }
.aito-wallet button, .aito-wallet select { font: inherit; }
.aito-wallet button:focus-visible, .aito-wallet a:focus-visible { outline: 2px solid #e5c8ff; outline-offset: 2px; }
.aito-wallet__header { display: flex; align-items: center; gap: 8px; }
.aito-wallet__header h2 { flex: 1; margin: 0; font-size: 1.23rem; font-weight: 750; line-height: 1.2; }
.aito-wallet__icon { display: grid; width: 34px; height: 34px; padding: 0; place-items: center; border: 0; border-radius: 8px; color: #cab7d4; background: transparent; cursor: pointer; }
.aito-wallet__icon:hover { color: #fff; background: #ffffff10; }
.aito-wallet__summary { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 8px; margin-top: 12px; padding: 12px; border: 1px solid #5f4a39; border-radius: 11px; background: #2f2427; }
.aito-wallet__summary > div, .aito-wallet__summary > label { display: grid; gap: 4px; color: #ddcadc; font-size: .77rem; }
.aito-wallet__summary strong { color: #f6d998; font-size: 1.6rem; line-height: 1.2; }
.aito-wallet__summary small { color: #cabbc9; font-size: .72rem; }
.aito-wallet__summary select { min-height: 34px; padding: 4px 6px; border: 1px solid #746070; border-radius: 7px; color: #f6edf7; background: #2d2235; }
.aito-wallet__section { margin-top: 17px; }
.aito-wallet__section h3 { margin: 0 0 7px; color: #f2e7f5; font-size: .94rem; font-weight: 720; line-height: 1.25; }
.aito-wallet__section p { margin: 0; color: #c1b0c7; font-size: .8rem; }
.aito-wallet__plans { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.aito-wallet__plans button { display: grid; gap: 4px; min-width: 0; padding: 9px 6px; border: 1px solid #554160; border-radius: 8px; color: #e8d9f0; background: #2b2035; text-align: left; cursor: pointer; }
.aito-wallet__plans button[aria-pressed=true] { border-color: #f4d591; background: #3c2b34; }
.aito-wallet__plans strong { color: #f6ddaa; font-size: .91rem; }
.aito-wallet__plans span { font-size: .8rem; }
.aito-wallet__plans small { color: #d5bedc; font-size: .64rem; overflow-wrap: anywhere; }
.aito-wallet__checkout { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 8px 0; color: #e3cfda; font-size: .77rem; }
.aito-wallet__action { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 35px; padding: 5px 9px; border: 0; border-radius: 7px; color: #2d1c2c; background: linear-gradient(125deg, #f9e5ad, #e6b767); font-size: .78rem !important; font-weight: 720 !important; cursor: pointer; text-decoration: none; }
.aito-wallet__pending { display: grid; gap: 6px; padding: 9px; border: 1px solid #775941; border-radius: 8px; background: #342635; font-size: .77rem; }
.aito-wallet__pending > div { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.aito-wallet__pending span { color: #d4bcd1; }
.aito-wallet__pending button:not(.aito-wallet__action), .aito-wallet__history button, .aito-wallet__pager button { padding: 4px 5px; border: 0; color: #dfc5f1; background: transparent; font-size: .74rem; cursor: pointer; text-decoration: underline; }
.aito-wallet button:disabled { opacity: .55; cursor: default; }
.aito-wallet__history { margin: 0; padding: 0; list-style: none; }
.aito-wallet__history li { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 6px 0; border-top: 1px solid #3d3048; font-size: .74rem; }
.aito-wallet__history li > div { display: grid; flex: 1; gap: 2px; }
.aito-wallet__history small { color: #baabc5; }
.aito-wallet__history a { color: #e4cef3; }
.aito-wallet__notice { margin-top: 7px; padding: 6px 9px; border-radius: 6px; color: #f4dfbc; background: #3a2b38; font-size: .75rem; }
.aito-wallet__notice--error { color: #ffc9dc; background: #4a2a3a; }
.aito-wallet__pager { display: flex; gap: 9px; justify-content: flex-end; }
@media (max-width: 470px) { .aito-wallet { padding: 11px; } .aito-wallet__plans { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
