<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { financeHeaders, purchaseMoney } from 'src/services/purchase-history'
import AitoTokenHistory from './AitoTokenHistory.vue'
import AdminAitoTokenProjects from './AdminAitoTokenProjects.vue'
import AdminAitoTokenUsage from './AdminAitoTokenUsage.vue'
import LoginMfaDialog from './LoginMfaDialog.vue'

const emit = defineEmits(['reauthenticated', 'open-projects'])
const $q = useQuasar()
const root = '/aito-tokens/admin'
const tab = ref('usage')
const wallets = ref([])
const search = ref('')
const pagination = ref({ page: 1, rowsPerPage: 100, rowsNumber: 0 })
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const editing = reactive({ exchangeRate: false, config: false, grant: false })
const exchange = reactive({ rate: null, autoRefresh: true })
const config = reactive({ model: 'gpt-6.1-sol', effort: 'medium', speed: 'standard' })
const historyWallet = ref(null)
const grantWallet = ref(null)
const grantAmount = ref(null)
const grantChallenge = ref(null)
const mfaOpen = ref(false)
let pendingGrant = null
let currentLoad

const numbers = new Intl.NumberFormat('pt-BR')
const models = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna']
const efforts = [
  { label: 'Baixo', value: 'low' },
  { label: 'Médio', value: 'medium' },
  { label: 'Alto', value: 'high' },
]
const standardSpeed = { label: 'Padrão', value: 'standard' }
const prioritySpeed = { label: 'Prioritário', value: 'priority' }
const hasPriority = computed(() => config.model === 'gpt-6.1-sol' || config.model === 'gpt-6.1-terra')
const speeds = computed(() => hasPriority.value ? [standardSpeed, prioritySpeed] : [standardSpeed])
const columns = [
  { name: 'ownerName', label: 'Cliente', field: 'ownerName', align: 'left' },
  { name: 'ownerEmail', label: 'E-mail', field: 'ownerEmail', align: 'left' },
  { name: 'licenseId', label: 'Licença', field: 'licenseId', align: 'left' },
  { name: 'balance', label: 'Saldo', field: row => purchaseMoney(row.balanceUsdCents, 'USD') },
  { name: 'inputTokens', label: 'Tokens de entrada', field: row => numbers.format(row.inputTokens || 0) },
  { name: 'outputTokens', label: 'Tokens de saída', field: row => numbers.format(row.outputTokens || 0) },
  { name: 'spentUsd', label: 'Consumo em USD', field: row => purchaseMoney(row.spentUsdCents, 'USD') },
  { name: 'spentBrl', label: 'Consumo em BRL', field: row => purchaseMoney(row.spentBrlCents) },
  { name: 'actions', label: 'Ações', field: 'licenseId' },
]

function notify(error, fallback) {
  $q.notify({ type: 'negative', message: error.response?.data?.message || fallback })
}

async function load({ page = pagination.value.page, refreshSettings = false } = {}) {
  currentLoad?.abort()
  const request = new AbortController()
  currentLoad = request
  loading.value = true
  loadError.value = ''
  try {
    const { rowsPerPage } = pagination.value
    const { data } = await api.get(root, {
      ...financeHeaders(true),
      signal: request.signal,
      params: { offset: (page - 1) * rowsPerPage, q: search.value || undefined },
    })
    if (request.signal.aborted) return
    const result = data.data || {}
    wallets.value = result.wallets || []
    pagination.value = { page, rowsPerPage: result.limit || rowsPerPage, rowsNumber: result.total ?? wallets.value.length }
    if (!loaded.value || refreshSettings) {
      Object.assign(exchange, result.exchangeRate)
      Object.assign(config, result.config)
    }
    loaded.value = true
  } catch (error) {
    if (!request.signal.aborted) loadError.value = error.response?.data?.message || 'Não foi possível carregar o painel de AitoTokens.'
  } finally {
    if (currentLoad === request) loading.value = false
  }
}

async function saveExchangeRate() {
  const rate = Number(exchange.rate)
  if (!Number.isFinite(rate) || rate <= 0) return
  editing.exchangeRate = true
  try {
    const { data } = await api.put(`${root}/exchange-rate`, { rate, autoRefresh: exchange.autoRefresh }, financeHeaders(true))
    Object.assign(exchange, data.data?.exchangeRate || data.data)
    $q.notify({ type: 'positive', message: 'Cotação USD/BRL atualizada.' })
  } catch (error) {
    notify(error, 'Não foi possível salvar a cotação.')
  } finally {
    editing.exchangeRate = false
  }
}

