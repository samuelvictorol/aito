<script setup>
import { onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { financeHeaders, purchaseMoney } from 'src/services/purchase-history'
import AitoTokenHistory from './AitoTokenHistory.vue'

const wallets = ref([])
const loading = ref(false)
const error = ref('')
const numbers = new Intl.NumberFormat('pt-BR')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/aito-tokens/account', financeHeaders())
    wallets.value = data.data?.wallets || []
  } catch (cause) {
    error.value = cause.response?.data?.message || 'Não foi possível carregar os AitoTokens.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="token-account" aria-labelledby="token-account-title">
    <header class="token-account__head">
      <div><h2 id="token-account-title">AitoTokens</h2><p>Saldo e histórico de pagamentos por licença.</p></div>
      <q-btn flat round icon="mdi-refresh" aria-label="Atualizar AitoTokens" :loading="loading" @click="load" />
    </header>
    <q-banner v-if="error" rounded class="bg-red-10 text-white" role="alert">{{ error }}</q-banner>
    <q-banner v-else-if="!loading && !wallets.length" rounded class="token-account__empty">Nenhuma licença vinculada a esta conta.</q-banner>
    <article v-for="wallet in wallets" :key="wallet.licenseId" class="token-account__wallet">
      <div class="token-account__balance">
        <img src="/aitotokens.svg" alt="" width="56" height="56" />
        <div>
          <h3>{{ wallet.productType === 'cloud' ? 'Whitelabel' : wallet.productType === 'desktop' ? 'Desktop' : 'Licença' }} · {{ wallet.licenseId }}</h3>
          <strong>{{ purchaseMoney(wallet.balanceUsdCents, 'USD') }}</strong>
          <small v-if="Number.isFinite(wallet.approximateTokens)">Cerca de {{ numbers.format(wallet.approximateTokens) }} tokens</small>
        </div>
      </div>
      <AitoTokenHistory :license-id="wallet.licenseId" :rows="wallet.history" />
    </article>
  </section>
</template>

<style scoped>
.token-account { display: grid; gap: 1.1rem; }
.token-account__head, .token-account__balance { display: flex; align-items: center; gap: .8rem; }
.token-account__head { justify-content: space-between; }
.token-account__head h2 { margin: 0; font-size: clamp(1.65rem, 4vw, 2.5rem); line-height: 1.2; color: #f1fffc; }
.token-account__head p { margin: .45rem 0 0; }
.token-account__wallet { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; min-width: 0; padding: 1rem; border: 1px solid #345857; border-radius: .85rem; background: #0a1c1e; }
.token-account__balance { overflow-wrap: anywhere; }
.token-account__balance h3 { margin: 0 0 .3rem; color: #c1d9d3; font-size: .8rem; line-height: 1.4; }
.token-account__balance strong { display: block; color: #f8dc88; font-size: 1.55rem; }
.token-account__balance small { color: #c1d9d3; }
.token-account__empty { background: #142b2c; color: #e5fff6; }
</style>
