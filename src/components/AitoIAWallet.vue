<script setup>
import { computed, ref, watch } from 'vue'
import { aitoTokens, brl, usd } from 'src/composables/useAitoIA'
import { checkoutLink } from 'src/services/aitoiaChat'

const props = defineProps({ modelValue: Boolean, state: { type: Object, required: true }, initialPackage: Number })
defineEmits(['update:modelValue'])
const { status, walletId, walletLoading, walletError, pending, history, historyLoading, historyOffset, historyLimit,
  historyTotal, checkoutBusy, paymentBusy, paymentNotice } = props.state
const plans = computed(() => status.value?.plans || [])
const defaultPackage = () => props.initialPackage || 1500
const selectedAmount = ref(defaultPackage())
const selected = computed(() => plans.value.find(plan => plan.usdCents === selectedAmount.value))
const wallets = computed(() => status.value?.wallets || [])
const orderStates = { paid: 'Pago', approved: 'Pago', pending: 'Pendente', expired: 'Expirado', cancelled: 'Cancelado', failed: 'Falhou' }
const orderLink = order => checkoutLink(order.checkoutUrl || order.url)
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''
watch([() => props.initialPackage, () => props.modelValue], () => {
  if (props.modelValue) selectedAmount.value = defaultPackage()
})
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card dark class="aito-ai-theme aito-wallet">
      <header class="aito-wallet__header">
        <img src="/aitotokens.svg" alt="" width="42" height="42" />
        <h2>{{ status ? `≈ ${aitoTokens(status.approximateTokens)} AitoTokens` : 'AitoTokens' }}</h2>
        <button type="button" class="aito-wallet__icon" aria-label="Atualizar saldo" :disabled="walletLoading" @click="state.refreshStatus(); state.loadHistory(historyOffset)"><q-icon name="mdi-refresh" size="22px" /></button>
        <button v-close-popup type="button" class="aito-wallet__icon" aria-label="Fechar recarga"><q-icon name="mdi-close" size="22px" /></button>
      </header>
      <div v-if="walletError" class="aito-wallet__notice aito-wallet__notice--error" role="alert">{{ walletError }}</div>
      <div v-if="paymentNotice" class="aito-wallet__notice" role="status">{{ paymentNotice }}</div>
      <section class="aito-wallet__summary" aria-label="Saldo disponível">
        <div><span>Saldo convertido</span><strong>{{ status ? usd(status.balanceUsdCents) : '—' }}<small v-if="status?.exchangeRate?.rate"> · {{ brl(status.balanceUsdCents * status.exchangeRate.rate) }}</small></strong>
          <small v-if="status?.reconcilingUsdCents > 0">{{ usd(status.reconcilingUsdCents) }} em conciliação</small></div>
        <label v-if="wallets.length > 1">Carteira<select :value="walletId" :disabled="walletLoading || checkoutBusy" @change="state.selectWallet($event.target.value)"><option v-for="wallet in wallets" :key="wallet.id" :value="wallet.id">{{ wallet.label }}</option></select></label>
      </section>
      <section class="aito-wallet__section" aria-labelledby="aito-wallet-recharge">
        <h3 id="aito-wallet-recharge">Recarregar</h3>
        <div v-if="status?.checkoutConfigured === false" class="aito-wallet__notice">{{ status.checkoutState === 'missing_exchange_rate' ? 'A recarga aguarda uma cotação atualizada.' : 'A recarga aguarda a configuração da InfinitePay.' }}</div>
        <div class="aito-wallet__plans" role="group" aria-label="Pacotes de recarga">
          <button v-for="plan in plans" :key="plan.usdCents" type="button" :aria-pressed="selected?.usdCents === plan.usdCents" :disabled="status?.checkoutConfigured === false" @click="selectedAmount = plan.usdCents">
            <strong>{{ usd(plan.usdCents) }} <q-icon :name="selected?.usdCents === plan.usdCents ? 'mdi-check-circle' : 'mdi-circle-outline'" aria-hidden="true" /></strong><span>{{ brl(plan.brlCents) }}</span><small v-if="plan.approximateTokens">≈ {{ aitoTokens(plan.approximateTokens) }} AitoTokens</small>
          </button>
        </div>
        <div v-if="selected" class="aito-wallet__checkout"><div>Total <strong>{{ brl(selected.brlCents) }}</strong></div><button type="button" class="aito-wallet__action" :aria-busy="checkoutBusy" :disabled="checkoutBusy || walletLoading || status?.checkoutConfigured === false" @click="state.checkout(selected)"><q-spinner v-if="checkoutBusy" size="18px" /><q-icon v-else name="mdi-credit-card-outline" size="19px" />{{ checkoutBusy ? 'Preparando…' : 'Gerar pagamento' }}</button></div>
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
.aito-wallet { width: min(630px, calc(100vw - 2rem)); max-width: 100% !important; max-height: calc(100dvh - 2rem); padding: 17px; overflow: auto; border: 1px solid var(--aito-ai-line); border-radius: 17px; color: var(--aito-ai-text); background: var(--aito-ai-surface); font-family: var(--aito-ai-font); }
.aito-wallet button, .aito-wallet select { font: inherit; }
.aito-wallet button:focus-visible, .aito-wallet a:focus-visible { outline: 2px solid var(--aito-ai-accent); outline-offset: 2px; }
.aito-wallet__header { display: flex; align-items: center; gap: 8px; }
.aito-wallet__header h2 { flex: 1; margin: 0; font-size: 1.23rem; font-weight: 750; line-height: 1.2; }
.aito-wallet__icon { display: grid; width: 34px; height: 34px; padding: 0; place-items: center; border: 0; border-radius: 8px; color: var(--aito-ai-muted); background: transparent; cursor: pointer; }
.aito-wallet__icon:hover { color: var(--aito-ai-text); background: #ffffff10; }
.aito-wallet__summary { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 8px; margin-top: 9px; padding: 8px 10px; border: 1px solid var(--aito-ai-gold-line); border-radius: 10px; background: var(--aito-ai-gold-soft); }
.aito-wallet__summary > div, .aito-wallet__summary > label { display: grid; gap: 4px; color: var(--aito-ai-muted); font-size: .77rem; }
.aito-wallet__summary strong { color: var(--aito-ai-gold); font-size: 1.12rem; line-height: 1.2; }
.aito-wallet__summary small { color: var(--aito-ai-muted); font-size: .72rem; }
.aito-wallet__summary select { min-height: 34px; padding: 4px 6px; border: 1px solid var(--aito-ai-line); border-radius: 7px; color: var(--aito-ai-text); background: var(--aito-ai-raised); }
.aito-wallet__section { margin-top: 13px; }
.aito-wallet__section h3 { margin: 0 0 7px; color: var(--aito-ai-text); font-size: .94rem; font-weight: 720; line-height: 1.25; }
.aito-wallet__section p { margin: 0; color: var(--aito-ai-muted); font-size: .8rem; }
.aito-wallet__plans { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.aito-wallet__plans button { display: grid; gap: 4px; min-width: 0; padding: 9px 6px; border: 1px solid var(--aito-ai-line); border-radius: 8px; color: var(--aito-ai-text); background: var(--aito-ai-panel); text-align: left; cursor: pointer; }
.aito-wallet__plans button[aria-pressed=true] { border-color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); }
.aito-wallet__plans strong { display: flex; justify-content: space-between; align-items: center; gap: 3px; color: var(--aito-ai-gold); font-size: .91rem; }
.aito-wallet__plans button:not([aria-pressed=true]) strong .q-icon { opacity: .55; }
.aito-wallet__plans span { font-size: .8rem; }
.aito-wallet__plans small { color: var(--aito-ai-muted); font-size: .64rem; overflow-wrap: anywhere; }
.aito-wallet__checkout { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 8px 0; color: var(--aito-ai-muted); font-size: .77rem; }
.aito-wallet__checkout strong { color: var(--aito-ai-gold); font-size: 1rem; margin-left: 4px; }
.aito-wallet__checkout .aito-wallet__action { min-height: 42px; padding-inline: 13px; }
.aito-wallet__action { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 35px; padding: 5px 9px; border: 0; border-radius: 7px; color: var(--aito-ai-ink); background: var(--aito-ai-gold-gradient); font-size: .78rem !important; font-weight: 720 !important; cursor: pointer; text-decoration: none; }
.aito-wallet__pending { display: grid; gap: 6px; padding: 9px; border: 1px solid var(--aito-ai-gold-line); border-radius: 8px; background: var(--aito-ai-gold-soft); font-size: .77rem; }
.aito-wallet__pending > div { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.aito-wallet__pending span { color: var(--aito-ai-muted); }
.aito-wallet__pending button:not(.aito-wallet__action), .aito-wallet__history button, .aito-wallet__pager button { padding: 4px 5px; border: 0; color: var(--aito-ai-accent); background: transparent; font-size: .74rem; cursor: pointer; text-decoration: underline; }
.aito-wallet button:disabled { opacity: .55; cursor: default; }
.aito-wallet__history { margin: 0; padding: 0; list-style: none; }
.aito-wallet__history li { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 6px 0; border-top: 1px solid var(--aito-ai-line); font-size: .74rem; }
.aito-wallet__history li > div { display: grid; flex: 1; gap: 2px; }
.aito-wallet__history small { color: var(--aito-ai-muted); }
.aito-wallet__history a { color: var(--aito-ai-accent); }
.aito-wallet__notice { margin-top: 7px; padding: 6px 9px; border-radius: 6px; color: var(--aito-ai-gold); background: var(--aito-ai-gold-soft); font-size: .75rem; }
.aito-wallet__notice--error { color: var(--aito-ai-error); background: var(--aito-ai-error-soft); }
.aito-wallet__pager { display: flex; gap: 9px; justify-content: flex-end; }
@media (max-width: 470px) { .aito-wallet { padding: 11px; } .aito-wallet__plans { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