async function saveConfig() {
  const { model, effort, speed } = config
  editing.config = true
  try {
    const { data } = await api.put(`${root}/config`, { model, effort, speed }, financeHeaders(true))
    Object.assign(config, data.data?.config || data.data)
    $q.notify({ type: 'positive', message: 'Configuração central da Aito IA atualizada.' })
  } catch (error) {
    notify(error, 'Não foi possível salvar a configuração.')
  } finally {
    editing.config = false
  }
}

function selectModel(model) {
  config.model = model
  if (!hasPriority.value) {
    config.effort = 'medium'
    config.speed = 'standard'
  }
}

function openGrant(wallet) {
  grantWallet.value = wallet
  grantAmount.value = null
  pendingGrant = null
}

async function requestGrantMfa() {
  const licenseId = grantWallet.value?.licenseId
  const usdCents = Math.round(Number(grantAmount.value) * 100)
  if (!licenseId || !Number.isSafeInteger(usdCents) || usdCents < 1 || editing.grant) return
  if (pendingGrant?.licenseId !== licenseId || pendingGrant.usdCents !== usdCents) {
    pendingGrant = { licenseId, usdCents, requestId: crypto.randomUUID() }
  }
  editing.grant = true
  try {
    const { data } = await api.post('/auth/mfa/reauth', {}, financeHeaders(true))
    grantChallenge.value = data
    mfaOpen.value = true
  } catch (error) {
    notify(error, 'Não foi possível enviar o código de confirmação.')
  } finally {
    editing.grant = false
  }
}

async function applyGrant(session) {
  if (!session?.token || !pendingGrant || editing.grant) return
  emit('reauthenticated', session)
  editing.grant = true
  try {
    await api.post(`${root}/grants`, pendingGrant, financeHeaders(true))
    $q.notify({ type: 'positive', message: 'Créditos adicionados à licença.' })
    grantWallet.value = null
    pendingGrant = null
    await load()
  } catch (error) {
    notify(error, 'Não foi possível adicionar os créditos.')
  } finally {
    editing.grant = false
  }
}

function changeTab(value) {
  if (value === 'licenses' && !loaded.value) load()
}

onMounted(() => changeTab(tab.value))
onBeforeUnmount(() => currentLoad?.abort())
</script>

<template>
  <section class="token-admin" aria-labelledby="token-admin-title">
    <header class="token-admin__head">
      <img src="/aitotokens.svg" alt="" width="56" height="56" />
      <div><h2 id="token-admin-title">AitoTokens</h2><p>Consumo, chaves de projetos e recargas.</p></div>
      <q-btn v-if="tab === 'licenses'" flat round icon="mdi-refresh" aria-label="Atualizar AitoTokens" :loading="loading" @click="load({ refreshSettings: true })" />
    </header>
    <q-tabs v-model="tab" dense align="left" no-caps active-color="teal-3" indicator-color="teal-3" class="token-admin__tabs" @update:model-value="changeTab">
      <q-tab name="usage" label="Uso e custos" />
      <q-tab name="projects" label="AitoKeys de projetos" />
      <q-tab name="licenses" label="Licenças e configurações" />
    </q-tabs>
    <AdminAitoTokenUsage v-if="tab === 'usage'" @reauthenticated="emit('reauthenticated', $event)" />
    <AdminAitoTokenProjects v-else-if="tab === 'projects'" @reauthenticated="emit('reauthenticated', $event)" @open-projects="emit('open-projects')" />
    <template v-else>
    <q-banner v-if="loadError" rounded class="bg-red-10 text-white" role="alert">{{ loadError }}</q-banner>
    <div v-if="loaded" class="token-admin__forms">
      <q-form class="token-admin__box" @submit.prevent="saveExchangeRate">
        <h3>Cotação USD/BRL</h3>
        <q-input v-model="exchange.rate" dark outlined label="Valor de US$ 1 em reais" prefix="R$" type="number" min="0.0001" max="1000" step="any" required />
        <q-toggle v-model="exchange.autoRefresh" dark color="teal-4" label="Redefinir diariamente" />
        <p>{{ exchange.autoRefresh ? 'A busca diária substitui a cotação manual.' : 'A cotação informada permanece até o próximo ajuste manual.' }}</p>
        <q-btn unelevated no-caps color="teal-7" type="submit" label="Salvar cotação" :loading="editing.exchangeRate" />
      </q-form>
      <q-form class="token-admin__box" @submit.prevent="saveConfig">
        <h3>Configurar Aito IA</h3>
        <div class="token-admin__status">
          <q-badge v-if="typeof config.configured === 'boolean'" outline :color="config.configured ? 'green-4' : 'orange-4'" :label="config.configured ? 'Provedor de IA configurado' : 'Chave da IA pendente'" />
          <q-badge v-if="typeof config.checkoutConfigured === 'boolean'" outline :color="config.checkoutConfigured ? 'green-4' : 'orange-4'" :label="config.checkoutConfigured ? 'Checkout InfinitePay configurado' : 'Checkout InfinitePay pendente'" />
        </div>
        <q-select :model-value="config.model" dark outlined :options="models" label="Modelo" @update:model-value="selectModel" />
        <q-select v-model="config.effort" dark outlined emit-value map-options :options="efforts" :disable="config.model === 'gpt-6-luna'" label="Nível de esforço" />
        <q-select v-model="config.speed" dark outlined emit-value map-options :options="speeds" :disable="!hasPriority" label="Processamento" />
        <p v-if="config.speed === 'priority'">O processamento prioritário usa o dobro de créditos pelo mesmo volume de tokens.</p>
        <q-btn unelevated no-caps color="teal-7" type="submit" label="Salvar configuração" :loading="editing.config" />
      </q-form>
    </div>
    <q-table
      v-if="loaded" v-model:pagination="pagination" flat bordered dark wrap-cells row-key="licenseId" :rows="wallets" :columns="columns"
      :rows-per-page-options="[pagination.rowsPerPage]" no-data-label="Nenhuma licença encontrada."
      class="token-admin__table" title="Consumo por licença" :loading="loading" @request="load({ page: $event.pagination.page })"
    >
      <template #top-right><q-input v-model.trim="search" dark dense outlined clearable debounce="300" label="Buscar cliente ou licença" @update:model-value="load({ page: 1 })" /></template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round dense icon="mdi-history" aria-label="Histórico de recargas" @click="historyWallet = props.row"><q-tooltip>Histórico de recargas</q-tooltip></q-btn>
          <q-btn flat round dense icon="mdi-plus-circle-outline" aria-label="Adicionar créditos" @click="openGrant(props.row)"><q-tooltip>Adicionar créditos</q-tooltip></q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog :model-value="Boolean(historyWallet)" @update:model-value="historyWallet = null">
      <q-card dark class="token-admin__dialog token-admin__dialog--wide">
        <q-card-section class="row items-center justify-between">
          <div><h3>Histórico de recargas</h3><p>{{ historyWallet?.ownerName }} · {{ historyWallet?.licenseId }}</p></div>
          <q-btn flat round dense icon="mdi-close" aria-label="Fechar" v-close-popup />
        </q-card-section>
        <q-card-section><AitoTokenHistory v-if="historyWallet" :key="historyWallet.licenseId" :license-id="historyWallet.licenseId" :rows="historyWallet.history" admin /></q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog :model-value="Boolean(grantWallet)" persistent @update:model-value="grantWallet = null">
      <q-card dark class="token-admin__dialog">
        <q-form @submit.prevent="requestGrantMfa">
          <q-card-section>
            <h3>Adicionar créditos</h3>
            <p>{{ grantWallet?.ownerName }} · {{ grantWallet?.ownerEmail }}</p>
            <p>Licença {{ grantWallet?.licenseId }}</p>
            <q-input v-model="grantAmount" dark outlined label="Créditos em dólares" prefix="US$" type="number" min="0.01" step="0.01" required />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" :disable="editing.grant || mfaOpen" v-close-popup />
            <q-btn unelevated no-caps label="Confirmar por e-mail" color="teal-7" type="submit" :loading="editing.grant" :disable="mfaOpen" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <LoginMfaDialog v-model="mfaOpen" :challenge="grantChallenge" @verified="applyGrant" />
    </template>
  </section>
</template>

<style scoped>
.token-admin { display: grid; gap: 1rem; color: #edfff8; }
.token-admin__head { display: flex; align-items: center; gap: .9rem; }
.token-admin__head > div { flex: 1; }
.token-admin__head h2 { margin: 0; font-size: clamp(1.65rem, 4vw, 2.5rem); line-height: 1.2; }
.token-admin__tabs { border-bottom: 1px solid #345857; }
.token-admin p, .token-admin__dialog p { margin: .35rem 0; color: #c2d9d3; }
.token-admin__forms { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1rem; }
.token-admin__box { display: grid; align-content: start; gap: .8rem; padding: 1rem; border: 1px solid #345857; border-radius: .8rem; background: #0c2022; }
.token-admin__box .q-btn { justify-self: start; }
.token-admin__status { display: flex; flex-wrap: wrap; gap: .45rem; }
.token-admin__status:empty { display: none; }
.token-admin h3, .token-admin__dialog h3 { margin: 0; font-size: 1.2rem; font-weight: 700; line-height: 1.4; }
.token-admin__table { background: #0c2022; border-color: #345857; }
.token-admin__dialog { width: min(94vw, 480px); border: 1px solid #345857; background: #0c2022; }
.token-admin__dialog--wide { width: min(94vw, 900px); max-width: 94vw; }
</style>
